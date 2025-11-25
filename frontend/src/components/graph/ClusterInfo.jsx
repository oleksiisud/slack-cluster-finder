/**
 * Panel showing detailed information about a selected cluster
 */
import React, { useState } from 'react';
import './ClusterInfo.css';

const ClusterInfo = ({ cluster, onClose }) => {
  const [showAllMessages, setShowAllMessages] = useState(false);
  const displayMessages = showAllMessages ? cluster.messages : cluster.messages.slice(0, 10);

  return (
    <div className="cluster-info">
      <div className="cluster-info-header">
        <h3>{cluster.label}</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="cluster-info-body">
        <div className="cluster-meta">
          <div className="meta-item">
            <span className="meta-label">Messages:</span>
            <span className="meta-value">{cluster.size}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Cluster ID:</span>
            <span className="meta-value">{cluster.id}</span>
          </div>
        </div>

        <div className="cluster-tags-section">
          <h4>Tags</h4>
          <div className="tags">
            {cluster.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>

        <div className="cluster-messages-section">
          <h4>Messages</h4>
          <div className="messages-list">
            {displayMessages.map((message, idx) => (
              <div key={message.message_id || idx} className="message-item">
                <div className="message-text">{message.text}</div>
                <div className="message-meta">
                  <span className="message-user">👤 {message.user}</span>
                  <span className="message-channel">📢 {message.channel}</span>
                  <span className="message-time">
                    🕒 {new Date(message.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {cluster.messages.length > 10 && (
            <button 
              onClick={() => setShowAllMessages(!showAllMessages)}
              className="toggle-messages-btn"
            >
              {showAllMessages 
                ? '▲ Show Less' 
                : `▼ Show ${cluster.messages.length - 10} More`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClusterInfo;

