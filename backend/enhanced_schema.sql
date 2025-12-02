-- Enhanced database schema for comprehensive bot data collection
-- This extends the existing schema with enterprise-ready features

-- Drop existing tables if they exist (for development)
-- In production, use proper migration scripts
-- DROP TABLE IF EXISTS bot_errors CASCADE;
-- DROP TABLE IF EXISTS channel_analytics CASCADE;
-- DROP TABLE IF EXISTS user_analytics CASCADE;
-- DROP TABLE IF EXISTS message_analytics CASCADE;

-- Enhanced channels table with more metadata
CREATE TABLE IF NOT EXISTS channels_enhanced (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('slack', 'discord')),
    type VARCHAR(100), -- channel, dm, group, thread, etc.
    guild_id VARCHAR(255), -- Discord guild or Slack team
    parent_channel_id VARCHAR(255), -- For threads
    topic TEXT,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    member_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    
    FOREIGN KEY (parent_channel_id) REFERENCES channels_enhanced(id)
);

-- Enhanced messages table with comprehensive metadata
CREATE TABLE IF NOT EXISTS messages_enhanced (
    id VARCHAR(255) PRIMARY KEY, -- Platform message ID
    channel_id VARCHAR(255) NOT NULL,
    user_id_hash VARCHAR(255), -- Hashed for privacy
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    message_type VARCHAR(100) DEFAULT 'message',
    thread_ts VARCHAR(255), -- For threaded conversations
    is_thread_reply BOOLEAN DEFAULT false,
    reply_to_message_id VARCHAR(255),
    
    -- Content analysis
    word_count INTEGER,
    character_count INTEGER,
    sentiment_score DECIMAL(3,2), -- -1 to 1
    toxicity_score DECIMAL(3,2), -- 0 to 1
    language VARCHAR(10),
    
    -- Engagement metrics
    reaction_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    
    -- File attachments
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    
    -- Links and media
    has_links BOOLEAN DEFAULT false,
    link_count INTEGER DEFAULT 0,
    has_media BOOLEAN DEFAULT false,
    
    -- Platform specific
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('slack', 'discord')),
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (channel_id) REFERENCES channels_enhanced(id),
    FOREIGN KEY (reply_to_message_id) REFERENCES messages_enhanced(id)
);

-- User analytics (privacy-conscious with hashed IDs)
CREATE TABLE IF NOT EXISTS user_analytics (
    user_id_hash VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    
    -- Activity metrics
    total_messages INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    total_characters INTEGER DEFAULT 0,
    
    -- Engagement metrics
    reactions_given INTEGER DEFAULT 0,
    reactions_received INTEGER DEFAULT 0,
    mentions_given INTEGER DEFAULT 0,
    mentions_received INTEGER DEFAULT 0,
    
    -- Behavioral patterns
    avg_message_length DECIMAL(8,2),
    most_active_hour INTEGER, -- 0-23
    most_active_day INTEGER, -- 0-6 (Sunday-Saturday)
    avg_sentiment DECIMAL(3,2),
    
    -- Time tracking
    first_message_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Channel analytics
CREATE TABLE IF NOT EXISTS channel_analytics (
    channel_id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    
    -- Volume metrics
    total_messages INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    
    -- Time-based metrics
    messages_last_24h INTEGER DEFAULT 0,
    messages_last_7d INTEGER DEFAULT 0,
    messages_last_30d INTEGER DEFAULT 0,
    
    -- Engagement metrics
    avg_messages_per_user DECIMAL(8,2),
    avg_message_length DECIMAL(8,2),
    total_reactions INTEGER DEFAULT 0,
    
    -- Content analysis
    avg_sentiment DECIMAL(3,2),
    top_keywords TEXT[], -- Array of popular keywords
    
    -- Activity patterns
    peak_hour INTEGER, -- Most active hour
    peak_day INTEGER, -- Most active day
    
    -- Health metrics
    spam_score DECIMAL(3,2), -- 0-1, higher = more spam-like
    toxicity_score DECIMAL(3,2), -- 0-1, higher = more toxic
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (channel_id) REFERENCES channels_enhanced(id)
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    user_id_hash VARCHAR(255),
    emoji VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages_enhanced(id),
    UNIQUE(message_id, user_id_hash, emoji)
);

-- Message mentions (users, channels, roles)
CREATE TABLE IF NOT EXISTS message_mentions (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    mention_type VARCHAR(50) NOT NULL CHECK (mention_type IN ('user', 'channel', 'role', 'everyone', 'here')),
    mentioned_id_hash VARCHAR(255), -- Hashed ID of mentioned entity
    
    FOREIGN KEY (message_id) REFERENCES messages_enhanced(id)
);

-- Message attachments
CREATE TABLE IF NOT EXISTS message_attachments (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255),
    file_type VARCHAR(100),
    file_size INTEGER, -- In bytes
    url TEXT,
    content_type VARCHAR(255),
    is_image BOOLEAN DEFAULT false,
    is_video BOOLEAN DEFAULT false,
    is_audio BOOLEAN DEFAULT false,
    
    FOREIGN KEY (message_id) REFERENCES messages_enhanced(id)
);

