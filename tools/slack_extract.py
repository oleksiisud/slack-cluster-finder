#!/usr/bin/env python3
"""Simple Slack extractor: list channels and fetch recent messages.

Writes NDJSON lines to out/slack_messages.ndjson and prints a short summary.

Usage: source .env; python3 tools/slack_extract.py [--limit N]
"""
from __future__ import annotations

import json
import os
import sys
import hashlib
from typing import Optional

try:
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError
except Exception as e:  # pragma: no cover - dependency may not be installed
    print("slack_sdk not installed. Install with: pip install slack_sdk")
    raise

HASH_SALT = os.getenv("HASH_SALT", "dev-salt")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")

OUT_DIR = "out"
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, "slack_messages.ndjson")


def hash_user(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    h = hashlib.sha256()
    h.update(HASH_SALT.encode("utf-8"))
    h.update(user_id.encode("utf-8"))
    return h.hexdigest()


def fetch_recent_messages(limit: int = 50) -> None:
    if not SLACK_BOT_TOKEN:
        print("SLACK_BOT_TOKEN not set in environment. Aborting.")
        sys.exit(1)
    client = WebClient(token=SLACK_BOT_TOKEN)

    # quick auth test to help diagnose token type / permissions
    try:
        auth_res = client.auth_test()
        if auth_res.get("ok"):
            print(f"auth.test ok: team={auth_res.get('team')} user_id={auth_res.get('user_id')}")
    except SlackApiError as e:
        err = getattr(e.response, 'data', None) or getattr(e.response, 'body', None) or str(e)
        print("auth.test failed:", err)
        print("Make sure SLACK_BOT_TOKEN is a bot token (xoxb- or xoxe-) with appropriate scopes and the app is installed to the workspace.")
        sys.exit(1)

    # list conversations (public channels + private channels)
    conv_types = "public_channel,private_channel"
    channels = []
    cursor = None
    while True:
        try:
            res = client.conversations_list(types=conv_types, limit=200, cursor=cursor)
        except SlackApiError as e:
            # e.response contains structured data
            err = getattr(e.response, 'data', None) or getattr(e.response, 'body', None) or str(e)
            print("conversations.list failed:", err)
            print("If you see 'not_allowed_token_type' the token provided is the wrong type (xapp- instead of xoxb-).")
            print("Ensure SLACK_BOT_TOKEN is a bot token (xoxb-/xoxe-) and not an App-Level token (xapp-).")
            break
        if not res.get("ok"):
            print("conversations.list failed:", res)
            break
        channels.extend(res.get("channels", []))
        cursor = res.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    total_messages = 0
    written = 0
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        for ch in channels:
            ch_id = ch.get("id")
            ch_name = ch.get("name") or ch.get("name_normalized") or ""
            # fetch history
            c = None
            while True:
                try:
                    res = client.conversations_history(channel=ch_id, limit=min(200, limit), cursor=c)
                except SlackApiError as e:
                    err = getattr(e.response, 'data', None) or getattr(e.response, 'body', None) or str(e)
                    print(f"conversations.history failed for {ch_id}:", err)
                    print("Make sure the bot has the conversations.history/conversations:read scopes and is a member of private channels if needed.")
                    break
                if not res.get("ok"):
                    print(f"conversations.history failed for {ch_id}:", res)
                    break
                msgs = res.get("messages", [])
                for m in msgs:
                    total_messages += 1
                    out = {
                        "platform": "slack",
                        "channel_id": ch_id,
                        "channel_name": ch_name,
                        "ts": m.get("ts"),
                        "user_hash": hash_user(m.get("user") or (m.get("user_profile") or {}).get("id")),
                        "text": m.get("text"),
                        "raw": m,
                    }
                    fh.write(json.dumps(out, ensure_ascii=False) + "\n")
                    written += 1
                c = res.get("response_metadata", {}).get("next_cursor")
                break  # we only fetch one page per channel (limit param)

    print(f"Channels scanned: {len(channels)}; messages found: {total_messages}; written: {written}")
    print(f"NDJSON saved to: {OUT_FILE}")


if __name__ == "__main__":
    limit = 50
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except Exception:
            pass
    fetch_recent_messages(limit=limit)
#!/usr/bin/env python3
"""
Simple Slack extractor supporting mock-mode (read export JSON) and api-mode (uses slack_sdk).
Writes NDJSON records to an output file.

Usage:
  python tools/slack_extract.py --mode mock --mock-path tests/mock/slack_export.json --out out/slack_messages.ndjson
  python tools/slack_extract.py --mode api --token $SLACK_BOT_TOKEN --out out/slack_messages.ndjson
"""
import os
import json
import time
import argparse
from dotenv import load_dotenv

# Load .env automatically if present
load_dotenv()

def extract_from_mock(path="tests/mock/slack_export.json", out_path="out/slack_messages.ndjson"):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(path, "r", encoding="utf-8") as f_in, open(out_path, "a", encoding="utf-8") as f_out:
        data = json.load(f_in)
        for ch in data.get("channels", []):
            for msg in ch.get("messages", []):
                record = {
                    "platform": "slack",
                    "team": data.get("team"),
                    "channel_id": ch.get("id"),
                    "channel_name": ch.get("name"),
                    "message": msg,
                }
                f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
    print("Mock Slack extraction done. Wrote to", out_path)


def extract_from_api(token, out_path="out/slack_messages.ndjson"):
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except Exception as e:
        raise SystemExit("slack_sdk is required for api mode. Install with `pip install slack_sdk`")

    client = WebClient(token=token)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    cursor = None
    while True:
        try:
            res = client.conversations_list(limit=200, cursor=cursor)
            channels = res.get("channels", [])
            for ch in channels:
                ch_id = ch.get("id")
                next_c = None
                while True:
                    h = client.conversations_history(channel=ch_id, cursor=next_c, limit=200)
                    messages = h.get("messages", [])
                    with open(out_path, "a", encoding="utf-8") as f_out:
                        for m in messages:
                            record = {
                                "platform": "slack",
                                "channel_id": ch_id,
                                "channel_name": ch.get("name"),
                                "message": m,
                            }
                            f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
                    next_c = h.get("response_metadata", {}).get("next_cursor")
                    if not next_c:
                        break
            cursor = res.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
        except SlackApiError as e:
            err = getattr(e, "response", {}).get("error")
            print("Slack API error:", err)
            time.sleep(5)
            continue


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["mock", "api"], default="mock")
    p.add_argument("--token", default=os.getenv("SLACK_BOT_TOKEN"))
    p.add_argument("--mock-path", default="tests/mock/slack_export.json")
    p.add_argument("--out", default="out/slack_messages.ndjson")
    args = p.parse_args()
    if args.mode == "mock":
        extract_from_mock(args.mock_path, args.out)
    else:
        if not args.token:
            raise SystemExit("Provide SLACK_BOT_TOKEN or use mock mode.")
        extract_from_api(args.token, args.out)
