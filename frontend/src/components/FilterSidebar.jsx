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

const FilterSidebar = ({ isOpen, toggle, onSettingsClick, activeChat, searchQuery, setSearchQuery }) => {
  const [expandedClusters, setExpandedClusters] = useState({});

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

            {activeChat ? (
              MOCK_CHAT_DATA.nodes.filter(n => n.type === 'cluster').map(cluster => (
                <div key={cluster.id} className="cluster-item">
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
                      <div className="cluster-tags">
                        {cluster.tags.map((t, i) => (
                          <span key={i} className="tag-pill">#{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
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