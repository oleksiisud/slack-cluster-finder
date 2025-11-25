import os
import json
import hashlib
import asyncio
import requests
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
FORWARD_URL = os.getenv('FORWARD_URL')  # e.g. http://localhost:8000/webhook/discord
FORWARD_SECRET = os.getenv('FORWARD_SECRET')
HASH_SALT = os.getenv('HASH_SALT', 'dev-salt')

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


def hash_user(user_id: str) -> str:
    h = hashlib.sha256()
    h.update(HASH_SALT.encode('utf-8'))
    h.update(user_id.encode('utf-8'))
    return h.hexdigest()


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")


@bot.event
async def on_message(message: discord.Message):
    # ignore bot messages and self
    if message.author.bot:
        return

    user_id = str(message.author.id)
    user_hash = hash_user(user_id)
    channel_id = str(message.channel.id)
    content = message.content
    timestamp = message.created_at.isoformat()

    payload = {
        "platform": "discord",
        "channel_id": channel_id,
        "user_id": user_id,
        "content": content,
        "timestamp": timestamp,
        "raw": {
            "id": str(message.id),
            "author": {"id": user_id, "name": message.author.name},
        },
    }

    # Forward to webhook if configured, otherwise attempt to call backend.database directly
    if FORWARD_URL:
        headers = {"Content-Type": "application/json"}
        if FORWARD_SECRET:
            headers["X-Forward-Secret"] = FORWARD_SECRET
        # fire-and-forget using thread-safe requests in executor
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: requests.post(FORWARD_URL, json=payload, headers=headers, timeout=5))
    else:
        # call backend.database locally (best-effort)
        try:
            from backend import database
            database.insert_message(channel_id=channel_id, user_hash=user_hash, content=content, timestamp=timestamp, metadata={"raw": payload["raw"]})
        except Exception:
            pass

    # allow commands to be processed as well
    await bot.process_commands(message)


@bot.command()
async def hello(ctx):
    await ctx.send("Hello from DiscordBot!")


@bot.command()
async def ping(ctx):
    await ctx.send("Pong!")


@bot.command()
async def greet(ctx, name: str):
    await ctx.send(f"Hello, {name}!")


if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
