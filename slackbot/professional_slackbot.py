"""
Professional Slack Bot with comprehensive data collection and enterprise features
"""
import os
import ssl
import certifi
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Fix SSL certificates for macOS
_create_default_https_context = ssl.create_default_context
ssl._create_default_https_context = lambda *args, **kwargs: _create_default_https_context(cafile=certifi.where(), *args, **kwargs)

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_sdk.errors import SlackApiError
from dotenv import load_dotenv

# Import our enhanced modules
from backend.monitoring import monitor, RetryHandler, ErrorSeverity
from backend.security import TokenManager, RateLimiter, PermissionValidator
from backend import database

load_dotenv()

class ProfessionalSlackBot:
    """Enterprise-ready Slack bot with comprehensive features"""
    
    def __init__(self):
        self.token_manager = TokenManager()
        self.rate_limiter = RateLimiter()
        self.required_scopes = [
            'channels:read', 'channels:history', 'groups:read', 'groups:history',
            'im:read', 'im:history', 'mpim:read', 'mpim:history', 'chat:write',
            'users:read', 'team:read', 'files:read'
        ]
        
        # Initialize bot
        self.bot_token = os.getenv('SLACK_BOT_TOKEN')
        self.app_token = os.getenv('SLACK_APP_TOKEN')
        
        if not self.bot_token or not self.app_token:
            raise ValueError("Missing required Slack tokens")
        
        self.app = AsyncApp(token=self.bot_token)
        self.setup_handlers()
        
        # Workspace info cache
        self.workspace_info = {}
        self.channels_cache = {}
        self.users_cache = {}
        
    def setup_handlers(self):
        """Setup comprehensive event handlers"""
        
        # Message handlers
        @self.app.event("message")
        async def handle_message(event, say, logger):
            await self.process_message(event, say, logger)
        
        @self.app.event("message_changed")
        async def handle_message_changed(event, logger):
            await self.process_message_change(event, logger)
        
        @self.app.event("message_deleted") 
        async def handle_message_deleted(event, logger):
            await self.process_message_deletion(event, logger)
        
        # Channel handlers
        @self.app.event("channel_created")
        async def handle_channel_created(event, logger):
            await self.process_channel_change(event, "created", logger)
        
        @self.app.event("channel_deleted")
        async def handle_channel_deleted(event, logger):
            await self.process_channel_change(event, "deleted", logger)
        
        @self.app.event("channel_rename")
        async def handle_channel_rename(event, logger):
            await self.process_channel_change(event, "renamed", logger)
        
        # Member handlers
        @self.app.event("team_join")
        async def handle_team_join(event, logger):
            await self.process_member_change(event, "joined", logger)
        
        @self.app.event("user_change")
        async def handle_user_change(event, logger):
            await self.process_member_change(event, "changed", logger)
        
        # Commands
        @self.app.command("/cluster-status")
        async def handle_cluster_status(ack, respond, command):
            await self.handle_status_command(ack, respond, command)
        
        @self.app.command("/cluster-export")
        async def handle_cluster_export(ack, respond, command):
            await self.handle_export_command(ack, respond, command)
    
    async def process_message(self, event: Dict[str, Any], say, logger):
        """Process incoming messages with comprehensive data extraction"""
        try:
            # Skip bot messages and system messages
            if event.get("subtype") in ["bot_message", "file_comment", "thread_broadcast"]:
                return
            
            # Rate limiting check
            if not self.rate_limiter.can_make_request(self.bot_token[:10], "slack:messages"):
                logger.warning("Rate limit exceeded for message processing")
                return
            
            # Extract comprehensive message data
            message_data = await self.extract_message_data(event)
            
            # Store in database with retry
            await RetryHandler.with_retry(
                lambda: self.store_message(message_data),
                platform="slack"
            )
            
            monitor.metrics['messages_processed'] += 1
            self.rate_limiter.record_request(self.bot_token[:10], "slack:messages")
            
        except Exception as e:
            monitor.log_error("slack", e, {"event": event}, ErrorSeverity.MEDIUM)
    
    async def extract_message_data(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Extract comprehensive data from message event"""
        # Get user info
        user_id = event.get("user")
        user_info = await self.get_user_info(user_id) if user_id else {}
        
        # Get channel info
        channel_id = event.get("channel")
        channel_info = await self.get_channel_info(channel_id) if channel_id else {}
        
        # Extract thread information
        thread_ts = event.get("thread_ts")
        is_thread_reply = bool(thread_ts and thread_ts != event.get("ts"))
        
        # Extract mentions and links
        text = event.get("text", "")
        mentions = self.extract_mentions(text)
        links = self.extract_links(text)
        
        # Extract reactions if present
        reactions = event.get("reactions", [])
        
        # Extract file attachments
        files = event.get("files", [])
        
        return {
            "platform": "slack",
            "message_id": event.get("ts"),
            "channel_id": channel_id,
            "channel_name": channel_info.get("name"),
            "channel_type": channel_info.get("type"),
            "user_id": user_id,
            "user_name": user_info.get("real_name") or user_info.get("name"),
            "user_email": user_info.get("profile", {}).get("email"),
            "text": text,
            "timestamp": event.get("ts"),
            "edited": event.get("edited"),
            "thread_ts": thread_ts,
            "is_thread_reply": is_thread_reply,
            "mentions": mentions,
            "links": links,
            "reactions": reactions,
            "files": files,
            "message_type": event.get("subtype", "message"),
            "raw_event": event
        }
    
    async def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive user information with caching"""
        if user_id in self.users_cache:
            return self.users_cache[user_id]
        
        try:
            result = await self.app.client.users_info(user=user_id)
            user_info = result["user"]
            self.users_cache[user_id] = user_info
            return user_info
        except SlackApiError as e:
            monitor.log_error("slack", e, {"user_id": user_id}, ErrorSeverity.LOW)
            return {}
    
    async def get_channel_info(self, channel_id: str) -> Dict[str, Any]:
        """Get comprehensive channel information with caching"""
        if channel_id in self.channels_cache:
            return self.channels_cache[channel_id]
        
        try:
            result = await self.app.client.conversations_info(channel=channel_id)
            channel_info = result["channel"]
            self.channels_cache[channel_id] = channel_info
            return channel_info
        except SlackApiError as e:
            monitor.log_error("slack", e, {"channel_id": channel_id}, ErrorSeverity.LOW)
            return {}
    
    def extract_mentions(self, text: str) -> List[str]:
        """Extract user mentions from message text"""
        import re
        return re.findall(r'<@([A-Z0-9]+)>', text)
    
    def extract_links(self, text: str) -> List[str]:
        """Extract links from message text"""
        import re
        return re.findall(r'<(http[s]?://[^>]+)>', text)
    
    async def store_message(self, message_data: Dict[str, Any]):
        """Store message data in database"""
        try:
            # Hash user ID for privacy
            user_hash = database.hash_user(message_data["user_id"]) if message_data["user_id"] else None
            
            # Ensure channel exists in database
            if message_data["channel_id"]:
                database.insert_channel_if_not_exists(
                    channel_id=message_data["channel_id"],
                    name=message_data["channel_name"] or "unknown",
                    platform="slack"
                )
            
            # Insert message
            database.insert_message(
                channel_id=message_data["channel_id"],
                user_hash=user_hash,
                content=message_data["text"],
                timestamp=datetime.fromtimestamp(float(message_data["timestamp"])).isoformat(),
                metadata=message_data
            )
        except Exception as e:
            monitor.log_error("slack", e, {"message_data": message_data}, ErrorSeverity.HIGH)
            raise
    
    async def bulk_historical_import(self, days_back: int = 30) -> Dict[str, Any]:
        """Import historical messages for comprehensive analysis"""
        try:
            # Get all channels
            channels = await self.get_all_channels()
            total_messages = 0
            errors = []
            
            # Calculate time range
            end_time = datetime.now()
            start_time = end_time - timedelta(days=days_back)
            
            for channel in channels:
                try:
                    channel_messages = await self.get_channel_history(
                        channel["id"], 
                        start_time, 
                        end_time
                    )
                    total_messages += len(channel_messages)
                    
                    # Process messages in batches
                    for message in channel_messages:
                        message_data = await self.extract_message_data(message)
                        await self.store_message(message_data)
                        
                except Exception as e:
                    errors.append({"channel": channel["id"], "error": str(e)})
                    monitor.log_error("slack", e, {"channel": channel["id"]}, ErrorSeverity.MEDIUM)
            
            return {
                "status": "completed",
                "total_messages": total_messages,
                "channels_processed": len(channels),
                "errors": errors,
                "time_range": {
                    "start": start_time.isoformat(),
                    "end": end_time.isoformat()
                }
            }
            
        except Exception as e:
            monitor.log_error("slack", e, {"days_back": days_back}, ErrorSeverity.HIGH)
            raise
    
    async def get_all_channels(self) -> List[Dict[str, Any]]:
        """Get all channels bot has access to"""
        try:
            all_channels = []
            cursor = None
            
            while True:
                result = await self.app.client.conversations_list(
                    types="public_channel,private_channel,im,mpim",
                    limit=200,
                    cursor=cursor
                )
                
                all_channels.extend(result["channels"])
                cursor = result.get("response_metadata", {}).get("next_cursor")
                
                if not cursor:
                    break
            
            return all_channels
            
        except SlackApiError as e:
            monitor.log_error("slack", e, {}, ErrorSeverity.HIGH)
            raise
    
    async def get_channel_history(self, channel_id: str, start_time: datetime, end_time: datetime) -> List[Dict[str, Any]]:
        """Get channel message history within time range"""
        try:
            messages = []
            cursor = None
            oldest = start_time.timestamp()
            latest = end_time.timestamp()
            
            while True:
                result = await self.app.client.conversations_history(
                    channel=channel_id,
                    oldest=str(oldest),
                    latest=str(latest),
                    limit=200,
                    cursor=cursor
                )
                
                messages.extend(result["messages"])
                cursor = result.get("response_metadata", {}).get("next_cursor")
                
                if not cursor:
                    break
            
            return messages
            
        except SlackApiError as e:
            monitor.log_error("slack", e, {"channel_id": channel_id}, ErrorSeverity.MEDIUM)
            return []
    
    async def handle_status_command(self, ack, respond, command):
        """Handle status command"""
        await ack()
        
        health = monitor.get_health_status()
        workspace_info = await self.get_workspace_info()
        
        status_message = f"""
🤖 *Cluster Bot Status*
        
*Health:* {health['status'].upper()}
*Uptime:* {health['uptime_seconds']:.0f} seconds
*Messages Processed:* {health['messages_processed']}
*API Calls:* {health['api_calls_made']}
*Recent Errors:* {health['recent_errors']}

*Workspace:* {workspace_info.get('name', 'Unknown')}
*Channels Monitored:* {len(self.channels_cache)}
*Users Cached:* {len(self.users_cache)}
        """
        
        await respond(status_message)
    
    async def get_workspace_info(self) -> Dict[str, Any]:
        """Get workspace information"""
        if not self.workspace_info:
            try:
                result = await self.app.client.team_info()
                self.workspace_info = result["team"]
            except SlackApiError as e:
                monitor.log_error("slack", e, {}, ErrorSeverity.MEDIUM)
                return {}
        
        return self.workspace_info
    
    async def start(self):
        """Start the bot with comprehensive setup"""
        try:
            # Validate permissions
            auth_result = await self.app.client.auth_test()
            monitor.logger.info(f"Bot authenticated as {auth_result.get('user_id')} in team {auth_result.get('team')}")
            
            # Validate required permissions
            permissions = PermissionValidator.validate_slack_permissions(self.app.client, self.required_scopes)
            if not permissions['valid']:
                monitor.log_error("slack", Exception(f"Missing permissions: {permissions.get('error')}"), {}, ErrorSeverity.CRITICAL)
                return
            
            # Start socket mode handler
            handler = AsyncSocketModeHandler(self.app, self.app_token)
            monitor.logger.info("Starting Slack bot in Socket Mode...")
            await handler.start_async()
            
        except Exception as e:
            monitor.log_error("slack", e, {}, ErrorSeverity.CRITICAL)
            raise

# Run bot
if __name__ == "__main__":
    bot = ProfessionalSlackBot()
    asyncio.run(bot.start())