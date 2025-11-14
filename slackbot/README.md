- Anyone who uses Slack or Discord and takes parts in servers  
- For big servers where there are too many materials for someone to shift through

---

## Bot Folder Structure

- Slack bot code: `slackbot/slackbot.py`

## Running the Slack Bot
```bash
cd ../slackbot
python3 slackbot.py
```

## Environment Variables
Keep your `.env` file in the project root. Both bots will load it automatically.

## Adding Commands
- For Slack: Edit `slackbot/slackbot.py` and add more logic to `handle_message`.

---

## Slack Bot Setup

### Prerequisites
- Python 3.8+
- Create a Slack Application (Bot) via their developer portals
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
```

### Running the Slack Bot
```bash
python slackbot.py
```

### Customization
- Edit `slackbot.py` to add more commands or logic.

### Useful Links
- Slack API: https://api.slack.com/apps

