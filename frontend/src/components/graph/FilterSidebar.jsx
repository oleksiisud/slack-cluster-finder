import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Search, Settings, RefreshCw } from 'lucide-react';
import './FilterSidebar.css';

const FilterSidebar = ({ isOpen, toggle, onSettingsClick, activeChat, chatData, searchQuery, setSearchQuery, focusedClusterId }) => {
  const [expandedClusters, setExpandedClusters] = useState({});
  const clusterRefs = useRef({});

  // Automatically expand the focused cluster when it changes and scroll to it
  useEffect(() => {
    if (focusedClusterId) {
      setExpandedClusters(prev => ({ ...prev, [focusedClusterId]: true }));
      
      // Scroll to the focused cluster after a short delay to allow expansion animation
      setTimeout(() => {
        if (clusterRefs.current[focusedClusterId]) {
          clusterRefs.current[focusedClusterId].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      }, 100);
    }
  }, [focusedClusterId]);

  const toggleCluster = (id) => {
    setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button onClick={toggle} className="sidebar-toggle">
          <Search size={16} />
        </button>
      )}

      {isOpen && (
        <>
          <div className="sidebar-header">
            <h3 className="sidebar-title">Filters & Data</h3>
            <button onClick={toggle} className="btn-icon">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="sidebar-search">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search messages..." 
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="sidebar-content">
            <div className="cluster-header-row">
              <span className="cluster-label">Top Clusters</span>
            </div>

            {activeChat && chatData?.nodes ? (
              chatData.nodes.filter(n => n.type === 'cluster').length > 0 ? (
                chatData.nodes.filter(n => n.type === 'cluster').map(cluster => (
                  <div 
                    key={cluster.id} 
                    className="cluster-item"
                    ref={el => clusterRefs.current[cluster.id] = el}
                  >
                    <button 
                      onClick={() => toggleCluster(cluster.id)}
                      className="cluster-button"
                    >
                      <div className="cluster-info">
                        <div className="cluster-dot"></div>
                        <span className="cluster-name">{cluster.name}</span>
                      </div>
                      {expandedClusters[cluster.id] ? 
                        <ChevronDown size={14} className="cluster-icon" /> : 
                        <ChevronRight size={14} className="cluster-icon" />
                      }
                    </button>
                    
                    {expandedClusters[cluster.id] && (
                      <div className="cluster-details">
                        {cluster.tags && cluster.tags.length > 0 && (
                          <div className="cluster-tags">
                            {cluster.tags.map((t, i) => (
                              <span key={i} className="tag-pill">#{t}</span>
                            ))}
                          </div>
                        )}
                        {cluster.messages && cluster.messages.length > 0 && (
                          <div className="cluster-messages">
                            <div className="messages-header">{cluster.messages.length} messages</div>
                            {cluster.messages.map((msg, i) => (
                              <div key={i} className="message-item">
                                <div className="message-user">{msg.user || 'Unknown'}</div>
                                <div className="message-text">{msg.text?.substring(0, 80)}{msg.text?.length > 80 ? '...' : ''}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No clusters available
                </div>
              )
            ) : (
              <div className="empty-state">
                {activeChat ? 'No clustering data available' : 'Select a chat to view clusters'}
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            <button onClick={onSettingsClick} className="btn-secondary">
              <Settings size={16} /> Settings
            </button>
            <button className="btn-primary-outline">
              <RefreshCw size={16} /> Sync
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterSidebar;