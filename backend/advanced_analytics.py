"""
Advanced analytics and reporting system for professional bot deployment
"""
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import plotly.graph_objects as go
import plotly.express as px
from textblob import TextBlob
import logging

logger = logging.getLogger(__name__)

@dataclass
class AnalyticsReport:
    """Structured analytics report"""
    report_type: str
    time_range: Dict[str, str]
    metrics: Dict[str, Any]
    insights: List[str]
    recommendations: List[str]
    charts: List[Dict[str, Any]]
    generated_at: datetime

class AdvancedAnalytics:
    """Advanced analytics engine for bot data"""
    
    def __init__(self, db_connection_string: str):
        self.engine = create_engine(db_connection_string)
        
    async def generate_comprehensive_report(self, platform: str = None, days_back: int = 30) -> AnalyticsReport:
        """Generate comprehensive analytics report"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Gather all metrics
            message_metrics = await self.get_message_metrics(platform, start_date, end_date)
            user_metrics = await self.get_user_engagement_metrics(platform, start_date, end_date)
            channel_metrics = await self.get_channel_performance_metrics(platform, start_date, end_date)
            sentiment_metrics = await self.get_sentiment_analysis(platform, start_date, end_date)
            content_metrics = await self.get_content_analysis(platform, start_date, end_date)
            
            # Generate insights
            insights = await self.generate_insights(message_metrics, user_metrics, channel_metrics, sentiment_metrics)
            
            # Generate recommendations
            recommendations = await self.generate_recommendations(message_metrics, user_metrics, channel_metrics)
            
            # Create visualizations
            charts = await self.create_visualizations(message_metrics, user_metrics, channel_metrics, sentiment_metrics)
            
            return AnalyticsReport(
                report_type="comprehensive",
                time_range={
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": days_back
                },
                metrics={
                    "messages": message_metrics,
                    "users": user_metrics,
                    "channels": channel_metrics,
                    "sentiment": sentiment_metrics,
                    "content": content_metrics
                },
                insights=insights,
                recommendations=recommendations,
                charts=charts,
                generated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error generating comprehensive report: {e}")
            raise
    
    async def get_message_metrics(self, platform: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get comprehensive message metrics"""
        query = """
        SELECT 
            COUNT(*) as total_messages,
            COUNT(DISTINCT channel_id) as active_channels,
            COUNT(DISTINCT user_id_hash) as active_users,
            AVG(word_count) as avg_word_count,
            AVG(character_count) as avg_character_count,
            SUM(CASE WHEN has_attachments THEN 1 ELSE 0 END) as messages_with_attachments,
            SUM(CASE WHEN has_links THEN 1 ELSE 0 END) as messages_with_links,
            SUM(reaction_count) as total_reactions,
            AVG(reaction_count) as avg_reactions_per_message,
            DATE_TRUNC('hour', timestamp) as hour,
            EXTRACT(hour from timestamp) as hour_of_day,
            EXTRACT(dow from timestamp) as day_of_week
        FROM messages_enhanced 
        WHERE timestamp >= %(start_date)s AND timestamp <= %(end_date)s
        """
        
        if platform:
            query += " AND platform = %(platform)s"
        
        query += " GROUP BY DATE_TRUNC('hour', timestamp), EXTRACT(hour from timestamp), EXTRACT(dow from timestamp)"
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                'start_date': start_date,
                'end_date': end_date,
                'platform': platform
            })
        
        return {
            'total_messages': int(df['total_messages'].sum()) if not df.empty else 0,
            'active_channels': int(df['active_channels'].nunique()) if not df.empty else 0,
            'active_users': int(df['active_users'].nunique()) if not df.empty else 0,
            'avg_word_count': float(df['avg_word_count'].mean()) if not df.empty else 0,
            'avg_character_count': float(df['avg_character_count'].mean()) if not df.empty else 0,
            'messages_with_attachments': int(df['messages_with_attachments'].sum()) if not df.empty else 0,
            'messages_with_links': int(df['messages_with_links'].sum()) if not df.empty else 0,
            'total_reactions': int(df['total_reactions'].sum()) if not df.empty else 0,
            'hourly_distribution': df.groupby('hour_of_day')['total_messages'].sum().to_dict() if not df.empty else {},
            'daily_distribution': df.groupby('day_of_week')['total_messages'].sum().to_dict() if not df.empty else {},
            'hourly_timeline': df.groupby('hour')['total_messages'].sum().to_dict() if not df.empty else {}
        }
    
    async def get_user_engagement_metrics(self, platform: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get user engagement metrics"""
        query = """
        SELECT 
            COUNT(DISTINCT user_id_hash) as total_unique_users,
            AVG(total_messages) as avg_messages_per_user,
            AVG(avg_message_length) as avg_user_message_length,
            AVG(avg_sentiment) as avg_user_sentiment,
            COUNT(CASE WHEN total_messages >= 10 THEN 1 END) as highly_active_users,
            COUNT(CASE WHEN total_messages >= 50 THEN 1 END) as super_active_users,
            STDDEV(total_messages) as message_distribution_stddev
        FROM user_analytics
        WHERE updated_at >= %(start_date)s AND updated_at <= %(end_date)s
        """
        
        if platform:
            query += " AND platform = %(platform)s"
        
        with self.engine.connect() as conn:
            result = conn.execute(text(query), {
                'start_date': start_date,
                'end_date': end_date,
                'platform': platform
            }).fetchone()
        
        if result:
            return {
                'total_unique_users': int(result[0]) if result[0] else 0,
                'avg_messages_per_user': float(result[1]) if result[1] else 0,
                'avg_user_message_length': float(result[2]) if result[2] else 0,
                'avg_user_sentiment': float(result[3]) if result[3] else 0,
                'highly_active_users': int(result[4]) if result[4] else 0,
                'super_active_users': int(result[5]) if result[5] else 0,
                'engagement_inequality': float(result[6]) if result[6] else 0
            }
        return {}
    
    async def get_channel_performance_metrics(self, platform: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get channel performance metrics"""
        query = """
        SELECT 
            c.id,
            c.name,
            ca.total_messages,
            ca.unique_users,
            ca.messages_last_7d,
            ca.avg_sentiment,
            ca.avg_message_length,
            ca.total_reactions,
            CASE 
                WHEN ca.messages_last_7d > 100 THEN 'High'
                WHEN ca.messages_last_7d > 20 THEN 'Medium'
                ELSE 'Low'
            END as activity_level
        FROM channels_enhanced c
        LEFT JOIN channel_analytics ca ON c.id = ca.channel_id
        WHERE c.created_at >= %(start_date)s
        """
        
        if platform:
            query += " AND c.platform = %(platform)s"
        
        query += " ORDER BY ca.messages_last_7d DESC NULLS LAST"
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                'start_date': start_date,
                'platform': platform
            })
        
        if not df.empty:
            return {
                'total_channels': len(df),
                'high_activity_channels': len(df[df['activity_level'] == 'High']),
                'medium_activity_channels': len(df[df['activity_level'] == 'Medium']),
                'low_activity_channels': len(df[df['activity_level'] == 'Low']),
                'top_channels': df.head(10).to_dict('records'),
                'avg_messages_per_channel': float(df['total_messages'].mean()) if 'total_messages' in df.columns else 0,
                'channel_sentiment_distribution': df.groupby('activity_level')['avg_sentiment'].mean().to_dict()
            }
        return {}
    
    async def get_sentiment_analysis(self, platform: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get sentiment analysis metrics"""
        query = """
        SELECT 
            AVG(sentiment_score) as overall_sentiment,
            STDDEV(sentiment_score) as sentiment_variance,
            COUNT(CASE WHEN sentiment_score > 0.1 THEN 1 END) as positive_messages,
            COUNT(CASE WHEN sentiment_score < -0.1 THEN 1 END) as negative_messages,
            COUNT(CASE WHEN sentiment_score BETWEEN -0.1 AND 0.1 THEN 1 END) as neutral_messages,
            DATE_TRUNC('day', timestamp) as date
        FROM messages_enhanced 
        WHERE timestamp >= %(start_date)s AND timestamp <= %(end_date)s
          AND sentiment_score IS NOT NULL
        """
        
        if platform:
            query += " AND platform = %(platform)s"
        
        query += " GROUP BY DATE_TRUNC('day', timestamp) ORDER BY date"
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                'start_date': start_date,
                'end_date': end_date,
                'platform': platform
            })
        
        if not df.empty:
            total_messages = df[['positive_messages', 'negative_messages', 'neutral_messages']].sum().sum()
            return {
                'overall_sentiment': float(df['overall_sentiment'].mean()),
                'sentiment_variance': float(df['sentiment_variance'].mean()),
                'positive_percentage': float(df['positive_messages'].sum() / total_messages * 100) if total_messages > 0 else 0,
                'negative_percentage': float(df['negative_messages'].sum() / total_messages * 100) if total_messages > 0 else 0,
                'neutral_percentage': float(df['neutral_messages'].sum() / total_messages * 100) if total_messages > 0 else 0,
                'daily_sentiment': df[['date', 'overall_sentiment']].to_dict('records')
            }
        return {}
    
    async def get_content_analysis(self, platform: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get content analysis metrics"""
        query = """
        SELECT 
            AVG(word_count) as avg_words,
            AVG(character_count) as avg_characters,
            COUNT(CASE WHEN has_attachments THEN 1 END) * 100.0 / COUNT(*) as attachment_percentage,
            COUNT(CASE WHEN has_links THEN 1 END) * 100.0 / COUNT(*) as link_percentage,
            COUNT(CASE WHEN word_count > 50 THEN 1 END) * 100.0 / COUNT(*) as long_message_percentage,
            COUNT(CASE WHEN word_count <= 5 THEN 1 END) * 100.0 / COUNT(*) as short_message_percentage
        FROM messages_enhanced 
        WHERE timestamp >= %(start_date)s AND timestamp <= %(end_date)s
        """
        
        if platform:
            query += " AND platform = %(platform)s"
        
        with self.engine.connect() as conn:
            result = conn.execute(text(query), {
                'start_date': start_date,
                'end_date': end_date,
                'platform': platform
            }).fetchone()
        
        if result:
            return {
                'avg_words_per_message': float(result[0]) if result[0] else 0,
                'avg_characters_per_message': float(result[1]) if result[1] else 0,
                'attachment_percentage': float(result[2]) if result[2] else 0,
                'link_percentage': float(result[3]) if result[3] else 0,
                'long_message_percentage': float(result[4]) if result[4] else 0,
                'short_message_percentage': float(result[5]) if result[5] else 0
            }
        return {}
    
    async def generate_insights(self, message_metrics: Dict, user_metrics: Dict, 
                              channel_metrics: Dict, sentiment_metrics: Dict) -> List[str]:
        """Generate actionable insights from metrics"""
        insights = []
        
        # Message volume insights
        if message_metrics.get('total_messages', 0) > 1000:
            insights.append("📈 High message volume detected - strong community engagement")
        elif message_metrics.get('total_messages', 0) < 100:
            insights.append("📉 Low message volume - consider engagement strategies")
        
        # User engagement insights
        if user_metrics.get('super_active_users', 0) > user_metrics.get('total_unique_users', 1) * 0.1:
            insights.append("👥 Strong power user base - 10%+ are super active contributors")
        
        # Sentiment insights
        if sentiment_metrics.get('positive_percentage', 0) > 60:
            insights.append("😊 Positive community sentiment - good environment health")
        elif sentiment_metrics.get('negative_percentage', 0) > 30:
            insights.append("😟 High negative sentiment detected - community health concern")
        
        # Channel distribution insights
        if channel_metrics.get('high_activity_channels', 0) < 3:
            insights.append("🏠 Few highly active channels - content may be concentrated")
        
        # Content insights
        if message_metrics.get('avg_word_count', 0) > 20:
            insights.append("📝 Users write detailed messages - good for in-depth discussions")
        elif message_metrics.get('avg_word_count', 0) < 5:
            insights.append("💬 Short message style - more chat-like interactions")
        
        # Activity pattern insights
        hourly_dist = message_metrics.get('hourly_distribution', {})
        if hourly_dist:
            peak_hour = max(hourly_dist.items(), key=lambda x: x[1])[0]
            insights.append(f"⏰ Peak activity at hour {peak_hour} - optimal for announcements")
        
        return insights
    
    async def generate_recommendations(self, message_metrics: Dict, user_metrics: Dict, 
                                     channel_metrics: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Engagement recommendations
        if user_metrics.get('avg_messages_per_user', 0) < 5:
            recommendations.append("🎯 Implement user onboarding to increase participation")
            recommendations.append("🎮 Consider gamification elements to boost engagement")
        
        # Content recommendations
        if message_metrics.get('messages_with_attachments', 0) / message_metrics.get('total_messages', 1) < 0.1:
            recommendations.append("📎 Encourage rich media sharing for better engagement")
        
        # Channel recommendations
        if channel_metrics.get('low_activity_channels', 0) > channel_metrics.get('total_channels', 1) * 0.5:
            recommendations.append("🗂️ Consider consolidating low-activity channels")
        
        # Moderation recommendations
        if message_metrics.get('total_messages', 0) > 10000:
            recommendations.append("🛡️ Implement automated moderation for high-volume channels")
            recommendations.append("📊 Set up real-time monitoring dashboards")
        
        # Community health recommendations
        recommendations.append("💡 Schedule regular community health reports")
        recommendations.append("📈 Monitor sentiment trends for early issue detection")
        recommendations.append("🔄 Implement feedback loops based on user engagement patterns")
        
        return recommendations
    
    async def create_visualizations(self, message_metrics: Dict, user_metrics: Dict,
                                  channel_metrics: Dict, sentiment_metrics: Dict) -> List[Dict[str, Any]]:
        """Create visualization configs for frontend"""
        charts = []
        
        # Message volume over time
        if message_metrics.get('hourly_timeline'):
            charts.append({
                'type': 'line',
                'title': 'Message Volume Over Time',
                'data': message_metrics['hourly_timeline'],
                'x_axis': 'Hour',
                'y_axis': 'Messages'
            })
        
        # Hourly activity distribution
        if message_metrics.get('hourly_distribution'):
            charts.append({
                'type': 'bar',
                'title': 'Activity by Hour of Day',
                'data': message_metrics['hourly_distribution'],
                'x_axis': 'Hour',
                'y_axis': 'Messages'
            })
        
        # Sentiment distribution
        if sentiment_metrics:
            sentiment_data = {
                'Positive': sentiment_metrics.get('positive_percentage', 0),
                'Neutral': sentiment_metrics.get('neutral_percentage', 0),
                'Negative': sentiment_metrics.get('negative_percentage', 0)
            }
            charts.append({
                'type': 'pie',
                'title': 'Sentiment Distribution',
                'data': sentiment_data
            })
        
        # Channel activity levels
        if channel_metrics.get('high_activity_channels') is not None:
            activity_data = {
                'High': channel_metrics.get('high_activity_channels', 0),
                'Medium': channel_metrics.get('medium_activity_channels', 0),
                'Low': channel_metrics.get('low_activity_channels', 0)
            }
            charts.append({
                'type': 'doughnut',
                'title': 'Channel Activity Levels',
                'data': activity_data
            })
        
        return charts

class ReportExporter:
    """Export analytics reports in various formats"""
    
    @staticmethod
    def to_json(report: AnalyticsReport, file_path: str = None) -> str:
        """Export report to JSON"""
        report_dict = {
            'report_type': report.report_type,
            'time_range': report.time_range,
            'metrics': report.metrics,
            'insights': report.insights,
            'recommendations': report.recommendations,
            'charts': report.charts,
            'generated_at': report.generated_at.isoformat()
        }
        
        json_str = json.dumps(report_dict, indent=2, default=str)
        
        if file_path:
            with open(file_path, 'w') as f:
                f.write(json_str)
        
        return json_str
    
    @staticmethod
    def to_html(report: AnalyticsReport, file_path: str = None) -> str:
        """Export report to HTML"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Analytics Report - {report.generated_at.strftime('%Y-%m-%d')}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .metric {{ background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                .insight {{ color: #2c5aa0; margin: 5px 0; }}
                .recommendation {{ color: #d4761a; margin: 5px 0; }}
                h1, h2 {{ color: #333; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>Analytics Report</h1>
            <p><strong>Generated:</strong> {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p><strong>Time Range:</strong> {report.time_range['start']} to {report.time_range['end']}</p>
            
            <h2>Key Metrics</h2>
            <div class="metric">
                <h3>Messages</h3>
                <p>Total Messages: {report.metrics.get('messages', {}).get('total_messages', 0)}</p>
                <p>Active Channels: {report.metrics.get('messages', {}).get('active_channels', 0)}</p>
                <p>Active Users: {report.metrics.get('messages', {}).get('active_users', 0)}</p>
            </div>
            
            <h2>Insights</h2>
            {''.join([f'<div class="insight">{insight}</div>' for insight in report.insights])}
            
            <h2>Recommendations</h2>
            {''.join([f'<div class="recommendation">{rec}</div>' for rec in report.recommendations])}
        </body>
        </html>
        """
        
        if file_path:
            with open(file_path, 'w') as f:
                f.write(html)
        
        return html