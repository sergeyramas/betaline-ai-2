#!/usr/bin/env python3
"""Создать обычную поисковую кампанию (TextCampaign) в Директе через API v5 для custom2.

    python3 tools/direct-create-search-campaign.py --dry-run   # показать payload, ничего не создавать
    python3 tools/direct-create-search-campaign.py             # создать: кампания → группа → фразы → быстрые ссылки → объявления → модерация

Кампания создаётся и сразу ставится на паузу (campaigns.suspend): запуск и деньги — оператор в интерфейсе.
Токен/логин — ~/.config/betaline-ai-2/.env (YANDEX_DIRECT_TOKEN, YANDEX_DIRECT_CLIENT_LOGIN). Фразы и частоты — Wordstat v4 Live 21.09.2026.
"""
import argparse, datetime, json, os, sys, urllib.request

ENV = os.path.expanduser("~/.config/betaline-ai-2/.env")
SITE = "https://custom2.betaline-ai.ru"
COUNTER = 112650916
RUSSIA = 225
WEEKLY_RUB = 10_000
BID_CEILING_RUB = 60
UTM = "utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}&utm_term={keyword}"

KEYWORDS = [
    "ии для бизнеса", "нейросеть для бизнеса", "ии агент для бизнеса", "разработка ии агентов",
    "искусственный интеллект для бизнеса", "разработка чат бота", "внедрение ии в бизнес",
    "чат бот для бизнеса", "разработка ии решений", "ии ассистент для бизнеса",
]
# срезают инфо-хвосты у широких фраз («ии для бизнеса курсы», «вакансия», «как создать»)
NEGATIVE = ["курс", "курсы", "обучение", "бесплатно", "самостоятельно", "скачать", "вакансия", "вакансии",
            "что такое", "как создать", "презентация", "реферат", "диплом", "книга", "статья", "видео", "своими руками"]

# домен-правило сайта: «агент/система/решение», не «бот» (в фразах «чат бот» — это запрос пользователя, в текстах не пишем)
ADS = [  # Title ≤56, Title2 ≤30, Text ≤81
    ("Внедрим ИИ-агента в ваш бизнес", "Аудит — 0 ₽",
     "Заявки 24/7, запись клиентов, интеграция с CRM. Кейсы с цифрами и цены на сайте"),
    ("ИИ-агент для бизнеса под ключ", "От аудита до внедрения",
     "Отвечает клиентам 24/7 и передаёт заявки в CRM. Инженерная команда, кейсы, цены"),
    ("Разработка ИИ-агентов и RAG-систем", "Прозрачные цены",
     "LLM-системы как инженерные системы: бесплатный аудит, 4 этапа, реальные кейсы"),
]
SITELINKS = [  # Title ≤30, Description ≤60
    ("Услуги", "#services", "ИИ-агенты, RAG, голос, интеграции с CRM"),
    ("Кейсы", "#cases", "Реальные проекты с цифрами до и после внедрения"),
    ("Цены", "#pricing", "Прозрачные уровни, старт с бесплатного аудита"),
    ("Аудит — 0 ₽", "#contact", "Оставьте заявку — разберём ваши процессы бесплатно"),
]


def load_env():
    env = {}
    for line in open(ENV, encoding="utf-8"):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v.strip().strip('"')
    return env["YANDEX_DIRECT_TOKEN"], env["YANDEX_DIRECT_CLIENT_LOGIN"]


def api(svc, method, params, token, login):
    req = urllib.request.Request(
        f"https://api.direct.yandex.com/json/v5/{svc}",
        data=json.dumps({"method": method, "params": params}, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Client-Login": login,
                 "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.load(r)
    if "error" in res:
        sys.exit(f"{svc}.{method}: {res['error']}")
    out = res["result"]
    for item in out.get("AddResults", out.get("ModerateResults", out.get("SuspendResults", []))):
        if item.get("Errors"):
            sys.exit(f"{svc}.{method}: {item['Errors']}")
        for w in item.get("Warnings", []):
            print(f"  ⚠ {svc}: {w.get('Message')} {w.get('Details', '')}")
    return out


def rub(x):  # API считает в микроединицах
    return int(x * 1_000_000)


def check_lengths():
    for t1, t2, tx in ADS:
        assert len(t1) <= 56 and len(t2) <= 30 and len(tx) <= 81, (t1, len(t1), len(t2), len(tx))
    for t, _, d in SITELINKS:
        assert len(t) <= 30 and len(d) <= 60, (t, d)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    check_lengths()
    today = datetime.date.today()

    campaign = {"Name": f"custom2 · Поиск · ИИ-агенты · API {today:%d.%m.%y}",
                "StartDate": today.isoformat(),
                "NegativeKeywords": {"Items": NEGATIVE},
                "TextCampaign": {
                    "CounterIds": {"Items": [COUNTER]},
                    "BiddingStrategy": {
                        "Search": {"BiddingStrategyType": "WB_MAXIMUM_CLICKS",
                                   "WbMaximumClicks": {"WeeklySpendLimit": rub(WEEKLY_RUB), "BidCeiling": rub(BID_CEILING_RUB)}},
                        "Network": {"BiddingStrategyType": "SERVING_OFF"}},
                    "Settings": [{"Option": "ADD_METRICA_TAG", "Value": "YES"},
                                 {"Option": "ADD_OPENSTAT_TAG", "Value": "NO"}]}}
    sitelinks = {"Sitelinks": [{"Title": t, "Href": f"{SITE}/{h}", "Description": d} for t, h, d in SITELINKS]}

    if a.dry_run:
        print(json.dumps(campaign, ensure_ascii=False, indent=1))
        print("keywords:", KEYWORDS)
        print("sitelinks:", json.dumps(sitelinks, ensure_ascii=False))
        for t1, t2, tx in ADS:
            print(f"AD: {t1} | {t2} | {tx}")
        return

    token, login = load_env()
    cid = api("campaigns", "add", {"Campaigns": [campaign]}, token, login)["AddResults"][0]["Id"]
    print("campaign", cid)
    gid = api("adgroups", "add", {"AdGroups": [{"Name": "ИИ-агенты для бизнеса", "CampaignId": cid, "RegionIds": [RUSSIA]}]},
              token, login)["AddResults"][0]["Id"]
    print("adgroup", gid)
    kw = api("keywords", "add", {"Keywords": [{"Keyword": k, "AdGroupId": gid} for k in KEYWORDS]}, token, login)
    print("keywords", [r["Id"] for r in kw["AddResults"]])
    sid = api("sitelinks", "add", {"SitelinksSets": [sitelinks]}, token, login)["AddResults"][0]["Id"]
    print("sitelinks set", sid)
    ads = api("ads", "add", {"Ads": [{"AdGroupId": gid, "TextAd": {
        "Title": t1, "Title2": t2, "Text": tx, "Href": f"{SITE}/?{UTM}", "Mobile": "NO",
        "DisplayUrlPath": "ИИ-агенты", "SitelinkSetId": sid}} for t1, t2, tx in ADS]}, token, login)
    ad_ids = [r["Id"] for r in ads["AddResults"]]
    print("ads", ad_ids)
    api("ads", "moderate", {"SelectionCriteria": {"Ids": ad_ids}}, token, login)
    api("campaigns", "suspend", {"SelectionCriteria": {"Ids": [cid]}}, token, login)
    print(f"готово: кампания {cid} на модерации и на ПАУЗЕ — запуск в интерфейсе: "
          f"https://direct.yandex.ru/dna/grid/campaigns?ulogin={login}")


if __name__ == "__main__":
    main()
