/**
 * Settings Modal - Configure chat settings and data sources
 */
import { useState, useEffect, useRef } from 'react';
import { Settings, X, Upload, FileJson } from 'lucide-react';
import { initiateSlackAuth, getSlackToken } from '../services/slackAuth';
import { createChat, saveChatMessages, saveChatClusteringData } from '../services/chatService';
import { processClusteringGemini, checkGeminiApiStatus } from '../services/clusteringApi';
import { fetchSlackMessages } from '../services/clusteringApi';
import { useAuth } from '../AuthContext';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose, onChatCreated, activeChat, activeChatData }) => {
  const { session } = useAuth();
  const fileInputRef = useRef(null);

  const [timeFilter, setTimeFilter] = useState('3 Months');
  const [includeDMs, setIncludeDMs] = useState(false);
  const [enableSemanticSearch, setEnableSemanticSearch] = useState(true);
  const [slackConnected, setSlackConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [clustering, setClustering] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);
  const [slackToken, setSlackToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [fetchingMessages, setFetchingMessages] = useState(false);

  useEffect(() => {
    if (isOpen && session) {
      checkSlackConnection();
      checkApiStatus();
    }
  }, [isOpen, session]);

  const checkApiStatus = async () => {
    try {
      const status = await checkGeminiApiStatus();
      setApiStatus(status);
      if (status.is_quota_error) {
        console.warn('⚠️ Gemini API quota/rate limit detected');
      }
    } catch (error) {
      console.error('Failed to check API status:', error);
      setApiStatus({ status: 'unknown', message: 'Could not check API status' });
    }
  };

  const checkSlackConnection = async () => {
    try {
      const token = await getSlackToken();
      setSlackConnected(!!token);
    } catch (error) {
      console.warn('Could not check Slack connection:', error.message);
      setSlackConnected(false);
    }
  };

  const handleSlackConnect = () => initiateSlackAuth();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('Reading file...');

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      let messages = [];
      if (Array.isArray(jsonData)) messages = jsonData;
      else if (jsonData.messages && Array.isArray(jsonData.messages)) messages = jsonData.messages;
      else throw new Error('Invalid JSON format. Expected an array of messages.');

      const requiredFields = ['text', 'channel', 'user', 'timestamp'];
      const validMessages = messages.filter(msg =>
        requiredFields.every(field => msg.hasOwnProperty(field))
      );

      if (validMessages.length === 0) throw new Error('No valid messages found.');

      setUploadStatus(`Found ${validMessages.length} valid messages. Creating chat...`);

      // Create a new chat
      const chatTitle = file.name.replace('.json', '');
      const newChat = await createChat({
        title: chatTitle,
        source: 'json_upload',
        config: { timeFilter, includeDMs, enableSemanticSearch, uploadedAt: new Date().toISOString() }
      });

      setUploadStatus('Saving messages...');
      await saveChatMessages(newChat.id, validMessages);

      // Run AI clustering
      setUploadStatus('Running AI clustering...');
      setClustering(true);

      let clusteringResult;
      try {
        clusteringResult = await processClusteringGemini(
          validMessages.map(msg => ({
            text: msg.text,
            channel: msg.channel,
            user: msg.user,
            timestamp: msg.timestamp,
            link: msg.permalink || ''
          })),
          0.5 // sensitivity; backend can auto-adjust
        );
      } catch (error) {
        if (error.response?.status === 429 || 
            error.message?.toLowerCase().includes('quota') ||
            error.message?.toLowerCase().includes('rate limit')) {
          setUploadStatus(`Error: Gemini API quota/rate limit exceeded. ${error.message}`);
          setClustering(false);
          setUploading(false);
          await checkApiStatus();
          return;
        }
        throw error;
      }

      // Backend now returns optimal clusters + messages
      const graphData = clusteringResult;

      setUploadStatus('Saving clustering data...');
      console.log("=== Saving Clustering Data ===");
      console.log("Chat ID:", newChat.id);
      console.log("Nodes count:", graphData.nodes.length);
      console.log("Links count:", graphData.links.length);

      const saveResult = await saveChatClusteringData(newChat.id, graphData);
      console.log("Save result:", saveResult?.clustering_data);
      setUploadStatus('✓ Chat created successfully!');

      if (onChatCreated) onChatCreated(newChat, graphData);

      setTimeout(() => {
        onClose();
        setUploadStatus('');
        setUploading(false);
        setClustering(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setUploadStatus(`Error: ${err.message}`);
      setUploading(false);
      setClustering(false);
    }
  };

  const handleFetchAndCluster = async () => {
    if (!slackToken || !channelId) {
      setUploadStatus('Error: Slack token and channel ID are required.');
      return;
    }

    setFetchingMessages(true);
    setUploadStatus('Fetching messages from Slack...');

    try {
      const messages = await fetchSlackMessages(slackToken, channelId);
      if (!messages || messages.length === 0) {
        throw new Error('No messages found in the specified channel.');
      }

      setUploadStatus('Saving messages to Supabase...');
      const savedChat = await saveMessagesToSupabase(messages, { slackToken, channelId });

      setUploadStatus('Running AI clustering...');
      const clusteringResult = await processClusteringGemini(
        messages.map(msg => ({
          text: msg.text,
          channel: msg.channel,
          user: msg.user,
          timestamp: msg.timestamp,
          link: msg.permalink || ''
        })),
        0.5
      );

      setUploadStatus('Saving clustering data...');
      await saveChatClusteringData(savedChat.id, clusteringResult);

      setUploadStatus('✓ Chat created successfully!');
      if (onChatCreated) onChatCreated(savedChat, clusteringResult);

      setTimeout(() => {
        onClose();
        setUploadStatus('');
        setFetchingMessages(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      setUploadStatus(`Error: ${error.message}`);
      setFetchingMessages(false);
    }
  };

  const handleSave = () => onClose();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Settings className="highlight" size={20} /> {activeChat ? 'Chat Settings' : 'New Chat'}</h2>
          <button onClick={onClose} className="btn-icon-close"><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* API Status Warning */}
          {apiStatus && apiStatus.is_quota_error && (
            <div className="form-group">
              <div className="api-status-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <div className="warning-title">Gemini API Quota Exceeded</div>
                  <div className="warning-message">
                    The API key has hit its rate limit or quota. Clustering may fail.
                    {apiStatus.error && <div className="warning-detail">Error: {apiStatus.error}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {apiStatus && apiStatus.status === 'healthy' && (
            <div className="form-group">
              <div className="api-status-success">
                <div className="success-icon">✓</div>
                <div className="success-message">Gemini API is working correctly</div>
              </div>
            </div>
          )}

          {/* Cluster Statistics for Existing Chat */}
          {activeChat && activeChatData && activeChatData.nodes && (
            <div className="form-group">
              <label className="form-label">Cluster Statistics</label>
              <div className="cluster-stats">
                <div className="stat-item">
                  <div className="stat-value">{activeChatData.nodes.filter(n => n.type === 'cluster').length}</div>
                  <div className="stat-label">Clusters</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{activeChatData.nodes.filter(n => n.type === 'message').length}</div>
                  <div className="stat-label">Messages</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{activeChatData.links?.length || 0}</div>
                  <div className="stat-label">Connections</div>
                </div>
              </div>

              {activeChatData.nodes.filter(n => n.type === 'cluster').length > 0 && (
                <div className="cluster-list">
                  <p className="form-hint" style={{ marginTop: '12px', marginBottom: '8px' }}>Cluster Topics:</p>
                  <ul className="cluster-topics">
                    {activeChatData.nodes
                      .filter(n => n.type === 'cluster')
                      .slice(0, 10) // show first 10 clusters only
                      .map((cluster, idx) => {
                        const clusterId = cluster.id || `cluster-${idx}`;
                        const messageCount = activeChatData.links?.filter(l => {
                          const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                          return sourceId === clusterId;
                        }).length || 0;
                        return (
                          <li key={clusterId} className="cluster-topic-item">
                            <span className="cluster-topic-name">{cluster.name || `Cluster ${idx + 1}`}</span>
                            <span className="cluster-topic-count">
                              ({messageCount} {messageCount === 1 ? 'message' : 'messages'})
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* JSON Upload */}
          <div className="form-group">
            <label className="form-label"><FileJson size={16} /> Upload JSON File</label>
            <div className="upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={uploading || !session}
              />
              <button onClick={() => fileInputRef.current?.click()} className="btn-upload" disabled={uploading || !session}>
                <Upload size={16} /> {uploading ? 'Uploading...' : 'Choose JSON File'}
              </button>
              {uploadStatus && <div className={`upload-status ${uploadStatus.startsWith('Error') ? 'error' : 'success'}`}>{uploadStatus}</div>}
              {clustering && <div className="clustering-spinner"><div className="spinner"></div><span>AI is analyzing your messages...</span></div>}
            </div>
            <p className="form-hint">
              <p>Format: <code>[{'{'}text, channel, user, timestamp, permalink{'}'}, ...]</code></p>
              <p>Note: Larger files may take larger to process</p>
            </p>
            {!session && <p className="form-hint error-text">Please sign in to upload files</p>}
          </div>

          {/* Slack Integration */}
          <div className="form-group">
            <label className="form-label">Slack Token</label>
            <input
              type="text"
              value={slackToken}
              onChange={e => setSlackToken(e.target.value)}
              placeholder="Enter your Slack token"
              disabled={fetchingMessages}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Channel ID</label>
            <input
              type="text"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="Enter the Slack channel ID"
              disabled={fetchingMessages}
            />
          </div>
          <div className="form-group">
            <button
              onClick={handleFetchAndCluster}
              className="btn-fetch"
              disabled={fetchingMessages || !session}
            >
              {fetchingMessages ? 'Fetching...' : 'Fetch and Cluster Messages'}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Connect Slack</label>
            <div className="integration-card">
              <div className="integration-info">
                <div className={`status-dot ${slackConnected ? 'connected' : 'disconnected'}`}></div>
                <div>
                  <div className="integration-title">{slackConnected ? 'Slack Connected' : 'Slack Not Connected'}</div>
                  <div className="integration-subtitle">{slackConnected ? 'Ready to sync messages' : 'Connect to import messages'}</div>
                </div>
              </div>
              <button className="btn-resync" onClick={handleSlackConnect} disabled={!session}>
                {slackConnected ? 'Re-sync' : 'Connect'}
              </button>
            </div>
            {!session && <p className="form-hint error-text">Please sign in to connect Slack</p>}
          </div>

          {/* Options */}
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={includeDMs} onChange={e => setIncludeDMs(e.target.checked)} />
              Include Direct Messages (DMs)
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={enableSemanticSearch} onChange={e => setEnableSemanticSearch(e.target.checked)} />
              Enable Semantic Search (Beta)
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} className="btn-save">Done</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
