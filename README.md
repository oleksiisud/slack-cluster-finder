# 🖥️ Slack Cluster Finder — Frontend

The **Frontend Folder** is a the development of the frontend for **Slack Cluster Finder**, which is React-based web application that allows users to analyze and visualize patterns within Slack channels.  

* **Destiny Rosado Salcedo** \- Frontend Developer  
* **Faizan Khan** \- Slackbot Developer
* **Jessica Chen** \- Backend Developer  
* **Oleksii Sudarin** \- Cluster Graph Developer
* **Eric Azayev** \- User Stories/UI/UX

**Note:** This is not the final product and will be further developed.

---

## ⚙️ Requirements

Before running the frontend locally, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher) or **yarn**
- **Git**

To check your versions:
```bash
node -v
npm -v
```

Once you clone the repository:
```bash
cd frontend 
npm run dev
```


- Anyone who uses Slack or Discord and takes parts in servers  
- For big servers where there are too many materials for someone to shift through

---

## Bot Folder Structure

- Discord bot code: `discordbot/discordbot.py`
- Slack bot code: `slackbot/slackbot.py`

## Running the Discord Bot
```bash
cd discordbot
python3 discordbot.py
```

## Running the Slack Bot
```bash
cd ../slackbot
python3 slackbot.py
```

## Environment Variables
Keep your `.env` file in the project root. Both bots will load it automatically.

## Adding Commands
- For Discord: Edit `discordbot/discordbot.py` and add more `@bot.command()` functions.
- For Slack: Edit `slackbot/slackbot.py` and add more logic to `handle_message`.

---

## Slack & Discord Bot Setup

### Prerequisites
- Python 3.8+
- Create a Slack App and a Discord Application (Bot) via their developer portals
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
SLACK_BOT_TOKEN=your-slack-bot-token
DISCORD_BOT_TOKEN=your-discord-bot-token
```

### Running the Slack Bot
```bash
python slackbot.py
```

### Running the Discord Bot
```bash
python discordbot.py
```

### Customization
- Edit `slackbot.py` and `discordbot.py` to add more commands or logic.

### Useful Links
- Slack API: https://api.slack.com/apps
- Discord Developer Portal: https://discord.com/developers/applications
