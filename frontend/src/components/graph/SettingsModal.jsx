/**
 * Settings Modal - Configure chat settings and data sources
 */
import { useState, useEffect, useRef } from 'react';
import { Settings, X, Upload, FileJson, Trash2 } from 'lucide-react';
import { initiateSlackAuth, getSlackToken } from '../../services/slackAuth';
import { initiateDiscordAuth, getDiscordToken } from '../../services/discordAuth';
import { createChat, saveChatMessages, saveChatClusteringData, deleteChat, updateChat } from '../../services/chatService';
import { clusterMessages, fetchSlackMessages } from '../../services/clusteringApi';
import { useAuth } from '../../AuthContext';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose, onChatCreated, existingChat = null, onChatDeleted }) => {
  const { session } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    timeFilter: '3 Months',
    includeDMs: false,
    enableSemanticSearch: true
  });
  const [status, setStatus] = useState({ loading: false, message: '', error: null });
  const [slackConnected, setSlackConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && session) {
      checkSlackConnection();
      checkDiscordConnection();
    }
    if (existingChat) {
      setFormData({
        title: existingChat.chatData?.title || existingChat.name || '',
        timeFilter: existingChat.chatData?.config?.timeFilter || '3 Months',
        includeDMs: existingChat.chatData?.config?.includeDMs || false,
        enableSemanticSearch: existingChat.chatData?.config?.enableSemanticSearch || true
      });
    } else {
      setFormData({ title: '', timeFilter: '3 Months', includeDMs: false, enableSemanticSearch: true });
    }
  }, [isOpen, session, existingChat]);

  const checkSlackConnection = async () => {
    try {
      const token = await getSlackToken();
      setSlackConnected(!!token);
    } catch { setSlackConnected(false); }
  };

  const checkDiscordConnection = async () => {
    try {
      const token = await getDiscordToken();
      setDiscordConnected(!!token);
    } catch { setDiscordConnected(false); }
  };

  const processChatData = async (title, source, messages) => {
    setStatus({ loading: true, message: 'Creating chat...', error: null });
    try {
      // 1. Create/Update Chat
      const chatConfig = { ...formData, uploadedAt: new Date().toISOString() };
      let chat;
      
      if (existingChat) {
        chat = await updateChat(existingChat.id, { title, config: chatConfig });
      } else {
        chat = await createChat({ title, source, config: chatConfig });
      }

      // 2. Save Messages
      if (messages.length > 0) {
        setStatus(prev => ({ ...prev, message: `Saving ${messages.length} messages...` }));
        await saveChatMessages(chat.id, messages);

        // 3. Cluster
        setStatus(prev => ({ ...prev, message: 'Running AI clustering...' }));
        try {
            const clusterResult = await clusterMessages(messages, false);
            await saveChatClusteringData(chat.id, clusterResult);
            if (onChatCreated) onChatCreated(chat, clusterResult);
        } catch (e) {
            console.warn('Clustering failed:', e);
            setStatus(prev => ({ ...prev, message: 'Clustering failed, saved messages only.' }));
            if (onChatCreated) onChatCreated(chat, null);
        }
      } else if (existingChat) {
         if (onChatCreated) onChatCreated(); // Just updated settings
      }

      setStatus({ loading: false, message: 'Success!', error: null });
      setTimeout(() => { onClose(); setStatus({ loading: false, message: '', error: null }); }, 1000);

    } catch (error) {
      console.error('Error processing chat:', error);
      setStatus({ loading: false, message: '', error: error.message });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setStatus({ loading: true, message: 'Reading file...', error: null });
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const messages = Array.isArray(json) ? json : (json.messages || []);
      
      if (!messages.length || !messages[0].text) throw new Error('Invalid JSON format');
      
      await processChatData(file.name.replace('.json', ''), 'json_upload', messages);
    } catch (error) {
      setStatus({ loading: false, message: '', error: 'Invalid JSON file' });
    }
  };

  const handleSlackImport = async () => {
    if (!slackConnected) return initiateSlackAuth();
    
    setStatus({ loading: true, message: 'Fetching from Slack...', error: null });
    try {
      const tokenData = await getSlackToken();
      const messages = await fetchSlackMessages(
        tokenData.access_token,
        true, // public
        true, // private
        formData.includeDMs
      );
      
      await processChatData(
        formData.title || `Slack Import ${new Date().toLocaleDateString()}`,
        'slack',
        messages
      );
    } catch (error) {
      setStatus({ loading: false, message: '', error: 'Failed to fetch Slack messages' });
    }
  };

  const handleDelete = async () => {
    if (!existingChat) return;
    setStatus({ loading: true, message: 'Deleting...', error: null });
    try {
      await deleteChat(existingChat.id);
      if (onChatDeleted) onChatDeleted(existingChat.id);
      onClose();
    } catch (error) {
      setStatus({ loading: false, message: '', error: error.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Settings size={20} /> {existingChat ? 'Edit Chat' : 'New Chat'}</h2>
          <button onClick={onClose} className="btn-icon-close"><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Chat Title</label>
            <input 
              className="form-input" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="My Chat Graph"
            />
          </div>

          {!existingChat && (
            <div className="import-options">
              <div className="option-card" onClick={handleSlackImport}>
                <div className={`status-dot ${slackConnected ? 'connected' : ''}`} />
                <div>
                  <h3>Slack Import</h3>
                  <p>{slackConnected ? 'Ready to sync' : 'Connect to import'}</p>
                </div>
              </div>
              
              <div className="option-card" onClick={() => initiateDiscordAuth()}>
                <div className={`status-dot ${discordConnected ? 'connected' : ''}`} />
                <div>
                  <h3>Discord Import</h3>
                  <p>{discordConnected ? 'Ready to sync' : 'Connect to import'}</p>
                </div>
              </div>
              
              <div className="divider">OR</div>

              <div className="option-card" onClick={() => fileInputRef.current?.click()}>
                <FileJson size={20} />
                <div>
                  <h3>JSON Upload</h3>
                  <p>Upload message file</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" hidden onChange={handleFileUpload} />
              </div>
            </div>
          )}

          <div className="settings-section">
            <label>Time Filter</label>
            <div className="filter-options">
              {['1 Month', '3 Months', 'All Time'].map(opt => (
                <button 
                  key={opt}
                  className={`filter-btn ${formData.timeFilter === opt ? 'active' : ''}`}
                  onClick={() => setFormData({...formData, timeFilter: opt})}
                >
                  {opt}
                </button>
              ))}
            </div>
            
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={formData.includeDMs}
                onChange={e => setFormData({...formData, includeDMs: e.target.checked})}
              />
              Include DMs
            </label>
          </div>

          {status.message && <div className="status-message">{status.message}</div>}
          {status.error && <div className="error-message">{status.error}</div>}
        </div>

        <div className="modal-footer">
          {existingChat && (
            <button onClick={handleDelete} className="btn-delete" disabled={status.loading}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="spacer" />
          {existingChat && (
            <button onClick={() => processChatData(formData.title, existingChat.source, [])} className="btn-save" disabled={status.loading}>
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;