/**
 * Settings Modal - Configure chat settings and data sources
 */
import { useState, useEffect, useRef } from 'react';
import { Settings, X, Upload, FileJson, CheckCircle } from 'lucide-react';
import { initiateSlackAuth, getSlackToken } from '../services/slackAuth';
import { initiateDiscordAuth, getDiscordToken } from '../services/discordAuth';
import { createChat, saveChatMessages, saveChatClusteringData } from '../services/chatService';
import { processClusteringGemini } from '../services/clusteringApi';
import { useAuth } from '../AuthContext';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose, onChatCreated }) => {
  const { session } = useAuth();
  const [timeFilter, setTimeFilter] = useState('3 Months');
  const [includeDMs, setIncludeDMs] = useState(false);
  const [enableSemanticSearch, setEnableSemanticSearch] = useState(true);
  const [slackConnected, setSlackConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [clustering, setClustering] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && session) {
      checkSlackConnection();
      checkDiscordConnection();
    }
  }, [isOpen, session]);

  const checkSlackConnection = async () => {
    try {
      const token = await getSlackToken();
      setSlackConnected(!!token);
    } catch (error) {
      setSlackConnected(false);
    }
  };

  const checkDiscordConnection = async () => {
    try {
      const token = await getDiscordToken();
      setDiscordConnected(!!token);
    } catch (error) {
      setDiscordConnected(false);
    }
  };

  const handleSlackConnect = () => {
    initiateSlackAuth();
  };

  const handleDiscordConnect = () => {
    initiateDiscordAuth();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('Reading file...');

    try {
      // Read the file
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Validate JSON structure
      let messages = [];
      
      if (Array.isArray(jsonData)) {
        messages = jsonData;
      } else if (jsonData.messages && Array.isArray(jsonData.messages)) {
        messages = jsonData.messages;
      } else {
        throw new Error('Invalid JSON format. Expected an array of messages.');
      }

      // Validate message structure
      const requiredFields = ['text', 'channel', 'user', 'timestamp'];
      const validMessages = messages.filter(msg => {
        return requiredFields.every(field => msg.hasOwnProperty(field));
      });

      if (validMessages.length === 0) {
        throw new Error('No valid messages found. Each message must have: text, channel, user, timestamp');
      }

      setUploadStatus(`Found ${validMessages.length} valid messages. Creating chat...`);

      // Create a new chat
      const chatTitle = file.name.replace('.json', '');
      const newChat = await createChat({
        title: chatTitle,
        source: 'json_upload',
        config: {
          timeFilter,
          includeDMs,
          enableSemanticSearch,
          uploadedAt: new Date().toISOString()
        }
      });

      // Save messages to the chat
      setUploadStatus('Saving messages...');
      await saveChatMessages(newChat.id, validMessages);

      // Run clustering (optional - requires Gemini backend on port 8001)
      let clusteringResult = null;
      
      try {
        setUploadStatus('Running AI clustering...');
        setClustering(true);
        
        clusteringResult = await processClusteringGemini(
          validMessages.map(msg => ({
            text: msg.text,
            channel: msg.channel,
            user: msg.user,
            timestamp: msg.timestamp,
            link: msg.link || ''
          })),
          0.5 // Default sensitivity
        );
        
        // Save clustering data to database
        await saveChatClusteringData(newChat.id, clusteringResult);
        
      } catch (clusteringError) {
        console.warn('Clustering service unavailable, continuing without clustering:', clusteringError);
        setUploadStatus('Note: Clustering service unavailable. Chat created without clustering.');
        // clusteringResult remains null - will use mock data
      }
      
      setUploadStatus('✓ Chat created successfully!');
      
      // Notify parent component
      if (onChatCreated) {
        onChatCreated(newChat, clusteringResult);
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setUploadStatus('');
        setUploading(false);
        setClustering(false);
      }, 1500);

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus(`Error: ${error.message}`);
      setUploading(false);
      setClustering(false);
    }
  };

  const handleSave = () => {
    // Settings are saved automatically as they change
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Settings className="highlight" size={20} /> New Chat
          </h2>
          <button onClick={onClose} className="btn-icon-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* JSON Upload Section */}
          <div className="form-group">
            <label className="form-label">
              <FileJson size={16} style={{ display: 'inline', marginRight: '8px' }} />
              Upload JSON File
            </label>
            <div className="upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={uploading || !session}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-upload"
                disabled={uploading || !session}
              >
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Choose JSON File'}
              </button>
              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.startsWith('Error') ? 'error' : 'success'}`}>
                  {uploadStatus}
                </div>
              )}
              {clustering && (
                <div className="clustering-spinner">
                  <div className="spinner"></div>
                  <span>AI is analyzing your messages...</span>
                </div>
              )}
            </div>
            <p className="form-hint">
              Upload a JSON file with your chat messages. Format: 
              <code>[{'{'}text, channel, user, timestamp, link{'}'}, ...]</code>
            </p>
            {!session && (
              <p className="form-hint error-text">
                Please sign in to upload files
              </p>
            )}
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          {/* Slack Integration */}
          <div className="form-group">
            <label className="form-label">Connect Slack</label>
            <div className="integration-card">
              <div className="integration-info">
                <div className={`status-dot ${slackConnected ? 'connected' : 'disconnected'}`}></div>
                <div>
                  <div className="integration-title">
                    {slackConnected ? 'Slack Connected' : 'Slack Not Connected'}
                  </div>
                  <div className="integration-subtitle">
                    {slackConnected ? 'Ready to sync messages' : 'Connect to import messages'}
                  </div>
                </div>
              </div>
              <button 
                className="btn-resync"
                onClick={handleSlackConnect}
                disabled={!session}
              >
                {slackConnected ? 'Re-sync' : 'Connect'}
              </button>
            </div>
          {!session && (
            <p className="form-hint error-text">
              Please sign in to connect Slack
            </p>
          )}
          </div>

          {/* Discord Integration */}
          <div className="form-group">
            <label className="form-label">Connect Discord</label>
            <div className="integration-card">
              <div className="integration-info">
                <div className={`status-dot ${discordConnected ? 'connected' : 'disconnected'}`}></div>
                <div>
                  <div className="integration-title">
                    {discordConnected ? 'Discord Connected' : 'Discord Not Connected'}
                  </div>
                  <div className="integration-subtitle">
                    {discordConnected ? 'Ready to import messages' : 'Connect to import messages from Discord'}
                  </div>
                </div>
              </div>
              <button 
                className="btn-resync"
                onClick={handleDiscordConnect}
                disabled={!session}
              >
                {discordConnected ? 'Reconnect' : 'Connect'}
              </button>
            </div>
            {!session && (
              <p className="form-hint error-text">
                Please sign in to connect Discord
              </p>
            )}
          </div>

          {/* Settings */}
          <div className="form-group">
            <label className="form-label">Time Filter</label>
            <div className="filter-options">
              {['1 Month', '3 Months', 'All Time'].map((opt) => (
                <button
                  key={opt}
                  className={`filter-btn ${timeFilter === opt ? 'active' : 'inactive'}`}
                  onClick={() => setTimeFilter(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="form-hint">
              Filter messages by time range to optimize clustering performance.
            </p>
          </div>

          {/* Options */}
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={includeDMs}
                onChange={(e) => setIncludeDMs(e.target.checked)}
              />
              Include Direct Messages (DMs)
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={enableSemanticSearch}
                onChange={(e) => setEnableSemanticSearch(e.target.checked)}
              />
              Enable Semantic Search (Beta)
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-save">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;