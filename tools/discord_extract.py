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
