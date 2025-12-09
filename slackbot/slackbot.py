import os
import ssl
import certifi

# Fix SSL certificates for macOS
_create_default_https_context = ssl.create_default_context
ssl._create_default_https_context = lambda *args, **kwargs: _create_default_https_context(cafile=certifi.where(), *args, **kwargs)

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from backend.utils import hash_user_id, extract_metadata_from_slack
from backend import database

load_dotenv()
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN')
SLACK_APP_TOKEN = os.getenv('SLACK_APP_TOKEN')

app = App(token=SLACK_BOT_TOKEN)


@app.event("message")
def handle_message(event, say):
    """Handle Slack message events: store message metadata and respond to admin commands.

    Avoid logging message content.
    """
    try:
        user = event.get("user")
        if not user:
            return
        user_hash = hash_user_id(user)
        channel_id = event.get("channel")
        timestamp = datetime.utcfromtimestamp(float(event.get("ts", 0))).isoformat()
        metadata = extract_metadata_from_slack(event)
        # store channel if needed
        try:
            database.insert_channel_if_not_exists(channel_id, event.get("channel"), "slack")
            database.insert_message(channel_id, user_hash, event.get("text", ""), timestamp, metadata)
        except Exception as e:
            LOGGER.exception("DB insert failed: %s", e)

        text = event.get("text", "") or ""
        if text.strip().startswith("!cleanup"):
            # run cleanup (fire-and-forget)
            try:
                count = database.cleanup_old_messages(90)
                say(f"Cleanup completed. Removed {count} messages older than 90 days.")
            except Exception as e:
                LOGGER.exception("Cleanup failed: %s", e)
                say("Cleanup failed; check logs.")
        elif text.strip().startswith("!retention_status"):
            try:
                status = database.get_retention_status()
                say(f"Retention status: total={status.get('total')} older_than_90={status.get('older_than_90_days')}")
            except Exception as e:
                LOGGER.exception("Retention status failed: %s", e)
                say("Could not fetch retention status; check logs.")
        elif text.strip().startswith("!mydata"):
            try:
                rows = database.export_user_data(user_hash)
                # send as a file (Slack requires files.upload) — keep simple: post a confirmation
                say("Your data export was prepared. Please use the web interface to download your data (not implemented).")
            except Exception as e:
                LOGGER.exception("mydata failed: %s", e)
                say("Could not export your data; check logs.")
        elif text.strip().startswith("!deletemydata"):
            try:
                deleted = database.delete_user_messages(user_hash)
                say(f"Deleted {deleted} messages associated with your account.")
            except Exception as e:
                LOGGER.exception("deletemydata failed: %s", e)
                say("Could not delete your data; check logs.")
    except Exception as e:
        LOGGER.exception("Error handling Slack message: %s", e)


if __name__ == "__main__":
    print("Starting Slack bot...")
    handler = SocketModeHandler(app, SLACK_APP_TOKEN)
    print("Slack bot connected!")
    handler.start()
