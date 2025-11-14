- Anyone who uses Slack or Discord and takes parts in servers  
- For big servers where there are too many materials for someone to shift through

---

## Bot Folder Structure

- Discord bot code: `discordbot/discordbot.py`

## Running the Discord Bot
```bash
cd discordbot
python3 discordbot.py
```


## Environment Variables
Keep your `.env` file in the project root. Both bots will load it automatically.

## Adding Commands
- For Discord: Edit `discordbot/discordbot.py` and add more `@bot.command()` functions.

---

## Discord Bot Setup

### Prerequisites
- Python 3.8+
- Create a Discord Application (Bot) via their developer portals
- Copy your bot tokens into a `.env` file (see `.env.example`)

### Installation
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables
Create a `.env` file and add your tokens:
```
DISCORD_BOT_TOKEN=your-discord-bot-token
```

### Running the Discord Bot
```bash
python discordbot.py
```

### Customization
- Edit `discordbot.py` to add more commands or logic.

### Useful Links
- Discord Developer Portal: https://discord.com/developers/applications
