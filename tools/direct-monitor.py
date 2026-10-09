#!/usr/bin/env python3
"""Суточный мониторинг Директа (все кампании аккаунта) — Reports API + Метрика → сводка + тревоги → Telegram.

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
# живые кампании, которые проверяем, даже если в отчёте нет строк (показов не было)
LIVE_IDS = [715032341, 715032350, 714626313]
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
# цели-заявки: custom2 (счётчик 112650916), betaline-ai.ru (PriorityGoals кампаний 715032350/708929168), zvonok
GOAL_LABELS = {617936022: "audit_lead", 617937404: "chat_lead", 617937509: "callback_chat",
               546490559: "ba_546490559", 545731666: "ba_545731666", 545719489: "ba_545719489",
               545732855: "ba_545732855", 658043267: "zvonok"}


def direct_hdr(tok, login):
    return {"Authorization": f"Bearer {tok}", "Client-Login": login, "Accept-Language": "ru",
            "Content-Type": "application/json", "returnMoneyInMicros": "false",
            "skipReportHeader": "true", "skipReportSummary": "true"}


def direct_report(tok, login, d1, d2):
    """Reports API v5: строки (день, кампания) по ВСЕМ кампаниям — так видны и Мастера. (rows, ошибка)."""
    body = {"params": {
        "SelectionCriteria": {"DateFrom": d1, "DateTo": d2},
        "Goals": [str(g) for g in GOAL_LABELS], "AttributionModels": ["AUTO"],
        "FieldNames": ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost"],
        "ReportName": f"monitor-{d1}-{d2}-{int(time.time())}", "ReportType": "CAMPAIGN_PERFORMANCE_REPORT",
        "DateRangeType": "CUSTOM_DATE", "Format": "TSV", "IncludeVAT": "YES"}}
    for _ in range(6):
        st, h, txt = http(f"{DIRECT_API}/json/v5/reports", direct_hdr(tok, login), json.dumps(body).encode())
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
        if not lines:
            return [], None
        keys, rows = lines[0].split("\t"), []
        for l in lines[1:]:
            r = dict(zip(keys, l.split("\t")))
            row = {"date": r["Date"], "id": int(r["CampaignId"]), "name": r["CampaignName"]}
            for k in ("Impressions", "Clicks", "Cost"):
                row[k] = float(r[k]) if r[k] not in ("--", "") else 0
            row["goals"] = {}
            for k, v in r.items():
                if k.startswith("Conversions_") and v not in ("--", "", "0"):
                    gid = int(k.split("_")[1])
                    row["goals"][GOAL_LABELS.get(gid, str(gid))] = float(v)
            rows.append(row)
        return rows, None
    return None, "Директ API: отчёт не собрался за 6 попыток"


def direct_campaigns(tok, login, ids):
    """campaigns.get (только чтение): статус и недельный лимит. Мастера кампаний API не отдаёт — их тут нет."""
    out = {}
    for i in range(0, len(ids), 10):
        body = {"method": "get", "params": {
            "SelectionCriteria": {"Ids": ids[i:i + 10]}, "FieldNames": ["Id", "Name", "State", "Status", "Type"],
            "TextCampaignFieldNames": ["BiddingStrategy"], "UnifiedCampaignFieldNames": ["BiddingStrategy"]}}
        st, _, txt = http(f"{DIRECT_API}/json/v5/campaigns", direct_hdr(tok, login), json.dumps(body).encode())
        try:
            for c in json.loads(txt)["result"]["Campaigns"]:
                sub = c.get("TextCampaign") or c.get("UnifiedCampaign") or {}
                limit = None
                for net in (sub.get("BiddingStrategy") or {}).values():
                    for v in (net or {}).values():
                        if isinstance(v, dict) and v.get("WeeklySpendLimit"):
                            limit = v["WeeklySpendLimit"] / 1e6
                out[c["Id"]] = {"state": c["State"], "status": c["Status"], "limit": limit}
        except Exception:
            pass
    return out


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


def summarize(rows, camps, today):
    """Группировка по кампаниям: вчера / сегодня / среднее за 3 дня до вчера. Архивные и остановленные без показов скрыты."""
    y, t = (today - dt.timedelta(days=1)).isoformat(), today.isoformat()
    by = {}
    for r in rows:
        c = by.setdefault(r["id"], {"id": r["id"], "name": r["name"], "days": {}, "w": {"Impressions": 0, "Clicks": 0, "Cost": 0}, "goals": {}})
        c["days"][r["date"]] = r
        for k in c["w"]:
            c["w"][k] += r[k]
        for g, v in r["goals"].items():
            c["goals"][g] = c["goals"].get(g, 0) + v
    for cid, info in camps.items():  # живые кампании без строк отчёта = ноль показов
        if info["state"] == "ON" and cid not in by:
            by[cid] = {"id": cid, "name": f"кампания {cid}", "days": {}, "w": {"Impressions": 0, "Clicks": 0, "Cost": 0}, "goals": {}}
    out = []
    for c in by.values():
        info = camps.get(c["id"])  # None = Мастер кампаний (в campaigns.get не виден)
        c["info"] = info
        if info and info["state"] != "ON" and c["w"]["Impressions"] == 0:
            continue
        c["y"] = c["days"].get(y, {"Impressions": 0, "Clicks": 0, "Cost": 0})
        c["t"] = c["days"].get(t, {"Impressions": 0, "Clicks": 0, "Cost": 0})
        prev = [(today - dt.timedelta(days=k)).isoformat() for k in (2, 3, 4)]
        c["avg3"] = sum(c["days"].get(d, {"Impressions": 0})["Impressions"] for d in prev) / 3
        out.append(c)
    return sorted(out, key=lambda c: -c["w"]["Cost"])


def campaign_alerts(c):
    a, info, nm = [], c["info"], f"{c['name']} ({c['id']})"
    if info and info["state"] == "ON" and c["y"]["Impressions"] + c["t"]["Impressions"] == 0:
        a.append(f"{nm}: нет показов больше 24 ч при статусе ON")
    elif c["avg3"] >= 20 and c["y"]["Impressions"] < c["avg3"] * 0.3:
        a.append(f"{nm}: показы вчера {fmt(c['y']['Impressions'])} — падение >70 % к среднему за 3 дня ({fmt(c['avg3'])})")
    if info and info["limit"]:
        cap = info["limit"] / 7 * 1.5
        for lab, d in (("вчера", c["y"]), ("сегодня", c["t"])):
            if d["Cost"] > cap:
                a.append(f"{nm}: расход {lab} {fmt(d['Cost'])} ₽ > {fmt(cap)} ₽ (1,5 x недельный лимит/7)")
    if c["y"]["Clicks"] >= 10 and c["y"]["Cost"] / c["y"]["Clicks"] > 40:
        a.append(f"{nm}: CPC вчера {c['y']['Cost'] / c['y']['Clicks']:.0f} ₽ > 40 ₽")
    if c["w"]["Cost"] > 5000 and not c["goals"]:
        a.append(f"{nm}: 0 конверсий при расходе {fmt(c['w']['Cost'])} ₽ за 7 дн")
    return a


def campaign_line(c):
    i, y, w = c["info"], c["y"], c["w"]
    tag = "" if not i else ("" if i["state"] == "ON" else f" [{i['state']}]")
    lim = f", лимит {fmt(i['limit'])} ₽/нед" if i and i["limit"] else ""
    goals = ", ".join(f"{k} {int(v)}" for k, v in c["goals"].items())
    ev = f", заявок (событий) {int(sum(c['goals'].values()))}: {goals}" if c["goals"] else ", заявок 0"
    return (f"• {c['name']} ({c['id']}){tag}{lim}\n"
            f"  вчера {fmt(y['Impressions'])} пок / {fmt(y['Clicks'])} кл / {fmt(y['Cost'], 2)} ₽; "
            f"7 дн {fmt(w['Impressions'])} / {fmt(w['Clicks'])} / {fmt(w['Cost'], 2)} ₽{ev}")


def metrika_alerts(rows, y, m_y, m_w):
    """Метрика — счётчик custom2: сверяем клики кампаний custom2 (Мастер + поиск) с визитами с рекламы."""
    a = []
    clicks = sum(r["Clicks"] for r in rows if r["date"] == y and r["name"].lower().startswith("custom2"))
    if clicks >= 10 and m_y["ad_visits"] / clicks < 0.4:
        a.append(f"Метрика custom2: визиты/клики {m_y['ad_visits'] / clicks * 100:.0f} % < 40 % — мусорные клики, смотреть площадки")
    if m_w["ad_visits"] >= 30 and m_w["ad_bounce"] > 85:
        a.append(f"Метрика custom2: отказы по рекламе {m_w['ad_bounce']:.0f} % > 85 % за 7 дн")
    return a


def main():
    load_env()
    tok, login = os.environ["YANDEX_DIRECT_TOKEN"], os.environ.get("YANDEX_DIRECT_CLIENT_LOGIN", "e-16571744")
    today = dt.date.today()
    y = (today - dt.timedelta(days=1)).isoformat()
    w1 = (today - dt.timedelta(days=7)).isoformat()

    rows, err = direct_report(tok, login, w1, today.isoformat())
    camps = direct_campaigns(tok, login, sorted({r["id"] for r in rows})) if rows else {}
    # живые кампании, которых нет в отчёте (ни одного показа за 8 дней), добираем отдельным списком
    for cid in LIVE_IDS:
        if cid not in camps and cid not in {r["id"] for r in (rows or [])}:
            camps.update(direct_campaigns(tok, login, [cid]))
    balance = direct_balance(tok, login) if rows is not None else None
    m_y, m_w = metrika_ads(tok, y, y), metrika_ads(tok, w1, y)

    lines = [f"📊 Директ · {today:%d.%m}"]
    cs = summarize(rows or [], camps, today)
    lines += [campaign_line(c) for c in cs] or ["нет кампаний с показами"]
    g = ", ".join(f"{k} {int(v)}" for k, v in m_w["goals"].items() if v) or "0"
    lines.append(f"Метрика custom2 (7 дн): визитов с рекламы {int(m_w['ad_visits'])}, отказы {m_w['ad_bounce']:.0f} %, цели: {g}")
    if balance is not None:
        lines.append(f"Баланс: {fmt(balance)} ₽")
    if any(c["w"]["Clicks"] and not c["w"]["Cost"] for c in cs):
        lines.append("ℹ️ у части кампаний клики есть, а расход в отчёте 0,00 — API расход не отдаёт (бонусы/промо?), сверять по кабинету")
    if err:
        lines.append(f"⚠️ {err} — показы/расход недоступны")
    al = [x for c in cs for x in campaign_alerts(c)] + metrika_alerts(rows or [], y, m_y, m_w)
    if balance is not None and balance < 3000:
        al.append(f"баланс {fmt(balance)} ₽ < 3 000 ₽ — пополнить или пауза")
    lines.append("🔴 " + "\n🔴 ".join(al) if al else "✅ Порогов MONITORING.md не превышено")
    text = "\n".join(lines)
    print(text)
    if "--dry-run" not in sys.argv:
        subprocess.run([TG_SEND, OPERATOR], input=text.encode(), check=True)


if __name__ == "__main__":
    main()