-- Bot errors and monitoring
CREATE TABLE IF NOT EXISTS bot_errors (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    error_type VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    context JSONB,
    traceback TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Clustering results
CREATE TABLE IF NOT EXISTS clustering_results (
    id SERIAL PRIMARY KEY,
    cluster_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    parameters JSONB,
    message_count INTEGER NOT NULL,
    channel_ids TEXT[], -- Array of channel IDs included
    date_range_start TIMESTAMP WITH TIME ZONE,
    date_range_end TIMESTAMP WITH TIME ZONE,
    quality_score DECIMAL(3,2), -- Clustering quality metric
    
    -- Cluster characteristics
    dominant_topics TEXT[], -- Top topics in cluster
    avg_sentiment DECIMAL(3,2),
    avg_message_length DECIMAL(8,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Message cluster assignments
CREATE TABLE IF NOT EXISTS message_clusters (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    cluster_id VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(3,2), -- How confident the assignment is
    distance_to_centroid DECIMAL(10,6), -- Distance to cluster center
    
    FOREIGN KEY (message_id) REFERENCES messages_enhanced(id)
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_log (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(20) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    rate_limited BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_channel_timestamp ON messages_enhanced(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_user_timestamp ON messages_enhanced(user_id_hash, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_platform ON messages_enhanced(platform);
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_content_gin ON messages_enhanced USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_messages_enhanced_metadata_gin ON messages_enhanced USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_bot_errors_platform_timestamp ON bot_errors(platform, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_errors_severity ON bot_errors(severity);
CREATE INDEX IF NOT EXISTS idx_bot_errors_resolved ON bot_errors(resolved);

CREATE INDEX IF NOT EXISTS idx_user_analytics_platform ON user_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_channel_analytics_platform ON channel_analytics(platform);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- Create views for common analytics queries
CREATE OR REPLACE VIEW message_analytics_summary AS
SELECT 
    platform,
    COUNT(*) as total_messages,
    COUNT(DISTINCT channel_id) as active_channels,
    COUNT(DISTINCT user_id_hash) as active_users,
    AVG(word_count) as avg_word_count,
    AVG(sentiment_score) as avg_sentiment,
    DATE_TRUNC('day', timestamp) as date
FROM messages_enhanced
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY platform, DATE_TRUNC('day', timestamp)
ORDER BY date DESC;

CREATE OR REPLACE VIEW channel_activity_summary AS
SELECT 
    c.id,
    c.name,
    c.platform,
    ca.total_messages,
    ca.unique_users,
    ca.messages_last_24h,
    ca.messages_last_7d,
    ca.avg_sentiment,
    ca.updated_at
FROM channels_enhanced c
LEFT JOIN channel_analytics ca ON c.id = ca.channel_id
ORDER BY ca.messages_last_7d DESC NULLS LAST;

-- Functions for automatic analytics updates
CREATE OR REPLACE FUNCTION update_user_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_analytics (
        user_id_hash, 
        platform, 
        total_messages, 
        total_words, 
        total_characters,
        first_message_at,
        last_message_at,
        updated_at
    )
    VALUES (
        NEW.user_id_hash,
        NEW.platform,
        1,
        NEW.word_count,
        NEW.character_count,
        NEW.timestamp,
        NEW.timestamp,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id_hash) DO UPDATE SET
        total_messages = user_analytics.total_messages + 1,
        total_words = user_analytics.total_words + COALESCE(NEW.word_count, 0),
        total_characters = user_analytics.total_characters + COALESCE(NEW.character_count, 0),
        last_message_at = NEW.timestamp,
        avg_message_length = (user_analytics.total_characters + COALESCE(NEW.character_count, 0))::decimal / (user_analytics.total_messages + 1),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update user analytics
DROP TRIGGER IF EXISTS trigger_update_user_analytics ON messages_enhanced;
CREATE TRIGGER trigger_update_user_analytics
    AFTER INSERT ON messages_enhanced
    FOR EACH ROW
    EXECUTE FUNCTION update_user_analytics();

-- Function to calculate message statistics
CREATE OR REPLACE FUNCTION calculate_message_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate word count
    NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
    
    -- Calculate character count
    NEW.character_count = length(NEW.content);
    
    -- Set content flags
    NEW.has_links = NEW.content ~ 'https?://[^\s]+';
    NEW.link_count = (length(NEW.content) - length(regexp_replace(NEW.content, 'https?://[^\s]+', '', 'g'))) / 7; -- Rough estimate
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate message statistics
DROP TRIGGER IF EXISTS trigger_calculate_message_stats ON messages_enhanced;
CREATE TRIGGER trigger_calculate_message_stats
    BEFORE INSERT OR UPDATE ON messages_enhanced
    FOR EACH ROW
    EXECUTE FUNCTION calculate_message_stats();