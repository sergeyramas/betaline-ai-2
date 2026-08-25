#!/usr/bin/env python3
"""Отправить сообщение (и картинки) в тему форум-группы с @ramassist.

Штатный tg_send.py умеет только send_message(entity, text) — в форум-группе
это кладёт сообщение в General, а не в нужную тему. Тема адресуется через
reply_to=<id темы>.

    # узнать id тем группы
    ./.venv/bin/python tg_send_topic.py --peer @betaline_group --list-topics

    # текст в тему
    echo "текст" | ./.venv/bin/python tg_send_topic.py --peer @betaline_group --topic 42

    # текст + картинки одним альбомом
    echo "текст" | ./.venv/bin/python tg_send_topic.py --peer @betaline_group --topic 42 \
        --files ~/Downloads/betaline-site-new-orange.jpg ~/Downloads/concept-A-chertezh.jpg
"""
import argparse
import os
import sys

from telethon.sync import TelegramClient
from telethon.tl.functions.channels import GetForumTopicsRequest

DATA = os.environ.get("TG_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
SESSION = os.path.join(DATA, "personal")


def as_peer(raw: str):
    s = raw.strip()
    return int(s) if s.lstrip("-").isdigit() else s


def resolve(client, peer):
    try:
        return client.get_entity(peer)
    except ValueError:
        client.get_dialogs()
        return client.get_entity(peer)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--peer", required=True)
    ap.add_argument("--topic", type=int, help="id темы (top_message forum topic)")
    ap.add_argument("--files", nargs="*", default=[], help="картинки/файлы к сообщению")
    ap.add_argument("--list-topics", action="store_true", help="показать темы и выйти")
    args = ap.parse_args()

    api_id = int(os.environ["TG_API_ID"])
    api_hash = os.environ["TG_API_HASH"]

    with TelegramClient(SESSION, api_id, api_hash) as client:
        if not client.is_user_authorized():
            sys.exit("сессия не авторизована — сначала login_request.py / login_confirm.py")

        entity = resolve(client, as_peer(args.peer))

        if args.list_topics:
            res = client(GetForumTopicsRequest(
                channel=entity, offset_date=None, offset_id=0,
                offset_topic=0, limit=100,
            ))
            for t in res.topics:
                print(f"{getattr(t, 'id', '?'):>10}  {getattr(t, 'title', '(General)')}")
            return

        text = sys.stdin.read().strip()
        if not text and not args.files:
            sys.exit("пустой текст и нет файлов")

        # в форум-группе тема адресуется через reply_to
        kw = {"reply_to": args.topic} if args.topic else {}

        if args.files:
            msgs = client.send_file(entity, args.files, caption=text or None, **kw)
            ids = [m.id for m in (msgs if isinstance(msgs, list) else [msgs])]
            print(f"отправлено файлов: {len(ids)} (msg_id={ids})")
        else:
            msg = client.send_message(entity, text, link_preview=False, **kw)
            print(f"отправлено (msg_id={msg.id})")


if __name__ == "__main__":
    main()
