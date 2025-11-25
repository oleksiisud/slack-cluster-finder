"""
Slack API service for fetching messages from Slack workspace
"""
import requests
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class SlackService:
    """Service for interacting with Slack API"""
    
    def __init__(self, user_token: str):
        """
        Initialize Slack service with user token
        
        Args:
            user_token: Slack user token with appropriate scopes
        """
        self.headers = {"Authorization": f"Bearer {user_token}"}
        self.base_url = "https://slack.com/api"
    
    def test_connection(self) -> Dict:
        """
        Test Slack API connection
        
        Returns:
            Dict with connection status and user info
        """
        try:
            response = requests.get(
                f"{self.base_url}/auth.test",
                headers=self.headers
            )
            data = response.json()
            
            if data.get('ok'):
                return {
                    "ok": True,
                    "user": data.get('user'),
                    "team": data.get('team'),
                    "user_id": data.get('user_id')
                }
            else:
                return {
                    "ok": False,
                    "error": data.get('error', 'Unknown error')
                }
        except Exception as e:
            logger.error(f"Error testing Slack connection: {e}")
            return {
                "ok": False,
                "error": str(e)
            }
    
    def get_channels(self) -> List[Dict]:
        """
        Retrieve all public channels from the Slack workspace.
        
        Returns:
            List of channel objects with full metadata (id, name, etc.)
        """
        url = f"{self.base_url}/conversations.list"
        params = {
            "types": "public_channel",
            "limit": 1000
        }
        
        all_channels = []
        cursor = None
        
        # Handle pagination
        while True:
            if cursor:
                params["cursor"] = cursor
            
            try:
                response = requests.get(url, headers=self.headers, params=params)
                data = response.json()
                
                if not data.get("ok"):
                    logger.error(f"Error fetching channels: {data.get('error')}")
                    return all_channels
                
                all_channels.extend(data.get("channels", []))
                
                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
            except Exception as e:
                logger.error(f"Exception fetching channels: {e}")
                break
        
        return all_channels
    
    def get_private_channels(self) -> List[Dict]:
        """
        Get all private channels the user is a member of.
        
        Returns:
            List of private channel objects with full metadata (id, name, etc.)
        """
        url = f"{self.base_url}/conversations.list"
        params = {
            "types": "private_channel",
            "limit": 1000
        }
        
        all_private = []
        cursor = None
        
        # Handle pagination
        while True:
            if cursor:
                params["cursor"] = cursor
            
            try:
                response = requests.get(url, headers=self.headers, params=params)
                data = response.json()
                
                if not data.get("ok"):
                    logger.error(f"Error fetching private channels: {data.get('error')}")
                    return all_private
                
                all_private.extend(data.get("channels", []))
                
                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
            except Exception as e:
                logger.error(f"Exception fetching private channels: {e}")
                break
        
        return all_private
    
    def get_direct_messages(self) -> List[Dict]:
        """
        Retrieve ALL Direct Messages (DMs) for the authenticated user.
        Gets all DM conversations and all messages from each conversation.
        
        Returns:
            List of all DM message objects from all conversations
        """
        # First, get all DM conversations
        url = f"{self.base_url}/conversations.list"
        params = {
            "types": "im",  # 'im' = instant message (DM)
            "limit": 1000
        }
        
        all_dms = []
        cursor = None
        
        # Get all DM conversations with pagination
        while True:
            if cursor:
                params["cursor"] = cursor
            
            try:
                response = requests.get(url, headers=self.headers, params=params)
                data = response.json()
                
                if not data.get("ok"):
                    logger.error(f"Error fetching DM conversations: {data.get('error')}")
                    return []
                
                all_dms.extend(data.get("channels", []))
                
                cursor = data.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
            except Exception as e:
                logger.error(f"Exception fetching DM conversations: {e}")
                return []
        
        # Now get all messages from each DM conversation
        all_messages = []
        
        for dm in all_dms:
            dm_id = dm.get('id')
            
            # Get all messages from this DM
            history_url = f"{self.base_url}/conversations.history"
            history_params = {
                "channel": dm_id,
                "limit": 1000
            }
            
            history_cursor = None
            
            while True:
                if history_cursor:
                    history_params["cursor"] = history_cursor
                
                try:
                    response = requests.get(history_url, headers=self.headers, params=history_params)
                    data = response.json()
                    
                    if not data.get("ok"):
                        break
                    
                    messages = data.get("messages", [])
                    # Add channel ID to each message for context
                    for msg in messages:
                        msg['channel'] = dm_id
                    all_messages.extend(messages)
                    
                    history_cursor = data.get("response_metadata", {}).get("next_cursor")
                    if not history_cursor:
                        break
                except Exception as e:
                    logger.error(f"Exception fetching DM messages: {e}")
                    break
        
        return all_messages
    
    def all_messages_from_channels_to_list(self, channels: List[Dict], include_permalinks: bool = True) -> List[Dict]:
        """
        Convert all messages from a list of channels to a structured list format.
        
        Args:
            channels: List of channel objects OR list of message objects (for DMs)
            include_permalinks: Whether to fetch permalinks (slower but provides links)
        
        Returns:
            List of formatted message dictionaries with channel info and permalink
        """
        all_formatted_messages = []
        
        if not channels:
            return all_formatted_messages
        
        # Check if this is a list of message objects (DMs) or channel objects
        if 'text' in channels[0]:
            # This is already a list of messages (from getDirectMessages)
            for msg in channels:
                formatted_msg = {
                    "channel_name": "DM",
                    "channel_id": msg.get('channel', 'unknown'),
                    "text": msg.get('text', ''),
                    "user": msg.get('user', 'unknown'),
                    "message_link": None  # DM permalinks would need channel context
                }
                all_formatted_messages.append(formatted_msg)
        else:
            # This is a list of channel objects
            for channel in channels:
                channel_id = channel.get('id')
                channel_name = channel.get('name', 'unknown')
                
                # Get all messages from this channel
                history_url = f"{self.base_url}/conversations.history"
                history_params = {
                    "channel": channel_id,
                    "limit": 1000
                }
                
                cursor = None
                
                while True:
                    if cursor:
                        history_params["cursor"] = cursor
                    
                    try:
                        response = requests.get(history_url, headers=self.headers, params=history_params)
                        data = response.json()
                        
                        if not data.get("ok"):
                            break
                        
                        messages = data.get("messages", [])
                        
                        # Format each message
                        for msg in messages:
                            msg_ts = msg.get('ts')
                            message_link = None
                            
                            # Get permalink (optional, can be slow)
                            if include_permalinks and msg_ts:
                                permalink_url = f"{self.base_url}/chat.getPermalink"
                                permalink_params = {
                                    "channel": channel_id,
                                    "message_ts": msg_ts
                                }
                                
                                try:
                                    permalink_response = requests.get(
                                        permalink_url, 
                                        headers=self.headers, 
                                        params=permalink_params
                                    )
                                    permalink_data = permalink_response.json()
                                    message_link = permalink_data.get("permalink") if permalink_data.get("ok") else None
                                except Exception as e:
                                    logger.warning(f"Failed to get permalink: {e}")
                            
                            formatted_msg = {
                                "channel_name": channel_name,
                                "channel_id": channel_id,
                                "text": msg.get('text', ''),
                                "user": msg.get('user', 'unknown'),
                                "message_link": message_link
                            }
                            all_formatted_messages.append(formatted_msg)
                        
                        cursor = data.get("response_metadata", {}).get("next_cursor")
                        if not cursor:
                            break
                    except Exception as e:
                        logger.error(f"Exception fetching channel messages: {e}")
                        break
        
        return all_formatted_messages
    
    def fetch_all_messages(self, 
                          include_public: bool = True,
                          include_private: bool = True, 
                          include_dms: bool = False,
                          include_permalinks: bool = False) -> List[Dict]:
        """
        Fetch all messages from Slack workspace based on options.
        
        Args:
            include_public: Include public channels
            include_private: Include private channels
            include_dms: Include direct messages
            include_permalinks: Include message permalinks (slower)
        
        Returns:
            List of all formatted messages
        """
        all_messages = []
        
        logger.info(f"Fetching Slack messages (public={include_public}, private={include_private}, dms={include_dms})")
        
        if include_public:
            logger.info("Fetching public channels...")
            channels = self.get_channels()
            logger.info(f"Found {len(channels)} public channels")
            public_messages = self.all_messages_from_channels_to_list(channels, include_permalinks)
            all_messages.extend(public_messages)
            logger.info(f"Retrieved {len(public_messages)} messages from public channels")
        
        if include_private:
            logger.info("Fetching private channels...")
            private_channels = self.get_private_channels()
            logger.info(f"Found {len(private_channels)} private channels")
            private_messages = self.all_messages_from_channels_to_list(private_channels, include_permalinks)
            all_messages.extend(private_messages)
            logger.info(f"Retrieved {len(private_messages)} messages from private channels")
        
        if include_dms:
            logger.info("Fetching direct messages...")
            dm_messages = self.get_direct_messages()
            logger.info(f"Found {len(dm_messages)} DM messages")
            formatted_dms = self.all_messages_from_channels_to_list(dm_messages, include_permalinks)
            all_messages.extend(formatted_dms)
            logger.info(f"Retrieved {len(formatted_dms)} direct messages")
        
        logger.info(f"Total messages retrieved: {len(all_messages)}")
        
        return all_messages

