import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

from backend.utils import hash_user_id, extract_metadata_from_discord
from backend import database

load_dotenv()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    LOGGER.info("Logged in as %s", bot.user)


@bot.event
async def on_message(message: discord.Message) -> None:
    """Handle incoming messages: store metadata and process commands.

    This function intentionally avoids logging message contents.
    """
    # ignore bot messages
    if message.author.bot:
        return

    try:
        user_hash = hash_user_id(str(message.author.id))
        channel_id = str(message.channel.id)
        timestamp = message.created_at.isoformat()
        metadata = extract_metadata_from_discord(message)
        # Store message; content stored but not logged
        try:
            await asyncio.get_event_loop().run_in_executor(None, database.insert_channel_if_not_exists, channel_id, str(message.channel), "discord")
            await asyncio.get_event_loop().run_in_executor(None, database.insert_message, channel_id, user_hash, message.content, timestamp, metadata)
        except Exception as e:
            LOGGER.exception("DB insert failed: %s", e)
    except Exception:
        LOGGER.exception("Error processing message metadata")

    await bot.process_commands(message)


def is_admin(ctx: commands.Context) -> bool:
    """Return True if the command invoker is an administrator in the guild."""
    try:
        return ctx.author.guild_permissions.administrator
    except Exception:
        return False


@bot.command()
@commands.check(lambda ctx: is_admin(ctx))
async def cleanup(ctx: commands.Context) -> None:
    """Run retention cleanup (admin only)."""
    await ctx.send("Starting cleanup job...")
    try:
        count = await asyncio.get_event_loop().run_in_executor(None, database.cleanup_old_messages, 90)
        await ctx.send(f"Cleanup completed. Removed {count} messages older than 90 days.")
    except Exception as e:
        LOGGER.exception("Cleanup failed: %s", e)
        await ctx.send("Cleanup failed; check logs.")



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
async def retention_status(ctx: commands.Context) -> None:
    """Return a short retention status summary."""
    try:
        status = await asyncio.get_event_loop().run_in_executor(None, database.get_retention_status)
        await ctx.send(f"Retention status: total={status.get('total')} older_than_90={status.get('older_than_90_days')}")
    except Exception as e:
        LOGGER.exception("Retention status failed: %s", e)
        await ctx.send("Could not fetch retention status; check logs.")



@bot.command()
async def mydata(ctx: commands.Context) -> None:
    """Export the requesting user's data and DM it as a JSON file."""
    try:
        user_hash = hash_user_id(str(ctx.author.id))
        rows = await asyncio.get_event_loop().run_in_executor(None, database.export_user_data, user_hash)
        # write to temp file and send as attachment
        import tempfile
        with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".json") as f:
            json.dump(rows, f, default=str)
            tmp_path = f.name
        await ctx.author.send(file=discord.File(tmp_path), content="Your exported data (JSON)")
        await ctx.send("I sent your data via DM.")
    except Exception as e:
        LOGGER.exception("mydata failed: %s", e)
        await ctx.send("Could not export your data; check logs.")



@bot.command()
async def deletemydata(ctx: commands.Context) -> None:
    """Delete the requesting user's data from storage."""
    try:
        user_hash = hash_user_id(str(ctx.author.id))
        deleted = await asyncio.get_event_loop().run_in_executor(None, database.delete_user_messages, user_hash)
        await ctx.send(f"Deleted {deleted} messages associated with your account.")
    except Exception as e:
        LOGGER.exception("deletemydata failed: %s", e)
        await ctx.send("Could not delete your data; check logs.")



if __name__ == "__main__":
    # Basic validation to fail fast with a helpful message
    if not DISCORD_BOT_TOKEN:
        LOGGER.error("DISCORD_BOT_TOKEN is not set in .env. Please set your bot token (do not share it).")
        raise SystemExit("DISCORD_BOT_TOKEN missing; see .env.example")

    try:
        bot.run(DISCORD_BOT_TOKEN)
    except Exception as exc:
        # Catch common login failure and provide actionable advice
        import discord
        if isinstance(exc, discord.errors.LoginFailure):
            LOGGER.error("Discord login failed: Improper token passed. Check that DISCORD_BOT_TOKEN is the bot token from the Developer Portal and has not been revoked.")
            raise SystemExit("Discord login failed: invalid bot token. Regenerate/reset the token in the Developer Portal and update .env")
        # Re-raise for other exceptions so traceback is visible
        LOGGER.exception("Discord bot failed to start: %s", exc)
        raise
