import { useState, useEffect } from 'react';
import './SlackWorkspaces.css';

const SlackWorkspaces = ({ accessToken, onExtractComplete }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workspaceData, setWorkspaceData] = useState(null);
    const [selectedChannels, setSelectedChannels] = useState(new Set());
    const [selectedUsers, setSelectedUsers] = useState(new Set());

    useEffect(() => {
        if (accessToken) {
            loadWorkspaceData();
        }
    }, [accessToken]);

    const loadWorkspaceData = async () => {
        try {
            setLoading(true);
            setError(null);

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(
                `${apiUrl}/slack/workspaces?access_token=${encodeURIComponent(accessToken)}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch workspace data');
            }

            const data = await response.json();
            setWorkspaceData(data);

            // Auto-select all channels and non-bot users by default
            const channelIds = new Set(data.channels.map(c => c.id));
            setSelectedChannels(channelIds);

            const activeUserIds = new Set(
                data.users
                    .filter(u => !u.deleted && !u.is_bot)
                    .map(u => u.id)
            );
            setSelectedUsers(activeUserIds);

        } catch (err) {
            console.error('Error loading workspace data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleChannel = (channelId) => {
        const newSelected = new Set(selectedChannels);
        if (newSelected.has(channelId)) {
            newSelected.delete(channelId);
        } else {
            newSelected.add(channelId);
        }
        setSelectedChannels(newSelected);
    };

    const toggleUser = (userId) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const selectAllChannels = () => {
        setSelectedChannels(new Set(workspaceData.channels.map(c => c.id)));
    };

    const selectNoneChannels = () => {
        setSelectedChannels(new Set());
    };

    const selectPublicOnly = () => {
        setSelectedChannels(
            new Set(workspaceData.channels.filter(c => !c.is_private).map(c => c.id))
        );
    };

    const selectPrivateOnly = () => {
        setSelectedChannels(
            new Set(workspaceData.channels.filter(c => c.is_private).map(c => c.id))
        );
    };

    const selectAllUsers = () => {
        setSelectedUsers(
            new Set(workspaceData.users.filter(u => !u.deleted && !u.is_bot).map(u => u.id))
        );
    };

    const selectNoneUsers = () => {
        setSelectedUsers(new Set());
    };

    const handleExtract = async () => {
        if (selectedChannels.size === 0 || selectedUsers.size === 0) {
            alert('Please select at least one channel and one user');
            return;
        }

        // Get selected channel and user objects
        const selectedChannelObjects = workspaceData.channels.filter(c => selectedChannels.has(c.id));
        const selectedUserObjects = activeUsers.filter(u => selectedUsers.has(u.id));
        
        // Create confirmation message
        const confirmMessage = `Would extract messages from:\n\n📁 ${selectedChannels.size} channels:\n${selectedChannelObjects.map(c => '  • ' + c.name).join('\n')}\n\n👥 ${selectedUsers.size} users:\n${selectedUserObjects.map(u => '  • ' + (u.real_name || u.name)).join('\n')}\n\n(Backend integration needed)`;
        
        // Show confirmation alert
        alert(confirmMessage);
        
        // Log to console
        console.log('Extracting messages from channels:', selectedChannelObjects);
        console.log('Extracting messages from users:', selectedUserObjects);
        console.log('Access Token:', accessToken);

        // TODO: Backend integration
        // try {
        //     const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        //     const response = await fetch(`${apiUrl}/slack/extract`, {
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/json',
        //         },
        //         body: JSON.stringify({
        //             access_token: accessToken,
        //             channel_ids: Array.from(selectedChannels),
        //             user_ids: Array.from(selectedUsers),
        //         }),
        //     });

        //     if (!response.ok) {
        //         throw new Error('Failed to extract messages');
        //     }

        //     const result = await response.json();
        //     
        //     if (onExtractComplete) {
        //         onExtractComplete(result);
        //     } else {
        //         alert(`Successfully extracted ${result.message_count} messages!`);
        //     }
        // } catch (err) {
        //     console.error('Error extracting messages:', err);
        //     alert(`Error: ${err.message}`);
        // }
    };

    if (loading) {
        return (
            <div className="slack-workspaces">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Loading your workspaces...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="slack-workspaces">
                <div className="error">
                    <div className="error-icon">⚠️</div>
                    <h2>Failed to Load Workspaces</h2>
                    <p>{error}</p>
                    <button onClick={loadWorkspaceData} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!workspaceData) {
        return null;
    }

    const publicChannels = workspaceData.channels.filter(c => !c.is_private);
    const privateChannels = workspaceData.channels.filter(c => c.is_private);
    const workspace = workspaceData.workspace;
    const activeUsers = workspaceData.users.filter(u => !u.deleted && !u.is_bot);

    return (
        <div className="slack-workspaces">
            <div className="header">
                <h1>🚀 {workspace.name}</h1>
                <p className="subtitle">Select channels and users to extract messages</p>
            </div>

            <div className="stats">
                <div className="stat-item">
                    <div className="stat-number">{publicChannels.length}</div>
                    <div className="stat-label">Public Channels</div>
                </div>
                <div className="stat-item">
                    <div className="stat-number">{privateChannels.length}</div>
                    <div className="stat-label">Private Channels</div>
                </div>
                <div className="stat-item">
                    <div className="stat-number">{workspaceData.channels.length}</div>
                    <div className="stat-label">Total Channels</div>
                </div>
                <div className="stat-item">
                    <div className="stat-number">{activeUsers.length}</div>
                    <div className="stat-label">Active Users</div>
                </div>
            </div>

            <div className="workspace-card">
                <div className="workspace-header">
                    {workspace.icon?.image_132 ? (
                        <img 
                            src={workspace.icon.image_132} 
                            alt={workspace.name} 
                            className="workspace-icon-img"
                        />
                    ) : (
                        <div className="workspace-icon">
                            {workspace.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="workspace-info">
                        <h2>{workspace.name}</h2>
                        <div className="workspace-type">Primary Workspace</div>
                    </div>
                </div>
                <div className="workspace-details">
                    <div className="detail-row">
                        <span className="detail-label">Team ID:</span>
                        <span className="detail-value">{workspace.id}</span>
                    </div>
                    {workspace.domain && (
                        <div className="detail-row">
                            <span className="detail-label">Domain:</span>
                            <span className="detail-value">{workspace.domain}.slack.com</span>
                        </div>
                    )}
                </div>
                <span className="badge active">✓ Connected</span>
            </div>

            <div className="channels-section">
                <h2>📁 Select Channels to Extract</h2>
                <div className="select-controls">
                    <button className="select-btn" onClick={selectAllChannels}>
                        Select All
                    </button>
                    <button className="select-btn" onClick={selectNoneChannels}>
                        Select None
                    </button>
                    <button className="select-btn" onClick={selectPublicOnly}>
                        Public Only
                    </button>
                    <button className="select-btn" onClick={selectPrivateOnly}>
                        Private Only
                    </button>
                </div>
                <div className="channel-list">
                    {workspaceData.channels.map(channel => (
                        <div
                            key={channel.id}
                            className={`channel-item ${selectedChannels.has(channel.id) ? 'selected' : ''}`}
                            onClick={() => toggleChannel(channel.id)}
                        >
                            <input
                                type="checkbox"
                                className="channel-checkbox"
                                checked={selectedChannels.has(channel.id)}
                                onChange={() => toggleChannel(channel.id)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="channel-icon">
                                {channel.is_private ? '🔒' : '#'}
                            </span>
                            <div className="channel-info">
                                <div className="channel-name">{channel.name}</div>
                                <div className="channel-meta">
                                    {channel.is_private ? 'Private' : 'Public'} • 
                                    {channel.num_members ? ` ${channel.num_members} members` : ''}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="users-section">
                <h2>👥 Select Users to Extract Messages From</h2>
                <div className="select-controls">
                    <button className="select-btn" onClick={selectAllUsers}>
                        Select All
                    </button>
                    <button className="select-btn" onClick={selectNoneUsers}>
                        Select None
                    </button>
                </div>
                <div className="user-list">
                    {activeUsers.map(user => (
                        <div
                            key={user.id}
                            className={`user-item ${selectedUsers.has(user.id) ? 'selected' : ''}`}
                            onClick={() => toggleUser(user.id)}
                        >
                            <input
                                type="checkbox"
                                className="user-checkbox"
                                checked={selectedUsers.has(user.id)}
                                onChange={() => toggleUser(user.id)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {user.profile?.image_32 && (
                                <img 
                                    src={user.profile.image_32} 
                                    alt={user.real_name || user.name} 
                                    className="user-avatar"
                                />
                            )}
                            <div className="user-info">
                                <div className="user-name">
                                    {user.real_name || user.name}
                                </div>
                                {user.profile?.status_text && (
                                    <div className="user-status">{user.profile.status_text}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    className="extract-button"
                    onClick={handleExtract}
                    disabled={selectedChannels.size === 0 || selectedUsers.size === 0}
                >
                    {selectedChannels.size === 0 || selectedUsers.size === 0
                        ? selectedChannels.size === 0 
                            ? 'Select at least one channel' 
                            : 'Select at least one user'
                        : `Extract from ${selectedChannels.size} Channel${selectedChannels.size !== 1 ? 's' : ''} × ${selectedUsers.size} User${selectedUsers.size !== 1 ? 's' : ''}`
                    }
                </button>
            </div>
        </div>
    );
};

export default SlackWorkspaces;
