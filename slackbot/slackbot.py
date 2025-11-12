import os
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv

load_dotenv()
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN')
SLACK_APP_TOKEN = os.getenv('SLACK_APP_TOKEN')  # You need to add this to your .env

app = App(token=SLACK_BOT_TOKEN)

@app.event("message")
def handle_message(event, say):
    if 'text' in event and 'hello' in event['text'].lower():
        say("Hello from SlackBot!")

if __name__ == "__main__":
    handler = SocketModeHandler(app, SLACK_APP_TOKEN)
    handler.start()
