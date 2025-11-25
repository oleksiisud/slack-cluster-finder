/**
 * Page for creating a new chat
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChat, saveChatMessages } from '../services/chatService';
import { testSlackConnection, fetchSlackMessages } from '../services/clusteringApi';
import Nav from '../components/Nav';
import './CreateChat.css';

// Import SVG icons
import SlackIcon from '../assets/brand-slack.svg';
import DiscordIcon from '../assets/brand-discord.svg';
import WhatsAppIcon from '../assets/brand-whatsapp.svg';
import UploadIcon from '../assets/upload.svg';
import CheckIcon from '../assets/check.svg';
import AlertIcon from '../assets/alert-triangle.svg';
import RefreshIcon from '../assets/refresh.svg';
import SearchIcon from '../assets/search.svg';

const CreateChat = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1); // 1: Choose source, 2: Configure, 3: Import
  const [chatSource, setChatSource] = useState('');
  const [chatTitle, setChatTitle] = useState('');
  
  // Slack specific
  const [slackToken, setSlackToken] = useState('');
  const [includePublic, setIncludePublic] = useState(true);
  const [includePrivate, setIncludePrivate] = useState(true);
  const [includeDms, setIncludeDms] = useState(false);
  const [includePermalinks, setIncludePermalinks] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const sources = [
    { id: 'slack', name: 'Slack', icon: SlackIcon, color: '#E01E5A' },
    { id: 'discord', name: 'Discord', icon: DiscordIcon, color: '#5865F2' },
    { id: 'whatsapp', name: 'WhatsApp', icon: WhatsAppIcon, color: '#25D366' },
    { id: 'json', name: 'JSON File', icon: UploadIcon, color: '#4ECDC4' },
  ];

  const handleSourceSelect = (sourceId) => {
    setChatSource(sourceId);
    setStep(2);
  };

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

  const handleSlackImport = async () => {
    if (!slackToken.trim()) {
      setError('Please enter a Slack token');
      return;
    }

    if (!chatTitle.trim()) {
      setError('Please enter a chat title');
      return;
    }

    if (!includePublic && !includePrivate && !includeDms) {
      setError('Please select at least one message source');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch messages from Slack
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

      // Create chat in database
      const chat = await createChat({
        title: chatTitle,
        source: 'slack',
        config: {
          token: slackToken,
          includePublic,
          includePrivate,
          includeDms,
          includePermalinks,
        },
      });

      // Save messages
      await saveChatMessages(chat.id, messages);

      // Navigate to dashboard
      navigate(`/dashboard/${chat.id}`, { state: { chat, autoCluster: true } });
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to import messages');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!chatTitle.trim()) {
      setError('Please enter a chat title first');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        
        // Validate JSON structure
        if (!Array.isArray(json)) {
          setError('JSON must be an array of messages');
          return;
        }

        const isValid = json.every(msg => 
          msg.text && 
          msg.channel && 
          msg.user && 
          msg.timestamp
        );

        if (!isValid) {
          setError('Each message must have: text, channel, user, timestamp');
          return;
        }

        setLoading(true);

        // Create chat in database
        const chat = await createChat({
          title: chatTitle,
          source: 'json',
          config: { filename: file.name },
        });

        // Save messages
        await saveChatMessages(chat.id, json);

        // Navigate to dashboard
        navigate(`/dashboard/${chat.id}`, { state: { chat, autoCluster: true } });
      } catch (err) {
        console.error('File upload error:', err);
        setError('Invalid JSON file or database error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Nav />
      <div className="create-chat-container">
        <div className="create-chat-card">
          <button className="back-button" onClick={() => navigate('/home')}>
            ← Back to Home
          </button>

          <h1 className="create-chat-title">Create New Chat</h1>

          {/* Step 1: Choose source */}
          {step === 1 && (
            <div className="source-selection">
              <h2>Choose Data Source</h2>
              <div className="source-grid">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    className="source-card"
                    style={{ borderColor: source.color }}
                    onClick={() => handleSourceSelect(source.id)}
                  >
                    <img src={source.icon} alt={source.name} className="source-icon-svg" />
                    <span className="source-name">{source.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure based on source */}
          {step === 2 && (
            <div className="config-section">
              <button className="back-step-btn" onClick={() => setStep(1)}>
                ← Change Source
              </button>

              <h2>
                Configure {sources.find((s) => s.id === chatSource)?.name}
              </h2>

              <div className="form-group">
                <label>Chat Title</label>
                <input
                  type="text"
                  value={chatTitle}
                  onChange={(e) => setChatTitle(e.target.value)}
                  placeholder="e.g., Team Slack - Q4 2024"
                  className="chat-input"
                />
              </div>

              {error && (
                <div className="error-message">
                  <img src={AlertIcon} alt="" className="status-icon" />
                  {error}
                </div>
              )}

              {chatSource === 'slack' && (
                <>
                  <div className="form-group">
                    <label>Slack User Token</label>
                    <input
                      type="password"
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      placeholder="xoxp-..."
                      className="chat-input"
                    />
                    <small className="form-hint">
                      Get your token from{' '}
                      <a
                        href="https://api.slack.com/authentication/token-types#user"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Slack API
                      </a>
                    </small>
                  </div>

                  {connectionStatus && (
                    <div className="connection-status success">
                      <img src={CheckIcon} alt="" className="status-icon" />
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
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={includePermalinks}
                        onChange={(e) => setIncludePermalinks(e.target.checked)}
                      />
                      <span>Include Permalinks (slower)</span>
                    </label>
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
                      onClick={handleSlackImport}
                      disabled={loading || testing}
                      className="btn btn-primary"
                    >
                      <img src={loading ? RefreshIcon : UploadIcon} alt="" className={`btn-icon ${loading ? 'spin' : ''}`} />
                      {loading ? 'Importing...' : 'Import Messages'}
                    </button>
                  </div>
                </>
              )}

              {chatSource === 'json' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />

                  <div className="json-upload-info">
                    <h3>Expected JSON Format</h3>
                    <pre>
{`[
  {
    "text": "Message content",
    "channel": "channel-name",
    "user": "username",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]`}
                    </pre>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || !chatTitle.trim()}
                    className="btn btn-primary btn-large"
                  >
                    <img src={loading ? RefreshIcon : UploadIcon} alt="" className={`btn-icon ${loading ? 'spin' : ''}`} />
                    {loading ? 'Uploading...' : 'Upload JSON File'}
                  </button>
                </>
              )}

              {(chatSource === 'discord' || chatSource === 'whatsapp') && (
                <div className="coming-soon">
                  <img src={AlertIcon} alt="" className="coming-soon-icon" />
                  <p className="coming-soon-title">Coming Soon</p>
                  <p>Direct integration for {chatSource} is under development.</p>
                  <p>For now, please export your data as JSON and use the JSON File option.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CreateChat;

