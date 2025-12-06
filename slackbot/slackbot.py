import os
import ssl
import certifi

# Fix SSL certificates for macOS
_create_default_https_context = ssl.create_default_context
ssl._create_default_https_context = lambda *args, **kwargs: _create_default_https_context(cafile=certifi.where(), *args, **kwargs)

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv

load_dotenv()
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN')
SLACK_APP_TOKEN = os.getenv('SLACK_APP_TOKEN')

app = App(token=SLACK_BOT_TOKEN)

@app.event("message")
def handle_message(event, say):
    if 'text' in event and 'hello' in event['text'].lower():
        say("Hello from SlackBot!")

if __name__ == "__main__":
    print("Starting Slack bot...")
    handler = SocketModeHandler(app, SLACK_APP_TOKEN)
    print("Slack bot connected!")
    handler.start()
