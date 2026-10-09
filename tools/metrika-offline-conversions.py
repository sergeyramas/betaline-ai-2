#!/usr/bin/env python3
"""Офлайн-конверсии в Яндекс.Метрику из JSONL-лидов (api/lead.js, env LEADS_JSONL_PATH).

Зачем: у части посетителей Метрика заблокирована (adblock/VPN) — визит и цель audit_lead не
записались, и Директ (оплата за конверсии) видит 0. Сайт всё равно отправил лид в /api/lead
вместе с yclid / _ym_uid, а мы догружаем конверсию сюда.

Что делает: читает JSONL (одна запись на строку: ts, source, yclid, ym_uid, counter, ...),
группирует по счётчику и типу идентификатора (YCLID приоритетнее CLIENT_ID = _ym_uid),
строит CSV `Yclid|ClientId, Target, DateTime` (DateTime — unix-секунды) и грузит:
    POST https://api-metrika.yandex.net/management/v1/counter/{id}/offline_conversions/upload
         ?client_id_type=YCLID|CLIENT_ID     (multipart, поле file)
Записи без yclid и без ym_uid пропускаются. Уже загруженные помечаются в файле состояния
(<jsonl>.uploaded, там только хеши — без телефонов), повторный --apply их не шлёт.

Режимы: по умолчанию --dry-run (печатает CSV, ничего не отправляет); --apply — загрузка.

Токен: env YANDEX_DIRECT_TOKEN или ~/.config/betaline-ai-2/.env (никогда не печатается).

ТРЕБУЕТСЯ ОТ ОПЕРАТОРА (иначе будет 403):
  1) Считалось, что у OAuth-приложения «Нейро директолог» только `direct:api` + `metrika:read`;
     для загрузки нужен `metrika:write` — тогда добавить в приложении и заново выдать токен.
     (07.10 тестовая загрузка вернула HTTP 200, т.е. право записи у токена, похоже, есть.)
  2) В каждом счётчике включить «Загрузка офлайн-конверсий» (Настройки -> Офлайн-конверсии),
     а цели `Target` должны существовать в счётчике (JavaScript-события: audit_lead и т.д.).
  3) Не проверено: не задвоит ли Метрика конверсию, которую успел записать сам счётчик.
     Первую загрузку сделать на небольшом куске (--since) и сверить отчёт.

Примеры:
  python3 tools/metrika-offline-conversions.py --jsonl /tmp/leads.jsonl
  python3 tools/metrika-offline-conversions.py --jsonl /tmp/leads.jsonl --since 2026-10-07 --apply
  --map callback=callback_chat   # переопределить цель для источника
"""
import argparse
import csv
import hashlib
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

API = "https://api-metrika.yandex.net/management/v1/counter/{cid}/offline_conversions/upload"
ENV_FILE = Path.home() / ".config" / "betaline-ai-2" / ".env"
DEFAULT_TARGETS = {"audit": "audit_lead", "quiz": "quiz_lead", "callback": "callback_lead", "pricing": "pricing_lead"}


def load_token() -> str:
    tok = os.environ.get("YANDEX_DIRECT_TOKEN", "").strip()
    if not tok and ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("YANDEX_DIRECT_TOKEN="):
                tok = line.split("=", 1)[1].strip().strip("'\"")
    return tok


def rec_key(r: dict) -> str:
    raw = f"{r.get('counter','')}|{r.get('ts','')}|{r.get('source','')}|{r.get('contact','')}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


def read_jsonl(path: Path):
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            print(f"! строка {n}: не JSON, пропуск", file=sys.stderr)


