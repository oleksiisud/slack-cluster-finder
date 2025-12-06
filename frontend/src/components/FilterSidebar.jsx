import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Search, Settings, RefreshCw } from 'lucide-react';
import './FilterSidebar.css';

const MOCK_CHAT_DATA = {
  nodes: [
    { id: "c1", name: "Pandas Data Analysis", type: "cluster", val: 30, tags: ["python", "data", "pandas"] },
    { id: "c2", name: "React State Logic", type: "cluster", val: 20, tags: ["javascript", "react", "hooks"] },
    { id: "c3", name: "Deployment Issues", type: "cluster", val: 15, tags: ["devops", "aws", "docker"] },
    { id: "m1", name: "How do I merge dataframes?", type: "message", user: "alice", timestamp: "2023-11-14T10:00:00Z", parent: "c1" },
    { id: "m2", name: "Use pd.merge()", type: "message", user: "bob", timestamp: "2023-11-14T10:05:00Z", parent: "c1" },
    { id: "m3", name: "useEffect dependency loop", type: "message", user: "charlie", timestamp: "2023-11-15T09:00:00Z", parent: "c2" },
  ],
  links: [
    { source: "c1", target: "m1" },
    { source: "c1", target: "m2" },
    { source: "c2", target: "m3" },
    { source: "c1", target: "c2", value: 1 }
  ]
};

const FilterSidebar = ({ isOpen, toggle, onSettingsClick, activeChat, activeChatData, searchQuery, setSearchQuery }) => {
  const [expandedClusters, setExpandedClusters] = useState({});
  const [selectedCluster, setSelectedCluster] = useState(null);

  const toggleCluster = (id) => {
    setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }));
    setSelectedCluster(prev => prev === id ? null : id);
  };
  
  // Get clusters and messages from actual data
  const clusters = activeChatData?.nodes?.filter(n => n.type === 'cluster') || [];
  const messages = activeChatData?.nodes?.filter(n => n.type === 'message') || [];
  const links = activeChatData?.links || [];
  
  // Get messages for a specific cluster
  const getClusterMessages = (clusterId) => {
    return links
      .filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        return sourceId === clusterId;
      })
      .map(link => {
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return messages.find(m => m.id === targetId);
      })
      .filter(Boolean);
  };
  
  // Filter clusters and messages based on search query
  const filteredClusters = searchQuery 
    ? clusters.filter(cluster => 
        cluster.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getClusterMessages(cluster.id).some(msg => 
          msg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.full_text?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : clusters;

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
              <span className="cluster-label">Clusters ({filteredClusters.length})</span>
            </div>

            {activeChat && filteredClusters.length > 0 ? (
              <div className="clusters-list">
                {filteredClusters.map(cluster => {
                  const clusterMessages = getClusterMessages(cluster.id);
                  const isExpanded = expandedClusters[cluster.id];
                  
                  return (
                    <div key={cluster.id} className="cluster-item">
                      <button 
                        onClick={() => toggleCluster(cluster.id)}
                        className="cluster-button"
                      >
                        <div className="cluster-info">
                          <div className="cluster-dot"></div>
                          <span className="cluster-name">{cluster.name || `Cluster ${cluster.id}`}</span>
                          <span className="cluster-count">({clusterMessages.length})</span>
                        </div>
                        {isExpanded ? 
                          <ChevronDown size={14} className="cluster-icon" /> : 
                          <ChevronRight size={14} className="cluster-icon" />
                        }
                      </button>
                      
                      {isExpanded && (
                        <div className="cluster-details">
                          <div className="cluster-messages">
                            {clusterMessages.length > 0 ? (
                              clusterMessages.map((msg, idx) => {
                                const matchesSearch = searchQuery && (
                                  msg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  msg.full_text?.toLowerCase().includes(searchQuery.toLowerCase())
                                );
                                
                                return (
                                  <div 
                                    key={msg.id || idx} 
                                    className={`message-item ${matchesSearch ? 'highlighted' : ''}`}
                                  >
                                    <div className="message-header">
                                      {msg.user && (
                                        <span className="message-user">{msg.user}</span>
                                      )}
                                      {msg.timestamp && (
                                        <span className="message-time">
                                          {new Date(msg.timestamp).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="message-text">
                                      {msg.full_text || msg.name || 'No message text'}
                                    </div>
                                    {msg.link && (
                                      <a 
                                        href={msg.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="message-link"
                                      >
                                        View original →
                                      </a>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="empty-messages">No messages in this cluster</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeChat ? (
              <div className="empty-state">
                No clusters found{searchQuery ? ' matching your search' : ''}
              </div>
            ) : (
              <div className="empty-state">
                Select a chat to view clusters
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