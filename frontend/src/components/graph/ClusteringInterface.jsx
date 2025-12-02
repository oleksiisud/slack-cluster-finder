/**
 * Main interface for clustering chat messages
 */
import React, { useState, useEffect, useRef } from 'react';
import ClusterGraph from './ClusterGraph';
import SearchBar from './SearchBar';
import MessagePanel from './MessagePanel';
import ClusterInfo from './ClusterInfo';
import { clusterMessages } from '../../services/clusteringApi';
import { loadFromCacheStorage, saveToCacheStorage, clearAllCache } from '../../utils/cacheManager';
import './ClusteringInterface.css';

const ClusteringInterface = () => {
  const [messages, setMessages] = useState([]);
  const [clusteringData, setClusteringData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [useCache, setUseCache] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const fileInputRef = useRef(null);

  // Load sample data or from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('uploaded_messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
        // Try to load from cache
        if (useCache) {
          const cached = loadFromCacheStorage(parsed);
          if (cached) {
            setClusteringData(cached);
          }
        }
      } catch (err) {
        console.error('Failed to load saved messages:', err);
      }
    }
  }, [useCache]);

  // Handle clustering
  const handleCluster = async (forceRecluster = false) => {
    if (messages.length < 2) {
      setError('Please upload at least 2 messages to cluster');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (useCache && !forceRecluster) {
        const cached = loadFromCacheStorage(messages);
        if (cached) {
          setClusteringData(cached);
          setLoading(false);
          return;
        }
      }

      // Call clustering API
      const result = await clusterMessages(messages, forceRecluster);
      
      setClusteringData(result);
      
      // Save to cache
      if (useCache) {
        saveToCacheStorage(messages, result);
      }
    } catch (err) {
      console.error('Clustering error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to cluster messages');
    } finally {
      setLoading(false);
    }
  };

  // Handle messages upload
  const handleMessagesUpload = (uploadedMessages) => {
    setMessages(uploadedMessages);
    localStorage.setItem('uploaded_messages', JSON.stringify(uploadedMessages));
    setClusteringData(null); // Clear existing clustering
    setSelectedCluster(null);
    setSelectedMessage(null);
  };

  // Handle cluster selection
  const handleClusterClick = (clusterNode) => {
    setSelectedCluster(clusterNode);
    setSelectedMessage(null);
  };

  // Handle message selection
  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Clear cache
  const handleClearCache = () => {
    clearAllCache();
    alert('Cache cleared successfully!');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        validateAndUpload(json);
      } catch (err) {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const validateAndUpload = (data) => {
    setError(null);

    // Ensure data is an array
    if (!Array.isArray(data)) {
      setError('Data must be an array of messages');
      return;
    }

    // Validate message structure
    const isValid = data.every(msg => 
      msg.text && 
      msg.channel && 
      msg.user && 
      msg.timestamp
    );

    if (!isValid) {
      setError('Each message must have: text, channel, user, timestamp');
      return;
    }

    onUpload(data);
  };

  // Auto-clustering on message changes
  useEffect(() => {
    if (autoUpdate && messages.length >= 2) {
      handleCluster();
    }
  }, [messages, autoUpdate]);

  return (
    <div className="clustering-interface">
      <header className="clustering-header">
        <h1>🌌 Chat Message Clustering</h1>
        <p>AI-Powered Topic Discovery & Visualization</p>
      </header>

      <div className="clustering-controls">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <button onClick={() => fileInputRef.current.click()} className="btn btn-primary">Upload Messages</button>
        
        <div className="control-group">
          <button 
            onClick={() => handleCluster(false)} 
            disabled={loading || messages.length < 2}
            className="btn btn-primary"
          >
            {loading ? '🔄 Clustering...' : '🎯 Cluster Messages'}
          </button>
          
          <button 
            onClick={() => handleCluster(true)} 
            disabled={loading || messages.length < 2}
            className="btn btn-secondary"
          >
            🔄 Force Re-cluster
          </button>
        </div>

        <div className="control-group">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={useCache}
              onChange={(e) => setUseCache(e.target.checked)}
            />
            <span>Use Cache</span>
          </label>
          
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
            />
            <span>Auto-Update</span>
          </label>

          <button 
            onClick={handleClearCache}
            className="btn btn-warning"
          >
            🗑️ Clear Cache
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {clusteringData && (
        <div className="clustering-stats">
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

      <div className="clustering-main">
        <div className="graph-section">
          <SearchBar 
            onSearch={handleSearch}
            placeholder="Search messages or topics..."
          />
          
          <ClusterGraph 
            clusteringData={clusteringData}
            onClusterClick={handleClusterClick}
            onMessageClick={handleMessageClick}
            searchQuery={searchQuery}
            selectedClusterId={selectedCluster?.id}
          />
        </div>

        <div className="info-panel">
          {selectedCluster && (
            <ClusterInfo 
              cluster={selectedCluster}
              onClose={() => setSelectedCluster(null)}
            />
          )}
          
          {selectedMessage && (
            <MessagePanel 
              message={selectedMessage}
              onClose={() => setSelectedMessage(null)}
            />
          )}

          {!selectedCluster && !selectedMessage && clusteringData && (
            <div className="clusters-list">
              <h3>All Clusters</h3>
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
                    {cluster.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClusteringInterface;

