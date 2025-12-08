import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, ChevronLeft, Search, Settings, RefreshCw } from 'lucide-react';
import './FilterSidebar.css';

const FilterSidebar = ({ isOpen, toggle, onSettingsClick, activeChat, chatData, searchQuery, setSearchQuery, focusedClusterId, stats }) => {
  const [expandedClusters, setExpandedClusters] = useState({});
  const clusterRefs = useRef({});
  const sidebarRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);

  // Color palette for clusters (matching InteractiveGraph)
  const clusterColors = ["#ff0055", "#00d9ff", "#ff6b35", "#6a4c93", "#1dd1a1", "#feca57", "#5f27cd", "#ff9ff3", "#54a0ff", "#48dbfb"];
  
  const getClusterColor = (clusterId, clusterNodes) => {
    const clusterIndex = clusterNodes.findIndex(c => c.id === clusterId);
    return clusterColors[clusterIndex % clusterColors.length];
  };

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

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('resizing-sidebar');
    };

    if (isResizing) {
      document.body.classList.add('resizing-sidebar');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.classList.remove('resizing-sidebar');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div 
      ref={sidebarRef}
      className={`app-sidebar ${isOpen ? 'open' : ''}`}
      style={{ width: isOpen ? `${sidebarWidth}px` : '50px' }}
    >
      <button onClick={toggle} className="sidebar-toggle">
        {isOpen ? <ChevronRight size={32} /> : <ChevronLeft size={32} />}
      </button>

      {isOpen && (
        <>
          <div 
            className="sidebar-resize-handle"
            onMouseDown={() => setIsResizing(true)}
          />
          <div className="sidebar-header">
            <h3 className="sidebar-title">Filters & Data</h3>
          </div>

          {stats && (
            <div className="sidebar-stats">
              <div className="stat-item">
                <span className="stat-label">MESSAGES:</span>
                <span className="stat-value">{stats.messages}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CLUSTERS:</span>
                <span className="stat-value">{stats.clusters}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">PROCESSING TIME:</span>
                <span className="stat-value">{stats.processingTime.toFixed(2)}s</span>
              </div>
            </div>
          )}

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
                (() => {
                  const clusterNodes = chatData.nodes.filter(n => n.type === 'cluster');
                  return clusterNodes.map(cluster => {
                    const clusterColor = getClusterColor(cluster.id, clusterNodes);
                    return (
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
                            <div 
                              className="cluster-dot" 
                              style={{ 
                                backgroundColor: clusterColor,
                                boxShadow: `0 0 8px ${clusterColor}`
                              }}
                            ></div>
                            <div className="cluster-text">
                              <span className="cluster-name">{cluster.name}</span>
                              {cluster.messages && cluster.messages.length > 0 && (
                                <span className="cluster-message-count">{cluster.messages.length} messages</span>
                              )}
                            </div>
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
                    );
                  });
                })()
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