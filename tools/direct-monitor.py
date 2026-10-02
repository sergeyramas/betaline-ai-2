#!/usr/bin/env python3
"""Суточный мониторинг Директа на custom2 — Reports API + Метрика → сводка + тревоги → Telegram.

Пороги — docs/ads/MONITORING.md. Только чтение, ничего в кампании не меняет.

  python3 tools/direct-monitor.py            # снять и отправить оператору
  python3 tools/direct-monitor.py --dry-run  # только напечатать

Токен: ~/.config/betaline-ai-2/.env (или .env в корне репо), ключи YANDEX_DIRECT_TOKEN,
YANDEX_DIRECT_CLIENT_LOGIN. Один OAuth-токен приложения «Нейро директолог» на Директ и Метрику.
"""
import datetime as dt
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMPAIGN = 714447865
COUNTER = 112650916
GOALS = {617936022: "audit_lead", 617937073: "chat_message", 617937404: "chat_lead", 617937509: "callback_chat"}
OPERATOR = "609952529"
DIRECT_API = os.environ.get("YANDEX_DIRECT_API", "https://api.direct.yandex.com")  # песочница: api-sandbox.direct.yandex.com
# ponytail: копия вне ~/Documents — launchd не может выполнить файлы из Documents (TCC, exit 126).
# Обновлять: cp ~/Documents/agent-fleet/tools/tg-send ~/.local/bin/tg-send
TG_SEND = os.path.expanduser("~/.local/bin/tg-send")


def load_env():
    for p in (os.path.expanduser("~/.config/betaline-ai-2/.env"), os.path.join(ROOT, ".env")):
        if os.path.exists(p):
            for line in open(p):
                if "=" in line and not line.startswith("#"):
                    k, v = line.rstrip("\n").split("=", 1)
                    os.environ.setdefault(k, v)
            return
    sys.exit("нет .env с YANDEX_DIRECT_TOKEN")


def http(url, headers, data=None):
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


# ---------- Директ ----------
def direct_report(tok, login, d1, d2):
    """Reports API v5: одна строка по кампании. None + причина, если доступа нет."""
    body = {"params": {
        "SelectionCriteria": {"DateFrom": d1, "DateTo": d2, "Filter": [
            {"Field": "CampaignId", "Operator": "EQUALS", "Values": [str(CAMPAIGN)]}]},
        "Goals": [str(g) for g in GOALS], "AttributionModels": ["AUTO"],
        "FieldNames": ["Impressions", "Clicks", "Cost", "Ctr", "AvgCpc", "Conversions", "BounceRate"],
        "ReportName": f"custom2-{d1}-{d2}-{int(time.time())}", "ReportType": "CAMPAIGN_PERFORMANCE_REPORT",
        "DateRangeType": "CUSTOM_DATE", "Format": "TSV", "IncludeVAT": "YES"}}
    hdr = {"Authorization": f"Bearer {tok}", "Client-Login": login, "Accept-Language": "ru",
           "Content-Type": "application/json", "returnMoneyInMicros": "false",
           "skipReportHeader": "true", "skipReportSummary": "true"}
    for _ in range(6):
        st, h, txt = http(f"{DIRECT_API}/json/v5/reports", hdr, json.dumps(body).encode())
        if st in (201, 202):
            time.sleep(int(h.get("retryIn", 5)))
            continue
        if st != 200:
            try:
                e = json.loads(txt)["error"]
                return None, f"Директ API: {e['error_string']} (код {e['error_code']})"
            except Exception:
                return None, f"Директ API: HTTP {st}"
        lines = [l for l in txt.splitlines() if l.strip()]
        if len(lines) < 2:
            return {"Impressions": 0, "Clicks": 0, "Cost": 0, "Ctr": 0, "AvgCpc": 0, "Conversions": 0, "BounceRate": 0}, None
        keys, vals = lines[0].split("\t"), lines[1].split("\t")
        r = {k: float(v) if v not in ("--", "") else 0 for k, v in zip(keys, vals)}
        # с параметром Goals API отдаёт Conversions_<goal>_<model> вместо Conversions — суммируем
        r["Conversions"] = sum(v for k, v in r.items() if k.startswith("Conversions_"))
        return r, None
    return None, "Директ API: отчёт не собрался за 6 попыток"


def direct_balance(tok, login):
    """API v4 Live AccountManagement — единственное место, где есть баланс. None, если нет доступа."""
    body = {"method": "AccountManagement", "token": tok, "locale": "ru",
            "param": {"Action": "Get", "SelectionCriteria": {"Logins": [login]}}}
    st, _, txt = http("https://api.direct.yandex.ru/live/v4/json/", {"Content-Type": "application/json"},
                      json.dumps(body).encode())
    try:
        return float(json.loads(txt)["data"]["Accounts"][0]["Amount"])
    except Exception:
        return None


