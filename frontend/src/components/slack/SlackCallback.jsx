import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SlackWorkspaces from './SlackWorkspaces';
import './SlackCallback.css';

const SlackCallback = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const hasRun = useRef(false);

    useEffect(() => {
        // Ensure this only runs once, even in StrictMode
        if (hasRun.current) return;
        hasRun.current = true;
        
        const handleOAuthCallback = async () => {
            // Get code from URL params
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const errorParam = urlParams.get('error');

            if (errorParam) {
                setError(`OAuth error: ${errorParam}`);
                setLoading(false);
                return;
            }

            if (!code) {
                setError('No authorization code received');
                setLoading(false);
                return;
            }

            try {
                // Exchange code for access token
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                const response = await fetch(
                    `${apiUrl}/auth/slack/callback?code=${encodeURIComponent(code)}`
                );

                if (!response.ok) {
                    throw new Error('Failed to exchange authorization code');
                }

                const data = await response.json();
                
                // Store access token (in production, this should be stored securely)
                localStorage.setItem('slack_access_token', data.access_token);
                localStorage.setItem('slack_team_id', data.team_id);
                localStorage.setItem('slack_team_name', data.team_name);
                
                setAccessToken(data.access_token);
                setLoading(false);

            } catch (err) {
                console.error('OAuth callback error:', err);
                setError(err.message);
                setLoading(false);
            }
        };
        
        handleOAuthCallback();
    }, []);

    const handleExtractComplete = (result) => {
        // Store extracted data and navigate to dashboard
        localStorage.setItem('extracted_messages', JSON.stringify(result.messages));
        alert(`Successfully extracted ${result.message_count} messages!`);
        navigate('/new-dashboard');
    };

    if (loading) {
        return (
            <div className="slack-callback">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <h2>Connecting to Slack...</h2>
                    <p>Please wait while we complete the authorization</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="slack-callback">
                <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <h2>Authorization Failed</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate('/')} className="back-button">
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="slack-callback">
            <SlackWorkspaces 
                accessToken={accessToken} 
                onExtractComplete={handleExtractComplete}
            />
        </div>
    );
};

export default SlackCallback;
