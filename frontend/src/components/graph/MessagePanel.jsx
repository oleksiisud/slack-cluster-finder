/**
 * Panel showing detailed information about a selected message
 */
import React from 'react';
import './MessagePanel.css';

const MessagePanel = ({ message, onClose }) => {
  return (
    <div className="message-panel">
      <div className="message-panel-header">
        <h3>Message Details</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="message-panel-body">
        <div className="message-content">
          <h4>Content</h4>
          <p className="message-text">{message.text}</p>
        </div>

        <div className="message-metadata">
          <div className="meta-row">
            <span className="meta-label">👤 User:</span>
            <span className="meta-value">{message.user}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">📢 Channel:</span>
            <span className="meta-value">{message.channel}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">🕒 Timestamp:</span>
            <span className="meta-value">
              {new Date(message.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">🆔 Message ID:</span>
            <span className="meta-value">{message.message_id}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">🏷️ Cluster:</span>
            <span className="meta-value">{message.cluster_id}</span>
          </div>
        </div>

        {message.tags && message.tags.length > 0 && (
          <div className="message-tags">
            <h4>Tags</h4>
            <div className="tags">
              {message.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagePanel;

