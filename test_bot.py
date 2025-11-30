import os
import ssl
import certifi
import discord
import aiohttp
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_BOT_TOKEN')

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True

# Custom client class that creates SSL context properly
class MyClient(discord.Client):
    async def setup_hook(self):
        # Create SSL context with certifi certificates
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        # Create custom connector with our SSL context
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        # Replace the default connector
        self.http.connector = connector

client = MyClient(intents=intents)

@client.event
async def on_ready():
    print(f'✅ SUCCESS! Logged in as {client.user}')
    print(f'Bot ID: {client.user.id}')
    print(f'Guilds: {len(client.guilds)}')
    await client.close()

try:
    print("Attempting to connect with custom SSL context...")
    print(f"Using certificates from: {certifi.where()}")
    client.run(TOKEN)
except discord.LoginFailure:
    print("❌ INVALID TOKEN - Reset your token in Discord Developer Portal")
except discord.PrivilegedIntentsRequired as e:
    print(f"❌ MISSING INTENTS - Enable these in Discord Developer Portal:")
    print(f"   {e}")
except Exception as e:
    print(f"❌ Connection Error: {e}")
