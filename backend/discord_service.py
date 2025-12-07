"""
Discord API service for fetching messages from Discord servers
"""
import requests
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class DiscordService:
    """Service for interacting with Discord API"""
    
    def __init__(self, access_token: str):
        """
        Initialize Discord service with access token
        
        Args:
            access_token: Discord OAuth access token
        """
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        self.base_url = "https://discord.com/api/v10"
    
    def test_connection(self) -> Dict:
        """
        Test Discord API connection
        
        Returns:
            Dict with connection status and user info
        """
        try:
            response = requests.get(
                f"{self.base_url}/users/@me",
                headers=self.headers
            )
            data = response.json()
            
            if response.status_code == 200:
                return {
                    "ok": True,
                    "user": data.get('username'),
                    "user_id": data.get('id'),
                    "discriminator": data.get('discriminator')
                }
            else:
                return {
                    "ok": False,
                    "error": data.get('message', 'Unknown error')
                }
        except Exception as e:
            logger.error(f"Error testing Discord connection: {e}")
            return {
                "ok": False,
                "error": str(e)
            }
    
    def get_guilds(self) -> List[Dict]:
        """
        Get all guilds (servers) the user has access to
        
        Returns:
            List of guild objects
        """
        try:
            response = requests.get(
                f"{self.base_url}/users/@me/guilds",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get guilds: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error getting guilds: {e}")
            return []
    
    def get_guild_channels(self, guild_id: str) -> List[Dict]:
        """
        Get all channels in a guild
        
        Args:
            guild_id: Discord guild ID
            
        Returns:
            List of channel objects
        """
        try:
            response = requests.get(
                f"{self.base_url}/guilds/{guild_id}/channels",
                headers=self.headers
            )
            
            if response.status_code == 200:
                # Filter for text channels only
                channels = response.json()
                return [ch for ch in channels if ch.get('type') in [0, 5]]  # 0 = text, 5 = announcement
            else:
                logger.error(f"Failed to get channels: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error getting channels: {e}")
            return []
    
    def get_channel_messages(
        self, 
        channel_id: str, 
        limit: int = 100,
        before: Optional[str] = None
    ) -> List[Dict]:
        """
        Get messages from a channel
        
        Args:
            channel_id: Discord channel ID
            limit: Number of messages to retrieve (max 100)
            before: Get messages before this message ID
            
        Returns:
            List of message objects
        """
        try:
            params = {"limit": min(limit, 100)}
            if before:
                params["before"] = before
            
            response = requests.get(
                f"{self.base_url}/channels/{channel_id}/messages",
                headers=self.headers,
                params=params
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get messages: {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []
    
    def fetch_all_messages(
        self,
        guild_ids: Optional[List[str]] = None,
        channel_ids: Optional[List[str]] = None,
        max_messages_per_channel: int = 1000
    ) -> List[Dict]:
        """
        Fetch messages from specified guilds or channels
        
        Args:
            guild_ids: List of guild IDs to fetch from (if None, fetch from all)
            channel_ids: List of specific channel IDs (overrides guild_ids if provided)
            max_messages_per_channel: Maximum messages to fetch per channel
            
        Returns:
            List of formatted messages
        """
        all_messages = []
        
        # If specific channels provided, use those
        if channel_ids:
            channels_to_fetch = [{"id": ch_id, "name": f"Channel-{ch_id}"} for ch_id in channel_ids]
        else:
            # Otherwise get channels from guilds
            guilds = self.get_guilds()
            if guild_ids:
                guilds = [g for g in guilds if g['id'] in guild_ids]
            
            channels_to_fetch = []
            for guild in guilds:
                guild_channels = self.get_guild_channels(guild['id'])
                for channel in guild_channels:
                    channel['guild_name'] = guild.get('name', 'Unknown')
                channels_to_fetch.extend(guild_channels)
        
        # Fetch messages from each channel
        for channel in channels_to_fetch:
            channel_id = channel['id']
            channel_name = channel.get('name', 'Unknown')
            guild_name = channel.get('guild_name', 'Unknown')
            
            logger.info(f"Fetching messages from #{channel_name} in {guild_name}")
            
            messages = []
            last_message_id = None
            
            while len(messages) < max_messages_per_channel:
                batch = self.get_channel_messages(
                    channel_id,
                    limit=100,
                    before=last_message_id
                )
                
                if not batch:
                    break
                
                messages.extend(batch)
                last_message_id = batch[-1]['id']
                
                if len(batch) < 100:  # No more messages
                    break
            
            # Format messages
            for msg in messages[:max_messages_per_channel]:
                if msg.get('content'):  # Skip empty messages
                    formatted_msg = {
                        'text': msg['content'],
                        'channel': channel_name,
                        'guild': guild_name,
                        'user': msg['author'].get('username', 'Unknown'),
                        'user_id': msg['author'].get('id'),
                        'timestamp': msg['timestamp'],
                        'message_id': msg['id']
                    }
                    all_messages.append(formatted_msg)
        
        logger.info(f"Fetched {len(all_messages)} total messages from Discord")
        return all_messages


def get_discord_service(access_token: str) -> DiscordService:
    """Factory function to create Discord service instance"""
    return DiscordService(access_token)
