from slack_sdk import WebClient
from datetime import datetime
import json, os
from dotenv import load_dotenv

load_dotenv()

# this is where we will place the users slack bot token
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN')
client = WebClient(token=SLACK_BOT_TOKEN)

# this is our channel ID, replace with your desired channel
channel_id = 'C09FYL8JDDY'

def get_user_map():
    """Return a dictionary mapping user IDs to usernames."""
    user_map = {}
    cursor = None

    while True:
        response = client.users_list(cursor=cursor)
        if not response["ok"]:
            print("Error fetching users:", response["error"])
            break

        for member in response["members"]:
            user_map[member["id"]] = member["name"]

        cursor = response.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    return user_map

def export_channel_messages(channel_id, filename="messages.json"):
    """Export messages from a given channel in compact, single-line format."""
    all_messages = []
    cursor = None
    user_map = get_user_map()

    # Get channel name for readability
    channel_info = client.conversations_info(channel=channel_id)
    channel_name = channel_info["channel"]["name"]

    while True:
        response = client.conversations_history(channel=channel_id, cursor=cursor, limit=200)
        if not response["ok"]:
            print("Error:", response["error"])
            break

        for m in response["messages"]:
            if "text" in m:
                user_id = m.get("user", "unknown")
                username = user_map.get(user_id, user_id)

                # fetch permalink for the message
                permalink = None
                try:
                    perm_resp = client.chat_getPermalink(channel=channel_id, message_ts=m["ts"])
                    if perm_resp.get("ok"):
                        permalink = perm_resp.get("permalink")
                except Exception as e:
                    # keep going if permalink fetch fails
                    print("Permalink error for ts", m.get("ts"), ":", e)

                all_messages.append({
                    "text": m["text"],
                    "channel": channel_name,
                    "user": username,
                    "timestamp": datetime.fromtimestamp(float(m["ts"].split(".")[0])).strftime("%Y-%m-%d %H:%M"),
                    "permalink": permalink
                })

        cursor = response.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    # Write as inline JSON objects separated by commas
    with open(filename, "w") as f:
        for i, msg in enumerate(all_messages):
            json.dump(msg, f, ensure_ascii=False)
            if i < len(all_messages) - 1:
                f.write(",\n")

    print(f"✅ Exported {len(all_messages)} messages from #{channel_name} to {filename}")

if __name__ == "__main__":
    export_channel_messages(channel_id)
