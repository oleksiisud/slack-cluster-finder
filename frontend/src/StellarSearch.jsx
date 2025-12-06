import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ChevronRight, ChevronDown, Search, Settings, RefreshCw, X, ArrowLeft } from 'lucide-react';

// Mock Data
const MOCK_HOME_DATA = {
  nodes: [
    { id: "root", name: "New Chat", type: "add-root", val: 50, x: 0, y: 0 },
    { id: "ws1", name: "Company Slack", type: "workspace", val: 20, source: "slack" },
    { id: "ws2", name: "Dev Discord", type: "workspace", val: 15, source: "discord" },
    { id: "ws3", name: "Support Team", type: "workspace", val: 10, source: "slack" },
  ],
  links: [
    { source: "root", target: "ws1" },
    { source: "root", target: "ws2" },
    { source: "root", target: "ws3" },
  ]
};

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

// Interactive Graph Component
const InteractiveGraph = ({ data, onNodeClick, isHome = false, searchQuery = '', onBackToHome }) => {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    data.nodes.forEach(d => {
      if (d.type === 'add-root') d.level = 0;
      else if (d.type === 'workspace' || d.type === 'cluster') d.level = 1;
      else d.level = 2;
    });

    const getTargetRadius = (d) => {
      if (searchQuery) {
        const match = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        if (match) return 50;
      }
      if (d.level === 0) return 0;
      if (d.level === 1) return 120;
      return 240;
    };

    const simulation = d3.forceSimulation(data.nodes)
      .force("radial", d3.forceRadial(d => getTargetRadius(d), width / 2, height / 2).strength(0.8))
      .force("link", d3.forceLink(data.links).id(d => d.id).strength(0.1)) 
      .force("collide", d3.forceCollide().radius(d => (d.type === 'cluster' ? 45 : 15) + 5).strength(1))
      .force("charge", d3.forceManyBody().strength(-200));

    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .enter().append("line")
      .attr("stroke", "#4ECDC4")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 1);

    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.each(function(d) {
      const el = d3.select(this);
      const isMatch = searchQuery && (d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))));
      
      let r = d.type === 'cluster' ? 25 : 8;
      if (d.type === 'add-root') r = 35;
      if (d.type === 'workspace') r = 20;

      if (isMatch) {
         el.append("circle")
           .attr("r", r + 10)
           .attr("fill", "#FFD700")
           .attr("opacity", 0.3);
      }

      const circle = el.append("circle")
        .attr("r", r)
        .attr("stroke", isMatch ? "#FFD700" : (d.type === 'cluster' ? "#fff" : "#4ECDC4"))
        .attr("stroke-width", isMatch ? 3 : 1.5)
        .attr("fill", d.type === 'add-root' ? "rgba(78, 205, 196, 0.1)" : 
                     (d.type === 'cluster' ? "#ff0055" : "#4ECDC4"))
        .attr("fill-opacity", d.type === 'add-root' ? 0 : 0.9);

      if (d.type === 'add-root') {
        circle.attr("stroke-dasharray", "5,5");
        el.append("text").text("+").attr("dy", 5).attr("text-anchor", "middle").attr("fill", "#4ECDC4").style("font-size", "24px");
      }
    });

    node.append("text")
      .text(d => d.type === 'message' ? '' : d.name)
      .attr("dy", d => d.type === 'add-root' ? 55 : (d.type === 'cluster' ? 40 : 20))
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#fff")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 2px 4px rgba(0,0,0,0.8)");

    node.on("mouseenter", (event, d) => {
      if (d.type === 'add-root') return; 
      const rect = wrapperRef.current.getBoundingClientRect();
      setTooltipData({ x: event.clientX - rect.left, y: event.clientY - rect.top, data: d });
    }).on("mouseleave", () => setTooltipData(null));

    node.on("click", (event, d) => {
      event.stopPropagation();
      handleNodeFocus(d);
    });

    svg.on("click", () => resetZoom());

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function handleNodeFocus(d) {
      setSelectedNode(d);
      const scale = 2; 
      const x = -d.x * scale + width / 2;
      const y = -d.y * scale + height / 2;
      g.transition().duration(750).attr("transform", `translate(${x},${y}) scale(${scale})`);
      if (onNodeClick) onNodeClick(d);
    }

    function resetZoom() {
      setSelectedNode(null);
      g.transition().duration(750).attr("transform", "translate(0,0) scale(1)");
      if (onNodeClick && !isHome) onNodeClick(null);
    }

    wrapperRef.current.resetZoom = resetZoom;

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) { 
      d.fx = event.x; d.fy = event.y; 
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; 
      d.fy = null;
      simulation.alpha(1).restart();
    }

  }, [data, dimensions, searchQuery]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0e27' }}>
      {!isHome && (
        <button 
          onClick={() => {
            if (selectedNode) {
              wrapperRef.current?.resetZoom();
            } else if (onBackToHome) {
              onBackToHome();
            }
          }} 
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 10,
            background: '#4ECDC4',
            color: '#0a0e27',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> {selectedNode ? 'Back' : 'Home'}
        </button>
      )}
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {tooltipData && (
        <div style={{
          position: 'absolute',
          left: tooltipData.x + 10,
          top: tooltipData.y + 10,
          background: 'rgba(10, 14, 39, 0.95)',
          border: '1px solid #4ECDC4',
          borderRadius: '8px',
          padding: '12px',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          <h4 style={{ color: '#4ECDC4', fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0' }}>
            {tooltipData.data.name}
          </h4>
          {tooltipData.data.tags && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
              {tooltipData.data.tags.map(t => (
                <span key={t} style={{
                  background: 'rgba(78, 205, 196, 0.2)',
                  color: '#4ECDC4',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem'
                }}>
                  #{t}
                </span>
              ))}
            </div>
          )}
          {tooltipData.data.user && (
            <div style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.7, color: '#fff' }}>
              User: {tooltipData.data.user}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Filter Sidebar Component
const FilterSidebar = ({ isOpen, toggle, onSettingsClick, activeChat, searchQuery, setSearchQuery }) => {
  const [expandedClusters, setExpandedClusters] = useState({});

  const toggleCluster = (id) => {
    setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: '64px',
      height: 'calc(100vh - 64px)',
      width: isOpen ? '320px' : '50px',
      background: '#0f1329',
      borderLeft: '1px solid rgba(78, 205, 196, 0.2)',
      transition: 'width 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100
    }}>
      {!isOpen ? (
        <button onClick={toggle} style={{
          background: 'none',
          border: 'none',
          color: '#4ECDC4',
          cursor: 'pointer',
          padding: '16px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <Search size={20} />
        </button>
      ) : (
        <>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(78, 205, 196, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Filters & Data</h3>
            <button onClick={toggle} style={{ background: 'none', border: 'none', color: '#4ECDC4', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4ECDC4', opacity: 0.5 }} size={16} />
              <input 
                type="text" 
                placeholder="Search messages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  background: 'rgba(78, 205, 196, 0.1)',
                  border: '1px solid rgba(78, 205, 196, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', color: '#fff' }}>
                Top Clusters
              </span>
            </div>

            {activeChat ? (
              MOCK_CHAT_DATA.nodes.filter(n => n.type === 'cluster').map(cluster => (
                <div key={cluster.id} style={{ marginBottom: '8px' }}>
                  <button 
                    onClick={() => toggleCluster(cluster.id)}
                    style={{
                      width: '100%',
                      background: 'rgba(78, 205, 196, 0.1)',
                      border: '1px solid rgba(78, 205, 196, 0.2)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff0055', flexShrink: 0 }}></div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cluster.name}
                      </span>
                    </div>
                    {expandedClusters[cluster.id] ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                  </button>
                  
                  {expandedClusters[cluster.id] && (
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 8px 8px', marginTop: '-4px' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {cluster.tags.map((t, i) => (
                          <span key={i} style={{
                            background: 'rgba(78, 205, 196, 0.2)',
                            color: '#4ECDC4',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem'
                          }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3, fontSize: '0.875rem', color: '#fff' }}>
                Select a chat to view clusters
              </div>
            )}
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid rgba(78, 205, 196, 0.2)', display: 'flex', gap: '8px' }}>
            <button onClick={onSettingsClick} style={{
              flex: 1,
              background: 'rgba(78, 205, 196, 0.2)',
              border: '1px solid #4ECDC4',
              color: '#4ECDC4',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.875rem'
            }}>
              <Settings size={16} /> Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#0f1329',
        border: '1px solid #4ECDC4',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(78, 205, 196, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#4ECDC4', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} /> Settings
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4ECDC4', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 600 }}>Time Filter</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1 Month', '3 Months', 'All Time'].map((opt, i) => (
                <button key={i} style={{
                  flex: 1,
                  padding: '8px',
                  background: i === 1 ? '#4ECDC4' : 'rgba(78, 205, 196, 0.1)',
                  color: i === 1 ? '#0a0e27' : '#4ECDC4',
                  border: '1px solid #4ECDC4',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 600 }}>Integrations</label>
            <div style={{
              background: 'rgba(78, 205, 196, 0.1)',
              border: '1px solid rgba(78, 205, 196, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00ff00' }}></div>
                <div>
                  <div style={{ fontWeight: 500, color: '#fff' }}>Slack Connected</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.5, color: '#fff' }}>Last synced 5 mins ago</div>
                </div>
              </div>
              <button style={{
                background: 'rgba(78, 205, 196, 0.2)',
                border: '1px solid #4ECDC4',
                color: '#4ECDC4',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}>
                Re-sync
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(78, 205, 196, 0.2)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'none',
            border: '1px solid rgba(78, 205, 196, 0.5)',
            color: '#4ECDC4',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button onClick={onClose} style={{
            background: '#4ECDC4',
            border: 'none',
            color: '#0a0e27',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600
          }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function StellarSearch() {
  const [view, setView] = useState('home');
  const [activeChat, setActiveChat] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNodeClick = (node) => {
    if (!node) return;
    if (view === 'home') {
      if (node.type === 'add-root') setSettingsOpen(true);
      else if (node.type === 'workspace') { 
        setActiveChat(node); 
        setView('dashboard'); 
      }
    } else {
      if (node.type === 'cluster') setSidebarOpen(true);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0e27', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Nav */}
      <nav style={{
        height: '64px',
        background: '#0f1329',
        borderBottom: '1px solid rgba(78, 205, 196, 0.2)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ECDC4', fontFamily: 'Jersey 10, sans-serif' }}>
          Stellar Search
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div style={{ 
          flex: 1, 
          marginRight: view === 'dashboard' && isSidebarOpen ? '320px' : '0',
          transition: 'margin-right 0.3s ease'
        }}>
          {view === 'home' ? (
            <InteractiveGraph data={MOCK_HOME_DATA} onNodeClick={handleNodeClick} isHome={true} />
          ) : (
            <InteractiveGraph 
              data={MOCK_CHAT_DATA} 
              onNodeClick={handleNodeClick} 
              searchQuery={searchQuery}
              onBackToHome={() => {
                setView('home');
                setActiveChat(null);
                setSearchQuery('');
              }}
            />
          )}
        </div>

        {view === 'dashboard' && (
          <FilterSidebar 
            isOpen={isSidebarOpen} 
            toggle={() => setSidebarOpen(!isSidebarOpen)} 
            onSettingsClick={() => setSettingsOpen(true)}
            activeChat={activeChat}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default StellarSearch;