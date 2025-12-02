"""
Professional Discord Bot with comprehensive data collection and enterprise features
"""
import os
import ssl
import certifi
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union

# Fix SSL certificates for macOS
_create_default_https_context = ssl.create_default_context
ssl._create_default_https_context = lambda *args, **kwargs: _create_default_https_context(cafile=certifi.where(), *args, **kwargs)

import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv

# Import our enhanced modules
from backend.monitoring import monitor, RetryHandler, ErrorSeverity
from backend.security import TokenManager, RateLimiter, PermissionValidator
from backend import database

load_dotenv()

class ProfessionalDiscordBot:
    """Enterprise-ready Discord bot with comprehensive features"""
    
    def __init__(self):
        self.token_manager = TokenManager()
        self.rate_limiter = RateLimiter()
        
        # Required permissions
        self.required_permissions = [
            'read_messages', 'read_message_history', 'send_messages',
            'manage_messages', 'embed_links', 'attach_files',
            'use_slash_commands', 'view_channel'
        ]
        
        # Bot setup
        self.bot_token = os.getenv('DISCORD_BOT_TOKEN')
        if not self.bot_token:
            raise ValueError("Missing DISCORD_BOT_TOKEN")
        
        # Configure intents
        intents = discord.Intents.default()
        intents.message_content = True
        intents.guilds = True
        intents.members = True  # Enable for member tracking
        intents.reactions = True
        intents.voice_states = True
        
        self.bot = commands.Bot(
            command_prefix='!cluster-',
            intents=intents,
            help_command=None
        )
        
        # Caches
        self.guilds_cache = {}
        self.channels_cache = {}
        self.users_cache = {}
        
        self.setup_handlers()
        self.setup_commands()
    
    def setup_handlers(self):
        """Setup comprehensive event handlers"""
        
        @self.bot.event
        async def on_ready():
            await self.on_bot_ready()
        
        @self.bot.event
        async def on_message(message):
            await self.process_message(message)
        
        @self.bot.event
        async def on_message_edit(before, after):
            await self.process_message_edit(before, after)
        
        @self.bot.event
        async def on_message_delete(message):
            await self.process_message_delete(message)
        
        @self.bot.event
        async def on_reaction_add(reaction, user):
            await self.process_reaction(reaction, user, "add")
        
        @self.bot.event
        async def on_reaction_remove(reaction, user):
            await self.process_reaction(reaction, user, "remove")
        
        @self.bot.event
        async def on_guild_join(guild):
            await self.process_guild_change(guild, "joined")
        
        @self.bot.event
        async def on_guild_remove(guild):
            await self.process_guild_change(guild, "left")
        
        @self.bot.event
        async def on_member_join(member):
            await self.process_member_change(member, "joined")
        
        @self.bot.event
        async def on_member_remove(member):
            await self.process_member_change(member, "left")
        
        @self.bot.event
        async def on_voice_state_update(member, before, after):
            await self.process_voice_activity(member, before, after)
    
    def setup_commands(self):
        """Setup bot commands"""
        
        @self.bot.command(name='status')
        async def status_command(ctx):
            """Get bot status and health information"""
            await self.handle_status_command(ctx)
        
        @self.bot.command(name='export')
        async def export_command(ctx, days: int = 7):
            """Export server data for analysis"""
            await self.handle_export_command(ctx, days)
        
        @self.bot.command(name='analyze')
        async def analyze_command(ctx):
            """Trigger message clustering analysis"""
            await self.handle_analyze_command(ctx)
        
        @self.bot.command(name='permissions')
        async def permissions_command(ctx):
            """Check bot permissions in this server"""
            await self.handle_permissions_command(ctx)
        
        @self.bot.slash_command(name="cluster_status", description="Get clustering bot status")
        async def slash_status(interaction: discord.Interaction):
            await self.handle_status_slash_command(interaction)
    
    async def on_bot_ready(self):
        """Handle bot startup"""
        try:
            monitor.logger.info(f"Bot logged in as {self.bot.user} (ID: {self.bot.user.id})")
            monitor.logger.info(f"Connected to {len(self.bot.guilds)} guilds")
            
            # Start background tasks
            self.periodic_health_check.start()
            self.cache_cleanup.start()
            
            # Validate permissions in all guilds
            for guild in self.bot.guilds:
                await self.validate_guild_permissions(guild)
            
            # Update cache
            await self.refresh_caches()
            
        except Exception as e:
            monitor.log_error("discord", e, {}, ErrorSeverity.CRITICAL)
    
    async def process_message(self, message: discord.Message):
        """Process incoming messages with comprehensive data extraction"""
        try:
            # Skip bot messages
            if message.author.bot:
                return
            
            # Rate limiting check
            if not self.rate_limiter.can_make_request(self.bot_token[:10], "discord:messages"):
                monitor.logger.warning("Rate limit exceeded for message processing")
                return
            
            # Extract comprehensive message data
            message_data = await self.extract_message_data(message)
            
            # Store in database with retry
            await RetryHandler.with_retry(
                lambda: self.store_message(message_data),
                platform="discord"
            )
            
            monitor.metrics['messages_processed'] += 1
            self.rate_limiter.record_request(self.bot_token[:10], "discord:messages")
            
            # Process commands
            await self.bot.process_commands(message)
            
        except Exception as e:
            monitor.log_error("discord", e, {"message_id": message.id}, ErrorSeverity.MEDIUM)
    
    async def extract_message_data(self, message: discord.Message) -> Dict[str, Any]:
        """Extract comprehensive data from Discord message"""
        # Get guild and channel info
        guild_info = await self.get_guild_info(message.guild) if message.guild else {}
        channel_info = await self.get_channel_info(message.channel)
        
        # Extract mentions
        user_mentions = [str(user.id) for user in message.mentions]
        role_mentions = [str(role.id) for role in message.role_mentions]
        channel_mentions = [str(channel.id) for channel in message.channel_mentions]
        
        # Extract reactions
        reactions = []
        for reaction in message.reactions:
            reactions.append({
                "emoji": str(reaction.emoji),
                "count": reaction.count,
                "users": [str(user.id) async for user in reaction.users()]
            })
        
        # Extract attachments
        attachments = []
        for attachment in message.attachments:
            attachments.append({
                "id": attachment.id,
                "filename": attachment.filename,
                "size": attachment.size,
                "url": attachment.url,
                "content_type": attachment.content_type
            })
        
        # Extract embeds
        embeds = []
        for embed in message.embeds:
            embeds.append({
                "title": embed.title,
                "description": embed.description,
                "url": embed.url,
                "type": embed.type,
                "timestamp": embed.timestamp.isoformat() if embed.timestamp else None
            })
        
        # Thread information
        thread_info = {}
        if hasattr(message.channel, 'parent'):
            thread_info = {
                "is_thread": True,
                "parent_channel_id": str(message.channel.parent.id) if message.channel.parent else None,
                "thread_name": message.channel.name
            }
        
        return {
            "platform": "discord",
            "message_id": str(message.id),
            "guild_id": str(message.guild.id) if message.guild else None,
            "guild_name": guild_info.get("name"),
            "channel_id": str(message.channel.id),
            "channel_name": channel_info.get("name"),
            "channel_type": channel_info.get("type"),
            "user_id": str(message.author.id),
            "user_name": message.author.name,
            "user_display_name": message.author.display_name,
            "content": message.content,
            "timestamp": message.created_at.isoformat(),
            "edited_timestamp": message.edited_at.isoformat() if message.edited_at else None,
            "user_mentions": user_mentions,
            "role_mentions": role_mentions,
            "channel_mentions": channel_mentions,
            "reactions": reactions,
            "attachments": attachments,
            "embeds": embeds,
            "thread_info": thread_info,
            "is_pinned": message.pinned,
            "reference": {
                "message_id": str(message.reference.message_id) if message.reference and message.reference.message_id else None,
                "channel_id": str(message.reference.channel_id) if message.reference and message.reference.channel_id else None
            } if message.reference else None,
            "raw_message": {
                "id": str(message.id),
                "author": {
                    "id": str(message.author.id),
                    "name": message.author.name,
                    "discriminator": message.author.discriminator,
                    "avatar": str(message.author.avatar) if message.author.avatar else None
                }
            }
        }
    
    async def get_guild_info(self, guild: discord.Guild) -> Dict[str, Any]:
        """Get comprehensive guild information with caching"""
        guild_id = str(guild.id)
        if guild_id in self.guilds_cache:
            return self.guilds_cache[guild_id]
        
        try:
            guild_info = {
                "id": guild_id,
                "name": guild.name,
                "description": guild.description,
                "member_count": guild.member_count,
                "owner_id": str(guild.owner_id) if guild.owner_id else None,
                "created_at": guild.created_at.isoformat(),
                "features": guild.features,
                "verification_level": str(guild.verification_level),
                "explicit_content_filter": str(guild.explicit_content_filter),
                "default_notifications": str(guild.default_notifications),
                "mfa_level": guild.mfa_level,
                "premium_tier": guild.premium_tier,
                "premium_subscription_count": guild.premium_subscription_count
            }
            
            self.guilds_cache[guild_id] = guild_info
            return guild_info
            
        except Exception as e:
            monitor.log_error("discord", e, {"guild_id": guild_id}, ErrorSeverity.LOW)
            return {"id": guild_id, "name": guild.name}
    
    async def get_channel_info(self, channel: Union[discord.TextChannel, discord.DMChannel, discord.GroupChannel]) -> Dict[str, Any]:
        """Get comprehensive channel information with caching"""
        channel_id = str(channel.id)
        if channel_id in self.channels_cache:
            return self.channels_cache[channel_id]
        
        try:
            channel_info = {
                "id": channel_id,
                "name": channel.name if hasattr(channel, 'name') else "DM",
                "type": str(channel.type),
                "created_at": channel.created_at.isoformat(),
            }
            
            # Add text channel specific info
            if isinstance(channel, discord.TextChannel):
                channel_info.update({
                    "category": channel.category.name if channel.category else None,
                    "category_id": str(channel.category.id) if channel.category else None,
                    "topic": channel.topic,
                    "position": channel.position,
                    "nsfw": channel.nsfw,
                    "slowmode_delay": channel.slowmode_delay,
                    "permissions_synced": channel.permissions_synced if hasattr(channel, 'permissions_synced') else None
                })
            
            # Add voice channel specific info
            elif isinstance(channel, discord.VoiceChannel):
                channel_info.update({
                    "bitrate": channel.bitrate,
                    "user_limit": channel.user_limit,
                    "rtc_region": channel.rtc_region
                })
            
            self.channels_cache[channel_id] = channel_info
            return channel_info
            
        except Exception as e:
            monitor.log_error("discord", e, {"channel_id": channel_id}, ErrorSeverity.LOW)
            return {"id": channel_id, "name": getattr(channel, 'name', 'Unknown'), "type": str(channel.type)}
    
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
                    platform="discord"
                )
            
            # Insert message
            database.insert_message(
                channel_id=message_data["channel_id"],
                user_hash=user_hash,
                content=message_data["content"],
                timestamp=message_data["timestamp"],
                metadata=message_data
            )
            
        except Exception as e:
            monitor.log_error("discord", e, {"message_data": message_data}, ErrorSeverity.HIGH)
            raise
    
    async def bulk_historical_import(self, guild_id: str, days_back: int = 30) -> Dict[str, Any]:
        """Import historical messages for comprehensive analysis"""
        try:
            guild = self.bot.get_guild(int(guild_id))
            if not guild:
                raise ValueError(f"Guild {guild_id} not found")
            
            total_messages = 0
            errors = []
            
            # Calculate time range
            after_date = datetime.now() - timedelta(days=days_back)
            
            # Process all text channels
            for channel in guild.text_channels:
                try:
                    if not channel.permissions_for(guild.me).read_message_history:
                        continue
                    
                    async for message in channel.history(after=after_date, limit=None):
                        if not message.author.bot:
                            message_data = await self.extract_message_data(message)
                            await self.store_message(message_data)
                            total_messages += 1
                        
                except Exception as e:
                    errors.append({"channel": channel.id, "error": str(e)})
                    monitor.log_error("discord", e, {"channel_id": channel.id}, ErrorSeverity.MEDIUM)
            
            return {
                "status": "completed",
                "guild_id": guild_id,
                "total_messages": total_messages,
                "channels_processed": len(guild.text_channels),
                "errors": errors,
                "time_range": {
                    "after": after_date.isoformat(),
                    "before": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            monitor.log_error("discord", e, {"guild_id": guild_id, "days_back": days_back}, ErrorSeverity.HIGH)
            raise
    
    async def validate_guild_permissions(self, guild: discord.Guild):
        """Validate bot permissions in guild"""
        try:
            permissions = PermissionValidator.validate_discord_permissions(
                self.bot, str(guild.id), self.required_permissions
            )
            
            if not permissions['valid']:
                monitor.logger.warning(f"Missing permissions in {guild.name}: {permissions['missing_permissions']}")
                
        except Exception as e:
            monitor.log_error("discord", e, {"guild_id": guild.id}, ErrorSeverity.MEDIUM)
    
    async def handle_status_command(self, ctx):
        """Handle status command"""
        try:
            health = monitor.get_health_status()
            guild_info = await self.get_guild_info(ctx.guild) if ctx.guild else {}
            
            embed = discord.Embed(
                title="🤖 Cluster Bot Status",
                color=0x00ff00 if health['status'] == 'healthy' else 0xff0000,
                timestamp=datetime.now()
            )
            
            embed.add_field(name="Health", value=health['status'].upper(), inline=True)
            embed.add_field(name="Uptime", value=f"{health['uptime_seconds']:.0f}s", inline=True)
            embed.add_field(name="Messages Processed", value=health['messages_processed'], inline=True)
            embed.add_field(name="API Calls", value=health['api_calls_made'], inline=True)
            embed.add_field(name="Recent Errors", value=health['recent_errors'], inline=True)
            embed.add_field(name="Critical Errors", value=health['critical_errors'], inline=True)
            
            if guild_info:
                embed.add_field(name="Server", value=guild_info['name'], inline=True)
                embed.add_field(name="Members", value=guild_info.get('member_count', 'Unknown'), inline=True)
            
            embed.add_field(name="Cached Guilds", value=len(self.guilds_cache), inline=True)
            embed.add_field(name="Cached Channels", value=len(self.channels_cache), inline=True)
            
            await ctx.send(embed=embed)
            
        except Exception as e:
            monitor.log_error("discord", e, {"command": "status"}, ErrorSeverity.MEDIUM)
            await ctx.send("❌ Error retrieving status information.")
    
    @tasks.loop(minutes=5)
    async def periodic_health_check(self):
        """Periodic health check and reporting"""
        try:
            health = monitor.get_health_status()
            if health['status'] == 'critical':
                monitor.logger.critical("Bot health is critical - immediate attention required")
            
            # Clear old cache entries
            await self.cleanup_caches()
            
        except Exception as e:
            monitor.log_error("discord", e, {}, ErrorSeverity.LOW)
    
    @tasks.loop(hours=1)
    async def cache_cleanup(self):
        """Clean up old cache entries"""
        try:
            # Keep only recent cache entries (last 24 hours)
            cache_ttl = timedelta(hours=24)
            current_time = datetime.now()
            
            # This is a simplified cleanup - in production you'd want timestamps on cache entries
            if len(self.channels_cache) > 1000:
                self.channels_cache.clear()
            if len(self.guilds_cache) > 100:
                self.guilds_cache.clear()
                
        except Exception as e:
            monitor.log_error("discord", e, {}, ErrorSeverity.LOW)
    
    async def refresh_caches(self):
        """Refresh all caches"""
        try:
            for guild in self.bot.guilds:
                await self.get_guild_info(guild)
                
                for channel in guild.text_channels:
                    await self.get_channel_info(channel)
                    
        except Exception as e:
            monitor.log_error("discord", e, {}, ErrorSeverity.LOW)
    
    async def start(self):
        """Start the bot"""
        try:
            monitor.logger.info("Starting Discord bot...")
            await self.bot.start(self.bot_token)
        except Exception as e:
            monitor.log_error("discord", e, {}, ErrorSeverity.CRITICAL)
            raise

# Run bot
if __name__ == "__main__":
    bot = ProfessionalDiscordBot()
    asyncio.run(bot.start())