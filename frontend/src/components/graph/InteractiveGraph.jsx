import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ArrowLeft } from 'lucide-react';
import './InteractiveGraph.css';

const InteractiveGraph = ({ data, onNodeClick, isHome = false, searchQuery = '', onBackToHome }) => {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const initialTransformRef = useRef(null);

  // Responsive Sizing
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

  // Format Date
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return isoString; }
  };

  // Render Graph
  useEffect(() => {
    // Validate data structure
    if (!data || !svgRef.current || !data.nodes || !Array.isArray(data.nodes)) {
      console.log('InteractiveGraph: Invalid data or ref', { data, hasRef: !!svgRef.current });
      return;
    }
    if (data.nodes.length === 0) {
      console.log('InteractiveGraph: No nodes to display');
      return; // No nodes to display
    }
    
    console.log('InteractiveGraph: Rendering graph with', data.nodes.length, 'nodes and', data.links?.length || 0, 'links');
    
    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // 1. Identify Levels & Assign Fixed Radii
    data.nodes.forEach(d => {
      if (d.type === 'add-root') d.level = 0;
      else if (d.type === 'workspace') d.level = 1; // Workspace nodes on inner ring (home page)
      else if (d.type === 'message') d.level = 0; // Messages innermost
      else if (d.type === 'cluster') {
        // Level 2 = Topics (middle ring), Level 1 = Conversations (outer ring)
        d.level = d.level || 1;
      }
    });

    const getTargetRadius = (d) => {
      if (searchQuery) {
        // Search Logic: If match, pull to inner orbit (radius 50), else push out
        const match = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        if (match) return 50;
      }
      
      // Standard Radial Layout
      if (d.type === 'add-root') return 0; // Center (home page)
      if (d.type === 'workspace') return 150; // Inner ring (home page)
      if (d.type === 'message') return 280; // Messages (inside conversations)
      if (d.level === 1) return 240; // Conversations (outer ring)
      if (d.level === 2) return 120; // Topics (middle ring)
      return 150; // Default
    };

    // 2. Simulation Setup
    const centerX = width / 2;
    const centerY = height / 2;
    
    const simulation = d3.forceSimulation(data.nodes)
      .force("center", d3.forceCenter(centerX, centerY))
      .force("radial", d3.forceRadial(d => getTargetRadius(d), centerX, centerY).strength(0.8))
      .force("link", d3.forceLink(data.links).id(d => d.id).strength(0.1)) 
      .force("collide", d3.forceCollide().radius(d => (d.type === 'cluster' ? 45 : 15) + 5).strength(1))
      .force("charge", d3.forceManyBody().strength(-200));

    // 3. Render Links
    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .enter().append("line")
      .attr("stroke", "#4ECDC4")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 1);

    // 4. Render Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Circle Styles
    node.each(function(d) {
      const el = d3.select(this);
      const isMatch = searchQuery && (d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))));
      
      let r = d.type === 'cluster' ? 25 : 8;
      if (d.type === 'add-root') r = 35;
      if (d.type === 'workspace') r = 20;
      if (d.type === 'message') r = 4; // Small dots for messages
    
      // Color palette for clusters
      const clusterColors = ["#ff0055", "#00d9ff", "#ff6b35", "#6a4c93", "#1dd1a1", "#feca57", "#5f27cd", "#ff9ff3", "#54a0ff", "#48dbfb"];
      
      // Get color based on type
      let nodeColor = "#4ECDC4";
      if (d.type === 'cluster') {
        nodeColor = clusterColors[data.nodes.filter(n => n.type === 'cluster').indexOf(d) % clusterColors.length];
      } else if (d.type === 'message') {
        // Messages inherit parent cluster color but more subtle
        const parentCluster = data.nodes.find(n => n.id === d.parent);
        if (parentCluster) {
          nodeColor = clusterColors[data.nodes.filter(n => n.type === 'cluster').indexOf(parentCluster) % clusterColors.length];
        }
      }

      // Outer glow effect (not for messages)
      if (d.type !== 'message') {
        el.append("circle")
          .attr("r", r + 6)
          .attr("fill", nodeColor)
          .attr("opacity", 0.15)
          .attr("class", "node-glow");
      }

      // Pulse animation if search match
      if (isMatch) {
         el.append("circle")
           .attr("r", r + 10)
           .attr("fill", "#FFD700")
           .attr("opacity", 0.25)
           .attr("class", "search-pulse");
      }

      const circle = el.append("circle")
        .attr("r", r)
        .attr("stroke", isMatch ? "#FFD700" : nodeColor)
        .attr("stroke-width", d.type === 'message' ? 1 : (isMatch ? 3 : 2))
        .attr("fill", d.type === 'add-root' ? "rgba(78, 205, 196, 0.1)" : nodeColor)
        .attr("fill-opacity", d.type === 'message' ? 0.3 : (d.type === 'add-root' ? 0 : 0.9))
        .attr("class", d.type === 'message' ? 'message-dot' : '')
        .style("filter", d.type === 'message' ? 'none' : `drop-shadow(0 0 ${isMatch ? 15 : 10}px ${isMatch ? "#FFD700" : nodeColor})`);

      if (d.type === 'add-root') {
        circle.attr("stroke-dasharray", "5,5");
        el.append("text").text("+").attr("dy", 5).attr("text-anchor", "middle").attr("fill", "#4ECDC4").style("font-size", "24px");
      }
    });

    // Labels
    node.append("text")
      .text(d => d.type === 'message' ? '' : d.name)
      .attr("dy", d => d.type === 'add-root' ? 55 : (d.type === 'cluster' ? 40 : 20))
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#fff")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 2px 4px rgba(0,0,0,0.8)");

    // 5. Interaction
    node.on("mouseenter", (event, d) => {
      if (d.type === 'add-root') return; 
      const rect = wrapperRef.current.getBoundingClientRect();
      setTooltipData({ x: event.clientX - rect.left, y: event.clientY - rect.top, data: d });
    }).on("mouseleave", () => setTooltipData(null));

    node.on("click", (event, d) => {
      event.stopPropagation();
      handleNodeFocus(d, event);
    });

    // Add right-click context menu for workspace nodes
    node.on("contextmenu", (event, d) => {
      if (d.type === 'workspace') {
        event.preventDefault();
        if (onNodeClick) onNodeClick(d, { button: 2 });
      }
    });

    // 6. Zoom & Pan
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        // Update message dot opacity based on zoom level
        const scale = event.transform.k;
        if (scale > 1.5) {
          svg.classed('zoomed-in', true).classed('zoomed-out', false);
        } else if (scale < 0.7) {
          svg.classed('zoomed-out', true).classed('zoomed-in', false);
        } else {
          svg.classed('zoomed-in', false).classed('zoomed-out', false);
        }
        
        // Check if view has moved from initial position
        if (initialTransformRef.current) {
          const initial = initialTransformRef.current;
          const current = event.transform;
          const isOffCenter = 
            Math.abs(current.x - initial.x) > 10 ||
            Math.abs(current.y - initial.y) > 10 ||
            Math.abs(current.k - initial.k) > 0.05;
          
          setShowRecenterButton(isOffCenter);
        }
      });
    
    svg.call(zoom);
    
    // Set initial transform and store it
    let initialTransform = d3.zoomIdentity;
    if (!isHome && data.nodes.length > 20) {
      initialTransform = d3.zoomIdentity.scale(0.8);
      svg.call(zoom.transform, initialTransform);
    }
    initialTransformRef.current = initialTransform;
    
    // Store zoom behavior for recenter function
    wrapperRef.current.zoomBehavior = zoom;
    wrapperRef.current.svg = svg;

    svg.on("click", () => resetZoom());

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function handleNodeFocus(d, event) {
      setSelectedNode(d);
      const scale = 2; 
      const x = -d.x * scale + width / 2;
      const y = -d.y * scale + height / 2;
      g.transition().duration(750).attr("transform", `translate(${x},${y}) scale(${scale})`);
      if (onNodeClick) onNodeClick(d, event);
    }

    function resetZoom() {
      setSelectedNode(null);
      g.transition().duration(750).attr("transform", "translate(0,0) scale(1)");
      if (onNodeClick && !isHome) onNodeClick(null);
    }

    wrapperRef.current.resetZoom = resetZoom;

    // --- Drag with Elastic Snap-Back ---
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

  const handleBackClick = () => {
    if (selectedNode) {
      wrapperRef.current?.resetZoom();
    } else if (onBackToHome) {
      onBackToHome();
    }
  };
  
  const handleRecenter = () => {
    if (wrapperRef.current?.svg && wrapperRef.current?.zoomBehavior && initialTransformRef.current) {
      const svg = wrapperRef.current.svg;
      const zoom = wrapperRef.current.zoomBehavior;
      svg.transition()
        .duration(750)
        .call(zoom.transform, initialTransformRef.current);
      setShowRecenterButton(false);
    }
  };

  return (
    <div ref={wrapperRef} className="view-container">
      {!isHome && (
        <button onClick={handleBackClick} className="btn-back">
          <ArrowLeft size={16} /> {selectedNode ? 'Back' : 'Home'}
        </button>
      )}
      <svg ref={svgRef} className="graph-svg" />
      {tooltipData && (
        <div className="graph-tooltip" style={{ left: tooltipData.x + 10, top: tooltipData.y + 10 }}>
          <div className="tooltip-card">
            <h4 className="tooltip-title">{tooltipData.data.name}</h4>
            {tooltipData.data.tags && (
              <div className="tooltip-tags">
                {tooltipData.data.tags.map(t => (
                  <span key={t} className="tag-pill">#{t}</span>
                ))}
              </div>
            )}
            {tooltipData.data.user && (
              <div className="tooltip-user">User: {tooltipData.data.user}</div>
            )}
          </div>
        </div>
      )}
      {showRecenterButton && (
        <button onClick={handleRecenter} className="btn-recenter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3" />
          </svg>
          Recenter
        </button>
      )}
    </div>
  );
};

export default InteractiveGraph;