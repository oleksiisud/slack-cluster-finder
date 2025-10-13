import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")

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