def build_groups(records, targets, only_counter, since_ts, done):
    """-> {(counter, id_type): [(id, target, ts, key)]}, skipped_stats"""
    groups, stats = {}, {"no_id": 0, "no_counter": 0, "no_target": 0, "old": 0, "done": 0}
    for r in records:
        key = rec_key(r)
        if key in done:
            stats["done"] += 1
            continue
        counter = str(r.get("counter") or only_counter or "")
        if only_counter and counter != str(only_counter):
            continue
        if not counter:
            stats["no_counter"] += 1
            continue
        ts = int(r.get("ts") or 0)
        if since_ts and ts < since_ts:
            stats["old"] += 1
            continue
        target = targets.get(r.get("source"))
        if not target:
            stats["no_target"] += 1
            continue
        if r.get("yclid"):
            id_type, ident = "YCLID", str(r["yclid"])
        elif r.get("ym_uid"):
            id_type, ident = "CLIENT_ID", str(r["ym_uid"])
        else:
            stats["no_id"] += 1
            continue
        groups.setdefault((counter, id_type), []).append((ident, target, ts, key))
    return groups, stats


def to_csv(id_type: str, rows) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["Yclid" if id_type == "YCLID" else "ClientId", "Target", "DateTime"])
    for ident, target, ts, _ in rows:
        w.writerow([ident, target, ts])
    return buf.getvalue()


def upload(counter: str, id_type: str, csv_text: str, token: str) -> None:
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"conversions.csv\"\r\n"
        f"Content-Type: text/csv\r\n\r\n{csv_text}\r\n--{boundary}--\r\n"
    ).encode("utf-8")
    url = API.format(cid=counter) + "?" + urllib.parse.urlencode({"client_id_type": id_type, "comment": "betaline-ai-2 site leads"})
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"OAuth {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            print(f"  счётчик {counter} ({id_type}): HTTP {resp.status} {resp.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        if e.code == 403:
            sys.exit(
                f"403 по счётчику {counter}: у токена нет права записи в Метрику (нужен scope metrika:write; "
                "сейчас у приложения только metrika:read) или в счётчике не включены офлайн-конверсии. "
                f"Ответ API: {detail}"
            )
        sys.exit(f"HTTP {e.code} по счётчику {counter}: {detail}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--jsonl", required=True, type=Path, help="файл лидов (LEADS_JSONL_PATH сервера)")
    ap.add_argument("--counter", help="только этот счётчик (и подставить его записям без поля counter)")
    ap.add_argument("--since", help="только лиды с даты YYYY-MM-DD (UTC)")
    ap.add_argument("--map", action="append", default=[], metavar="source=target", help="цель для источника")
    ap.add_argument("--state", type=Path, help="файл состояния (по умолчанию <jsonl>.uploaded)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="по умолчанию: печать CSV без отправки")
    mode.add_argument("--apply", action="store_true", help="загрузить в Метрику")
    a = ap.parse_args()

    targets = dict(DEFAULT_TARGETS)
    for m in a.map:
        k, _, v = m.partition("=")
        if not v:
            sys.exit(f"--map {m!r}: нужен формат source=target")
        targets[k] = v
    since_ts = int(datetime.strptime(a.since, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()) if a.since else 0
    state = a.state or a.jsonl.with_name(a.jsonl.name + ".uploaded")
    done = set(state.read_text().split()) if state.exists() else set()

    groups, stats = build_groups(read_jsonl(a.jsonl), targets, a.counter, since_ts, done)
    total = sum(len(v) for v in groups.values())
    print(f"режим: {'APPLY' if a.apply else 'DRY-RUN'}; к загрузке: {total}; пропущено: {stats}")
    if not total:
        return

    token = ""
    if a.apply:
        token = load_token()
        if not token:
            sys.exit("нет токена: задайте YANDEX_DIRECT_TOKEN или ~/.config/betaline-ai-2/.env")

    uploaded_keys = []
    for (counter, id_type), rows in sorted(groups.items()):
        text = to_csv(id_type, rows)
        print(f"\n# счётчик {counter}, client_id_type={id_type}, строк: {len(rows)}")
        if not a.apply:
            print(text, end="")
            continue
        upload(counter, id_type, text, token)
        uploaded_keys += [r[3] for r in rows]
    if a.apply and uploaded_keys:
        with state.open("a", encoding="utf-8") as f:
            f.write("\n".join(uploaded_keys) + "\n")
        print(f"\nсостояние обновлено: {state}")


if __name__ == "__main__":
    main()
