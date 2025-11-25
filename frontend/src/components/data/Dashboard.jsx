import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom";
import RadialClusterGraph from '../graph/RadialClusterGraph';
import SearchBar from '../graph/SearchBar';
import ClusterInfo from '../graph/ClusterInfo';
import SettingsModal from '../SettingsModal';
import { clusterMessages } from '../../services/clusteringApi';
import { getChatById, saveChatClusteringData, getChatSettings } from '../../services/chatService';
import { loadFromCacheStorage, saveToCacheStorage, clearAllCache } from '../../utils/cacheManager';
import "./Dashboard.css";
import Nav from '../Nav';

// Import SVG icons
import SettingsIcon from '../../assets/settings.svg';
import RefreshIcon from '../../assets/refresh.svg';
import TrashIcon from '../../assets/trash.svg';
import AlertIcon from '../../assets/alert-triangle.svg';

export default function Dashboard() {
  const { channelId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const chat = location.state?.chat;
  const autoCluster = location.state?.autoCluster;

  // State
  const [currentChat, setCurrentChat] = useState(chat || null);
  const [messages, setMessages] = useState([]);
  const [clusteringData, setClusteringData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  
  // Settings
  const [useCache, setUseCache] = useState(true);
  const [distanceThreshold, setDistanceThreshold] = useState(0.5);
  const [minClusterSize, setMinClusterSize] = useState(2);

  // Load chat data
  useEffect(() => {
    const loadChatData = async () => {
      if (!channelId) {
        navigate('/home');
        return;
      }

      try {
        const chatData = await getChatById(channelId);
        setCurrentChat(chatData);
        setMessages(chatData.messages || []);

        // Load cached clustering data if available
        if (chatData.clustering_data && Object.keys(chatData.clustering_data).length > 0) {
          setClusteringData(chatData.clustering_data);
        }

        // Load settings
        const settings = await getChatSettings(channelId);
        if (settings.clustering) {
          setDistanceThreshold(settings.clustering.distanceThreshold || 0.5);
          setMinClusterSize(settings.clustering.minClusterSize || 2);
        }
        if (settings.ui) {
          setUseCache(settings.ui.useCache !== undefined ? settings.ui.useCache : true);
        }

        // Auto-cluster if requested
        if (autoCluster && chatData.messages?.length >= 2) {
          handleCluster(false, chatData.messages);
        }
      } catch (err) {
        console.error('Error loading chat:', err);
        setError('Failed to load chat data');
      }
    };

    loadChatData();
  }, [channelId, autoCluster, navigate]);

  // Handle clustering
  const handleCluster = async (forceRecluster = false, messagesToCluster = messages) => {
    if (messagesToCluster.length < 2) {
      setError('Please upload at least 2 messages to cluster');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (useCache && !forceRecluster) {
        const cached = loadFromCacheStorage(messagesToCluster);
        if (cached) {
          setClusteringData(cached);
          setLoading(false);
          return;
        }
      }

      // Call clustering API with custom parameters
      const result = await clusterMessages(
        messagesToCluster,
        forceRecluster,
        distanceThreshold,
        minClusterSize
      );
      
      setClusteringData(result);
      
      // Save to cache and database
      if (useCache) {
        saveToCacheStorage(messagesToCluster, result);
      }
      await saveChatClusteringData(channelId, result);
    } catch (err) {
      console.error('Clustering error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to cluster messages');
    } finally {
      setLoading(false);
    }
  };

  // Handle cluster selection
  const handleClusterClick = (clusterNode) => {
    setSelectedCluster(clusterNode);
    // Auto-open filter panel when cluster is selected
    if (!filterPanelOpen) {
      setFilterPanelOpen(true);
    }
  };

  // Handle back button from graph
  const handleBackClick = () => {
    setSelectedCluster(null);
  };

  // Handle message click - redirect to permalink
  const handleMessageClick = (message) => {
    if (message.permalink) {
      window.open(message.permalink, '_blank');
    } else {
      console.log('No permalink available for message:', message);
    }
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Handle settings update
  const handleSettingsUpdate = async (updates) => {
    if (updates.title) {
      setCurrentChat({ ...currentChat, title: updates.title });
    }

    if (updates.clustering) {
      setDistanceThreshold(updates.clustering.distanceThreshold);
      setMinClusterSize(updates.clustering.minClusterSize);
    }

    if (updates.ui) {
      setUseCache(updates.ui.useCache);
    }

    if (updates.messagesUpdated) {
      // Reload chat data
      const chatData = await getChatById(channelId);
      setMessages(chatData.messages || []);
      
      // Auto-cluster new messages
      if (chatData.messages?.length >= 2) {
        handleCluster(true, chatData.messages);
      }
    }
  };

  return (
    <div className="dashboard">
      {/* Header with back button and settings */}
      <Nav/>

      {/* Main content area */}
      <div className="dashboard-content">
        {/* Graph section */}
        <div className={`graph-container ${filterPanelOpen ? 'with-panel' : 'full-width'}`}>
          {error && (
            <div className="error-banner">
              <img src={AlertIcon} alt="" className="banner-icon" />
              {error}
            </div>
          )}

          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Clustering messages...</p>
            </div>
          )}

          <RadialClusterGraph 
            clusteringData={clusteringData}
            onClusterClick={handleClusterClick}
            onMessageClick={handleMessageClick}
            searchQuery={searchQuery}
            selectedClusterId={selectedCluster?.id}
            onBackClick={handleBackClick}
          />

          {!clusteringData && messages.length >= 2 && (
            <div className="cluster-prompt">
              <button
                className="btn-cluster"
                onClick={() => handleCluster(false)}
                disabled={loading}
              >
                Cluster Messages
              </button>
            </div>
          )}

          {messages.length < 2 && (
            <div className="empty-state">
              <p>No messages loaded</p>
              <button
                className="btn-settings"
                onClick={() => setShowSettings(true)}
              >
                <img src={SettingsIcon} alt="" className="button-icon" />
                Open Settings to Import Messages
              </button>
            </div>
          )}
        </div>

        {/* Sliding filter panel */}
        <div className={`filter-panel ${filterPanelOpen ? 'open' : 'closed'}`}>
          <button
            className="panel-toggle"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            title={filterPanelOpen ? 'Hide panel' : 'Show panel'}
          >
            {filterPanelOpen ? '→' : '←'}
          </button>

          {filterPanelOpen && (
            <div className="panel-content">
              {/* Stats */}
              {clusteringData && (
                <div className="dashboard-stats">
                  <div className="stat-item">
                    <span className="stat-label">Messages:</span>
                    <span className="stat-value">{clusteringData.metadata.total_messages}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Clusters:</span>
                    <span className="stat-value">{clusteringData.metadata.total_clusters}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Processing Time:</span>
                    <span className="stat-value">
                      {clusteringData.metadata.processing_time_seconds.toFixed(2)}s
                    </span>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="panel-section">
                <h3>Search</h3>
                <SearchBar 
                  onSearch={handleSearch}
                  placeholder="Search messages or topics..."
                />
              </div>

              <button
                className="settings-button"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <img src={SettingsIcon} alt="" className="button-icon" />
                Settings
              </button>

              {/* Cluster actions */}
              {clusteringData && (
                <div className="panel-section">
                  <h3>Actions</h3>
                  <button
                    className="btn-action"
                    onClick={() => handleCluster(true)}
                    disabled={loading}
                  >
                    <img src={RefreshIcon} alt="" className="action-icon" />
                    Re-cluster
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => {
                      clearAllCache();
                      alert('Cache cleared!');
                    }}
                  >
                    <img src={TrashIcon} alt="" className="action-icon" />
                    Clear Cache
                  </button>
                </div>
              )}

              {/* Back button when cluster selected */}
              {selectedCluster && (
                <div className="panel-section">
                  <button
                    className="btn-back-panel"
                    onClick={() => setSelectedCluster(null)}
                  >
                    ← Back to All Clusters
                  </button>
                </div>
              )}

              {/* Selected cluster info */}
              {selectedCluster && (
                <div className="panel-section">
                  <ClusterInfo 
                    cluster={selectedCluster}
                    onClose={() => setSelectedCluster(null)}
                  />
                </div>
              )}

              {/* All clusters list */}
              {!selectedCluster && clusteringData && (
                <div className="panel-section">
                  <h3>All Clusters</h3>
                  <div className="clusters-list">
                    {clusteringData.clusters.map(cluster => (
                      <div 
                        key={cluster.cluster_id} 
                        className="cluster-list-item"
                        onClick={() => handleClusterClick({
                          id: cluster.cluster_id,
                          label: cluster.label,
                          tags: cluster.tags,
                          size: cluster.size,
                          messages: clusteringData.messages.filter(
                            m => m.cluster_id === cluster.cluster_id
                          )
                        })}
                      >
                        <h4>{cluster.label}</h4>
                        <p className="cluster-size">{cluster.size} messages</p>
                        <div className="cluster-tags">
                          {cluster.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          chatId={channelId}
          currentChat={currentChat}
          onClose={() => setShowSettings(false)}
          onSettingsUpdate={handleSettingsUpdate}
        />
      )}
    </div>
  );
}