# ---------- Метрика ----------
def metrika(tok, d1, d2, metrics, filters=None):
    q = {"ids": COUNTER, "metrics": metrics, "date1": d1, "date2": d2, "accuracy": "full"}
    if filters:
        q["filters"] = filters
    st, _, txt = http("https://api-metrika.yandex.net/stat/v1/data?" + urllib.parse.urlencode(q),
                      {"Authorization": f"OAuth {tok}"})
    d = json.loads(txt)
    if st != 200:
        raise RuntimeError(f"Метрика: {d.get('message')}")
    return d["totals"]


def metrika_ads(tok, d1, d2):
    goals = ",".join(f"ym:s:goal{g}reaches" for g in GOALS)
    tot = metrika(tok, d1, d2, "ym:s:visits")[0]
    ad = metrika(tok, d1, d2, f"ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds,{goals}",
                 "ym:s:lastsignTrafficSource=='ad'")
    return {"visits_total": tot, "ad_visits": ad[0], "ad_bounce": ad[1], "ad_dur": ad[2],
            "goals": dict(zip(GOALS.values(), ad[3:]))}


# ---------- сводка ----------
def fmt(n, dec=0):
    return f"{n:,.{dec}f}".replace(",", " ")


def block(title, dr, m):
    out = [f"*{title}*"]
    if dr:
        conv = int(dr["Conversions"])
        out.append(f"Директ: {fmt(dr['Impressions'])} показов / {fmt(dr['Clicks'])} кликов, CTR {dr['Ctr']:.2f} %, "
                   f"расход {fmt(dr['Cost'], 2)} ₽, CPC {dr['AvgCpc']:.2f} ₽, конверсий {conv}")
    ratio = f", {m['ad_visits'] / dr['Clicks'] * 100:.0f} % от кликов" if dr and dr["Clicks"] else ""
    g = ", ".join(f"{k} {int(v)}" for k, v in m["goals"].items() if v) or "0"
    out.append(f"Метрика: визитов с рекламы {int(m['ad_visits'])} из {int(m['visits_total'])}{ratio}, "
               f"отказы {m['ad_bounce']:.0f} %, {m['ad_dur']:.0f} с на сайте; цели: {g}")
    return out


def alerts(dr_y, m_y, dr_w, m_w, balance):
    a = []
    # ponytail: «третий день подряд» не считаем — проверяем вчерашний день; история появится, когда понадобится
    if dr_y and dr_y["Clicks"] >= 10 and m_y["ad_visits"] / dr_y["Clicks"] < 0.4:
        a.append(f"визиты/клики {m_y['ad_visits'] / dr_y['Clicks'] * 100:.0f} % < 40 % — мусорные клики, смотреть площадки")
    if m_w["ad_visits"] >= 30 and m_w["ad_bounce"] > 85:
        a.append(f"отказы по рекламе {m_w['ad_bounce']:.0f} % > 85 % за 7 дн — чистить площадки")
    if dr_y and dr_y["AvgCpc"] > 40:
        a.append(f"CPC вчера {dr_y['AvgCpc']:.0f} ₽ > 40 ₽ — проверить автотаргетинг/тексты")
    if dr_w and dr_w["Cost"] > 5000 and dr_w["Conversions"] == 0 and not any(m_w["goals"].values()):
        a.append(f"0 конверсий при расходе {fmt(dr_w['Cost'])} ₽ за 7 дн > 5 000 ₽ — оффер/гео")
    if dr_w and dr_w["Cost"] > 11000:
        a.append(f"расход за 7 дн {fmt(dr_w['Cost'])} ₽ > 11 000 ₽ — проверить адаптацию бюджета")
    if balance is not None and balance < 3000:
        a.append(f"баланс {fmt(balance)} ₽ < 3 000 ₽ — пополнить или пауза")
    return a


def main():
    load_env()
    tok, login = os.environ["YANDEX_DIRECT_TOKEN"], os.environ.get("YANDEX_DIRECT_CLIENT_LOGIN", "e-16571744")
    today = dt.date.today()
    y = (today - dt.timedelta(days=1)).isoformat()
    w1 = (today - dt.timedelta(days=7)).isoformat()

    dr_y, err = direct_report(tok, login, y, y)
    dr_w, _ = direct_report(tok, login, w1, y) if dr_y else (None, None)
    balance = direct_balance(tok, login) if dr_y else None
    m_y, m_w = metrika_ads(tok, y, y), metrika_ads(tok, w1, y)

    lines = [f"📊 Директ custom2 · {CAMPAIGN} · {today:%d.%m}"]
    d = lambda s: f"{s[8:]}.{s[5:7]}"
    lines += block(f"Вчера {d(y)}", dr_y, m_y)
    lines += block(f"7 дней {d(w1)}–{d(y)}", dr_w, m_w)
    if balance is not None:
        lines.append(f"Баланс: {fmt(balance)} ₽")
    if err:
        lines.append(f"⚠️ {err} — показы/расход недоступны, только Метрика")
    al = alerts(dr_y, m_y, dr_w, m_w, balance)
    lines.append("🔴 " + "\n🔴 ".join(al) if al else "✅ Порогов MONITORING.md не превышено")
    text = "\n".join(lines)
    print(text)
    if "--dry-run" not in sys.argv:
        subprocess.run([TG_SEND, OPERATOR], input=text.encode(), check=True)


if __name__ == "__main__":
    main()
