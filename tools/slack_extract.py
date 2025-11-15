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
