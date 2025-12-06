import { useState } from 'react';
import './SlackAuth.css';

const SlackAuth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSlackAuth = async () => {
        try {
            setLoading(true);
            setError(null);

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/auth/slack`);

            if (!response.ok) {
                throw new Error('Failed to initiate Slack authentication');
            }

            const data = await response.json();
            
            // Redirect to Slack OAuth page
            window.location.href = data.oauth_url;

        } catch (err) {
            console.error('Slack auth error:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="slack-auth-container">
            <div className="slack-auth-card">
                <div className="slack-icon">
                    <svg width="80" height="80" viewBox="0 0 124 124" fill="none">
                        <path d="M26.3996 78.3992C26.3996 84.6992 21.2996 89.7992 14.9996 89.7992C8.69961 89.7992 3.59961 84.6992 3.59961 78.3992C3.59961 72.0992 8.69961 66.9992 14.9996 66.9992H26.3996V78.3992Z" fill="#E01E5A"/>
                        <path d="M32.2 78.3992C32.2 72.0992 37.3 66.9992 43.6 66.9992C49.9 66.9992 55 72.0992 55 78.3992V109C55 115.3 49.9 120.4 43.6 120.4C37.3 120.4 32.2 115.3 32.2 109V78.3992Z" fill="#E01E5A"/>
                        <path d="M43.6 26.3996C37.3 26.3996 32.2 21.2996 32.2 14.9996C32.2 8.69961 37.3 3.59961 43.6 3.59961C49.9 3.59961 55 8.69961 55 14.9996V26.3996H43.6Z" fill="#36C5F0"/>
                        <path d="M43.6004 32.1992C49.9004 32.1992 55.0004 37.2992 55.0004 43.5992C55.0004 49.8992 49.9004 54.9992 43.6004 54.9992H13.0004C6.70039 54.9992 1.60039 49.8992 1.60039 43.5992C1.60039 37.2992 6.70039 32.1992 13.0004 32.1992H43.6004Z" fill="#36C5F0"/>
                        <path d="M97.6004 43.5992C97.6004 37.2992 102.7 32.1992 109 32.1992C115.3 32.1992 120.4 37.2992 120.4 43.5992C120.4 49.8992 115.3 54.9992 109 54.9992H97.6004V43.5992Z" fill="#2EB67D"/>
                        <path d="M91.7996 43.5996C91.7996 49.8996 86.6996 54.9996 80.3996 54.9996C74.0996 54.9996 68.9996 49.8996 68.9996 43.5996V13.0996C68.9996 6.79961 74.0996 1.69961 80.3996 1.69961C86.6996 1.69961 91.7996 6.79961 91.7996 13.0996V43.5996Z" fill="#2EB67D"/>
                        <path d="M80.3996 97.6004C86.6996 97.6004 91.7996 102.7 91.7996 109C91.7996 115.3 86.6996 120.4 80.3996 120.4C74.0996 120.4 68.9996 115.3 68.9996 109V97.6004H80.3996Z" fill="#ECB22E"/>
                        <path d="M80.3996 91.7996C74.0996 91.7996 68.9996 86.6996 68.9996 80.3996C68.9996 74.0996 74.0996 68.9996 80.3996 68.9996H110.9C117.2 68.9996 122.3 74.0996 122.3 80.3996C122.3 86.6996 117.2 91.7996 110.9 91.7996H80.3996Z" fill="#ECB22E"/>
                    </svg>
                </div>
                
                <h1>Connect Your Slack Workspace</h1>
                <p className="description">
                    Authenticate with Slack to access your workspaces, channels, and messages 
                    for clustering and analysis with AstralSearch.
                </p>

                {error && (
                    <div className="error-message">
                        <span className="error-icon">⚠️</span>
                        {error}
                    </div>
                )}

                <button 
                    onClick={handleSlackAuth} 
                    className="slack-connect-button"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="button-spinner"></span>
                            Connecting...
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 124 124" fill="currentColor">
                                <path d="M26.3996 78.3992C26.3996 84.6992 21.2996 89.7992 14.9996 89.7992C8.69961 89.7992 3.59961 84.6992 3.59961 78.3992C3.59961 72.0992 8.69961 66.9992 14.9996 66.9992H26.3996V78.3992Z"/>
                                <path d="M32.2 78.3992C32.2 72.0992 37.3 66.9992 43.6 66.9992C49.9 66.9992 55 72.0992 55 78.3992V109C55 115.3 49.9 120.4 43.6 120.4C37.3 120.4 32.2 115.3 32.2 109V78.3992Z"/>
                            </svg>
                            Connect with Slack
                        </>
                    )}
                </button>

                <div className="info-box">
                    <h3>What we'll access:</h3>
                    <ul>
                        <li>✓ Your workspace information</li>
                        <li>✓ Public and private channels you have access to</li>
                        <li>✓ Channel messages for analysis</li>
                        <li>✓ User information for attribution</li>
                    </ul>
                </div>

                <p className="privacy-note">
                    🔒 Your data is secure. We only access what you explicitly allow 
                    and never share your information with third parties.
                </p>
            </div>
        </div>
    );
};

export default SlackAuth;
