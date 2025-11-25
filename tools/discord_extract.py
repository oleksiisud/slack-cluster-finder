#!/usr/bin/env python3
"""Simple Discord extractor using REST API for channels provided in DISCORD_CHANNELS.

Reads DISCORD_CHANNELS as comma-separated channel IDs from env. Writes NDJSON to out/discord_messages.ndjson.

Usage: source .env; python3 tools/discord_extract.py
"""
from __future__ import annotations

import json
import os
import sys
import hashlib
from typing import Optional

try:
    import requests
except Exception:
    print("requests not installed. Install with: pip install requests")
    raise

HASH_SALT = os.getenv("HASH_SALT", "dev-salt")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DISCORD_CHANNELS = os.getenv("DISCORD_CHANNELS", "")

OUT_DIR = "out"
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, "discord_messages.ndjson")


def hash_user(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    h = hashlib.sha256()
    h.update(HASH_SALT.encode("utf-8"))
    h.update(user_id.encode("utf-8"))
    return h.hexdigest()


def fetch_channel_messages(channel_id: str, limit: int = 50):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    headers = {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
    params = {"limit": limit}
    r = requests.get(url, headers=headers, params=params)
    if r.status_code != 200:
        print(f"Failed to fetch channel {channel_id}: {r.status_code} {r.text}")
        return []
    return r.json()


def main():
    if not DISCORD_BOT_TOKEN:
        print("DISCORD_BOT_TOKEN not set in environment. Aborting.")
        sys.exit(1)
    if not DISCORD_CHANNELS:
        print("DISCORD_CHANNELS not set. Set a comma-separated list of channel IDs in .env to extract.")
        sys.exit(1)

    channels = [c.strip() for c in DISCORD_CHANNELS.split(",") if c.strip()]
    total = 0
    written = 0
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        for ch in channels:
            msgs = fetch_channel_messages(ch, limit=50)
            for m in msgs:
                total += 1
                out = {
                    "platform": "discord",
                    "channel_id": ch,
                    "id": m.get("id"),
                    "timestamp": m.get("timestamp"),
                    "user_hash": hash_user((m.get("author") or {}).get("id")),
                    "content": m.get("content"),
                    "raw": m,
                }
                fh.write(json.dumps(out, ensure_ascii=False) + "\n")
                written += 1

    print(f"Channels scanned: {len(channels)}; messages found: {total}; written: {written}")
    print(f"NDJSON saved to: {OUT_FILE}")


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Discord extractor supporting mock-mode (read export JSON) and api-mode (uses discord.py)
Writes NDJSON records to an output file.

Usage:
  python tools/discord_extract.py --mode mock --mock-path tests/mock/discord_export.json --out out/discord_messages.ndjson
  python tools/discord_extract.py --mode api --token $DISCORD_BOT_TOKEN --out out/discord_messages.ndjson
"""
import os
import json
import argparse
from dotenv import load_dotenv

# Load .env automatically if present
load_dotenv()

def extract_from_mock(path="tests/mock/discord_export.json", out_path="out/discord_messages.ndjson"):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(path, "r", encoding="utf-8") as f_in, open(out_path, "a", encoding="utf-8") as f_out:
        data = json.load(f_in)
        for g in data.get("guilds", []):
            for ch in g.get("channels", []):
                for m in ch.get("messages", []):
                    record = {
                        "platform": "discord",
                        "guild_id": g.get("id"),
                        "guild_name": g.get("name"),
                        "channel_id": ch.get("id"),
                        "channel_name": ch.get("name"),
                        "message": m,
                    }
                    f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
    print("Mock Discord extraction done. Wrote to", out_path)


async def _extract_from_api_async(token, out_path="out/discord_messages.ndjson"):
    try:
        import discord
    except Exception:
        raise SystemExit("discord.py is required for api mode. Install with `pip install discord.py`")

    intents = discord.Intents.default()
    intents.guilds = True
    intents.messages = True
    # message_content is privileged and needs to be enabled in dev portal
    intents.message_content = True

    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        print(f"Logged in as {client.user}")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "a", encoding="utf-8") as f_out:
            for guild in client.guilds:
                for channel in getattr(guild, "text_channels", []):
                    try:
                        async for msg in channel.history(limit=None):
                            record = {
                                "platform": "discord",
                                "guild_id": guild.id,
                                "guild_name": guild.name,
                                "channel_id": channel.id,
                                "channel_name": channel.name,
                                "message": {
                                    "id": msg.id,
                                    "author_id": getattr(msg.author, "id", None),
                                    "author_name": str(msg.author),
                                    "content": msg.content,
                                    "created_at": msg.created_at.isoformat(),
                                    "edited_at": (msg.edited_at.isoformat() if msg.edited_at else None),
                                    "attachments": [a.url for a in msg.attachments],
                                }
                            }
                            f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
                    except Exception as e:
                        print("Skipping channel", getattr(channel, "name", channel), "error:", e)
        await client.close()

    await client.start(token)


def extract_from_api(token, out_path="out/discord_messages.ndjson"):
    import asyncio
    asyncio.run(_extract_from_api_async(token, out_path))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["mock", "api"], default="mock")
    p.add_argument("--token", default=os.getenv("DISCORD_BOT_TOKEN"))
    p.add_argument("--mock-path", default="tests/mock/discord_export.json")
    p.add_argument("--out", default="out/discord_messages.ndjson")
    args = p.parse_args()
    if args.mode == "mock":
        extract_from_mock(args.mock_path, args.out)
    else:
        if not args.token:
            raise SystemExit("Provide DISCORD_BOT_TOKEN or use mock mode.")
        extract_from_api(args.token, args.out)
