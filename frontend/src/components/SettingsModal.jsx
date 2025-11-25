/**
 * Settings Modal - Configure chat settings and data source
 * Replaces SlackConnect functionality
 */
import { useState, useRef, useEffect } from 'react';
import { testSlackConnection, fetchSlackMessages } from '../services/clusteringApi';
import { getChatSettings, saveChatSettings, updateChat, saveChatMessages } from '../services/chatService';
import './SettingsModal.css';

// Import SVG icons
import SettingsIcon from '../assets/settings.svg';
import AlertIcon from '../assets/alert-triangle.svg';
import CheckIcon from '../assets/check.svg';
import RefreshIcon from '../assets/refresh.svg';
import SearchIcon from '../assets/search.svg';
import UploadIcon from '../assets/upload.svg';
import SaveIcon from '../assets/device-floppy.svg';
import SlackIcon from '../assets/brand-slack.svg';

const SettingsModal = ({ chatId, currentChat, onClose, onSettingsUpdate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const fileInputRef = useRef(null);

  // General settings
  const [chatTitle, setChatTitle] = useState(currentChat?.title || '');
  const [distanceThreshold, setDistanceThreshold] = useState(0.5);
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [maxClusters, setMaxClusters] = useState(10);
  const [useCache, setUseCache] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(false);

  // Data source settings
  const [slackToken, setSlackToken] = useState('');
  const [includePublic, setIncludePublic] = useState(true);
  const [includePrivate, setIncludePrivate] = useState(true);
  const [includeDms, setIncludeDms] = useState(false);
  const [includePermalinks, setIncludePermalinks] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getChatSettings(chatId);
        
        if (settings.clustering) {
          setDistanceThreshold(settings.clustering.distanceThreshold || 0.5);
          setMinClusterSize(settings.clustering.minClusterSize || 2);
          setMaxClusters(settings.clustering.maxClusters || 10);
        }
        
        if (settings.ui) {
          setUseCache(settings.ui.useCache !== undefined ? settings.ui.useCache : true);
          setAutoUpdate(settings.ui.autoUpdate || false);
        }

        if (settings.dataSource && settings.dataSource.type === 'slack') {
          setSlackToken(settings.dataSource.token || '');
          setIncludePublic(settings.dataSource.includePublic !== undefined ? settings.dataSource.includePublic : true);
          setIncludePrivate(settings.dataSource.includePrivate !== undefined ? settings.dataSource.includePrivate : true);
          setIncludeDms(settings.dataSource.includeDms || false);
          setIncludePermalinks(settings.dataSource.includePermalinks || false);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };

    loadSettings();
  }, [chatId]);

  // Save general settings
  const handleSaveGeneralSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update chat title if changed
      if (chatTitle !== currentChat?.title) {
        await updateChat(chatId, { title: chatTitle });
      }

      // Save settings
      await saveChatSettings(chatId, {
        clustering: {
          distanceThreshold,
          minClusterSize,
          maxClusters,
        },
        ui: {
          useCache,
          autoUpdate,
        },
      });

      setSuccess('Settings saved successfully!');
      onSettingsUpdate?.({
        title: chatTitle,
        clustering: { distanceThreshold, minClusterSize, maxClusters },
        ui: { useCache, autoUpdate },
      });

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Test Slack connection
  const handleTestConnection = async () => {
    if (!slackToken.trim()) {
      setError('Please enter a Slack token');
      return;
    }

    setTesting(true);
    setError(null);
    setConnectionStatus(null);

    try {
      const result = await testSlackConnection(slackToken);
      
      if (result.ok) {
        setConnectionStatus({
          success: true,
          message: `Connected as ${result.user} in ${result.team}`,
          user: result.user,
          team: result.team
        });
      } else {
        setError(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Connection test error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  // Fetch messages from Slack
  const handleFetchSlackMessages = async () => {
    if (!slackToken.trim()) {
      setError('Please enter a Slack token');
      return;
    }

    if (!includePublic && !includePrivate && !includeDms) {
      setError('Please select at least one message source');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const messages = await fetchSlackMessages(
        slackToken,
        includePublic,
        includePrivate,
        includeDms,
        includePermalinks
      );

      if (messages.length === 0) {
        setError('No messages found. Try different options.');
        setLoading(false);
        return;
      }

      // Save messages to chat
      await saveChatMessages(chatId, messages);

      // Save data source settings
      await saveChatSettings(chatId, {
        dataSource: {
          type: 'slack',
          token: slackToken,
          includePublic,
          includePrivate,
          includeDms,
          includePermalinks,
        },
      });

      setSuccess(`Successfully imported ${messages.length} messages!`);
      onSettingsUpdate?.({ messagesUpdated: true });
      
      setTimeout(() => {
        setSuccess(null);
        onClose?.();
      }, 2000);
    } catch (err) {
      console.error('Fetch messages error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Clear previous messages
    setError(null);
    setSuccess(null);
    setLoading(true);

    const reader = new FileReader();
    
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        
        if (!Array.isArray(json)) {
          setError('JSON must be an array of messages');
          setLoading(false);
          return;
        }

        if (json.length === 0) {
          setError('JSON file is empty');
          setLoading(false);
          return;
        }

        // Validate message structure
        const isValid = json.every(msg => 
          msg.text && 
          msg.channel && 
          msg.user && 
          msg.timestamp
        );

        if (!isValid) {
          setError('Each message must have: text, channel, user, timestamp');
          setLoading(false);
          return;
        }

        console.log(`Uploading ${json.length} messages...`);
        await saveChatMessages(chatId, json);
        
        setSuccess(`Successfully imported ${json.length} messages!`);
        onSettingsUpdate?.({ messagesUpdated: true });

        setTimeout(() => {
          setSuccess(null);
          onClose?.();
        }, 2000);
      } catch (err) {
        console.error('File upload error:', err);
        if (err instanceof SyntaxError) {
          setError('Invalid JSON format');
        } else {
          setError(err.message || 'Failed to upload messages');
        }
      } finally {
        setLoading(false);
        // Reset file input so same file can be uploaded again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>
            <img src={SettingsIcon} alt="" className="header-icon" />
            Chat Settings
          </h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab-button ${activeTab === 'clustering' ? 'active' : ''}`}
            onClick={() => setActiveTab('clustering')}
          >
            Clustering
          </button>
          <button
            className={`tab-button ${activeTab === 'datasource' ? 'active' : ''}`}
            onClick={() => setActiveTab('datasource')}
          >
            Data Source
          </button>
        </div>

        <div className="settings-modal-body">
          {error && (
            <div className="error-message">
              <img src={AlertIcon} alt="" className="message-icon" />
              {error}
            </div>
          )}
          {success && (
            <div className="success-message">
              <img src={CheckIcon} alt="" className="message-icon" />
              {success}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="form-group">
                <label>Chat Title</label>
                <input
                  type="text"
                  value={chatTitle}
                  onChange={(e) => setChatTitle(e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useCache}
                    onChange={(e) => setUseCache(e.target.checked)}
                  />
                  <span>Use Cache</span>
                </label>
                <small className="form-hint">Cache clustering results for faster loading</small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                  />
                  <span>Auto Update</span>
                </label>
                <small className="form-hint">Automatically re-cluster when messages change</small>
              </div>

              <button
                onClick={handleSaveGeneralSettings}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '💾 Saving...' : '💾 Save Settings'}
              </button>
            </div>
          )}

          {/* Clustering Tab */}
          {activeTab === 'clustering' && (
            <div className="settings-section">
              <div className="form-group">
                <label>Distance Threshold: {distanceThreshold}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={distanceThreshold}
                  onChange={(e) => setDistanceThreshold(parseFloat(e.target.value))}
                  className="slider"
                />
                <small className="form-hint">Lower values create fewer, larger clusters</small>
              </div>

              <div className="form-group">
                <label>Minimum Cluster Size: {minClusterSize}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={minClusterSize}
                  onChange={(e) => setMinClusterSize(parseInt(e.target.value))}
                  className="slider"
                />
                <small className="form-hint">Minimum messages required to form a cluster</small>
              </div>

              <div className="form-group">
                <label>Maximum Clusters: {maxClusters}</label>
                <input
                  type="range"
                  min="3"
                  max="20"
                  step="1"
                  value={maxClusters}
                  onChange={(e) => setMaxClusters(parseInt(e.target.value))}
                  className="slider"
                />
                <small className="form-hint">Maximum number of clusters to create</small>
              </div>

              <button
                onClick={handleSaveGeneralSettings}
                disabled={loading}
                className="btn btn-primary"
              >
                <img src={loading ? RefreshIcon : SaveIcon} alt="" className={`btn-icon ${loading ? 'spin' : ''}`} />
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}

          {/* Data Source Tab */}
          {activeTab === 'datasource' && (
            <div className="settings-section">
              <h3>Import Messages</h3>

              {/* Slack Import */}
              <div className="data-source-option">
                <h4>
                  <img src={SlackIcon} alt="" className="source-icon" />
                  Slack
                </h4>
                <div className="form-group">
                  <label>Slack User Token</label>
                  <input
                    type="password"
                    value={slackToken}
                    onChange={(e) => setSlackToken(e.target.value)}
                    placeholder="xoxp-..."
                    className="settings-input"
                  />
                </div>

                {connectionStatus && (
                  <div className="connection-status success">
                    <img src={CheckIcon} alt="" className="message-icon" />
                    {connectionStatus.message}
                  </div>
                )}

                <div className="form-group">
                  <label>Message Sources</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={includePublic}
                        onChange={(e) => setIncludePublic(e.target.checked)}
                      />
                      <span>Public Channels</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={includePrivate}
                        onChange={(e) => setIncludePrivate(e.target.checked)}
                      />
                      <span>Private Channels</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={includeDms}
                        onChange={(e) => setIncludeDms(e.target.checked)}
                      />
                      <span>Direct Messages</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={includePermalinks}
                        onChange={(e) => setIncludePermalinks(e.target.checked)}
                      />
                      <span>Include Permalinks (slower)</span>
                    </label>
                  </div>
                </div>

                <div className="button-group">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || loading}
                    className="btn btn-secondary"
                  >
                    <img src={testing ? RefreshIcon : SearchIcon} alt="" className={`btn-icon ${testing ? 'spin' : ''}`} />
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={handleFetchSlackMessages}
                    disabled={loading || testing}
                    className="btn btn-primary"
                  >
                    <img src={loading ? RefreshIcon : UploadIcon} alt="" className={`btn-icon ${loading ? 'spin' : ''}`} />
                    {loading ? 'Fetching...' : 'Import Messages'}
                  </button>
                </div>
              </div>

              {/* JSON Upload */}
              <div className="data-source-option">
                <h4>
                  <img src={UploadIcon} alt="" className="source-icon" />
                  JSON File
                </h4>
                <p className="form-hint" style={{ marginBottom: '15px' }}>
                  Upload a JSON file containing an array of messages. Each message must have:
                  <code style={{ display: 'block', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '0.85em' }}>
                    {JSON.stringify({ text: "Message content", channel: "channel-name", user: "user-id", timestamp: "1234567890.123456" }, null, 2)}
                  </code>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  <img src={loading ? RefreshIcon : UploadIcon} alt="" className={`btn-icon ${loading ? 'spin' : ''}`} />
                  {loading ? 'Uploading...' : 'Upload JSON'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

