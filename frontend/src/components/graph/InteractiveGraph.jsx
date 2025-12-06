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

  // Responsive dimensions
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

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return isoString; }
  };

  // ------------------------------------------
  // 🔥 MAIN D3 EFFECT — WITH SAFETY CHECK
  // ------------------------------------------
  useEffect(() => {
    // ✅ Provide a fallback mock dataset if `data` is missing or invalid
    const safeData = (data && Array.isArray(data.nodes) && Array.isArray(data.links))
      ? data
      : {
          nodes: [
            { id: 'root', name: 'Root', type: 'add-root' },
            { id: 'cluster1', name: 'Cluster 1', type: 'cluster' },
            { id: 'msg1', name: 'Hello World', type: 'message' },
          ],
          links: [
            { source: 'root', target: 'cluster1' },
            { source: 'cluster1', target: 'msg1' },
          ]
        };

    if (!svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    // Assign levels
    safeData.nodes.forEach(d => {
      if (d.type === 'add-root') d.level = 0;
      else if (d.type === 'workspace' || d.type === 'cluster') d.level = 1;
      else d.level = 2;
    });

    const getTargetRadius = (d) => {
      if (searchQuery) {
        const match =
          d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        if (match) return 50;
      }
      if (d.level === 0) return 0;
      if (d.level === 1) return 120;
      return 240;
    };

    // Simulation
    const simulation = d3.forceSimulation(safeData.nodes)
      .force("radial", d3.forceRadial(d => getTargetRadius(d), width / 2, height / 2).strength(0.8))
      .force("link", d3.forceLink(safeData.links).id(d => d.id).strength(0.1))
      .force("collide", d3.forceCollide().radius(d => (d.type === 'cluster' ? 45 : 15) + 5).strength(1))
      .force("charge", d3.forceManyBody().strength(-200));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(safeData.links)
      .enter().append("line")
      .attr("stroke", "#4ECDC4")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 1);

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(safeData.nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.each(function(d) {
      const el = d3.select(this);
      const isMatch =
        searchQuery &&
        (d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))));

      let r = d.type === 'cluster' ? 25 : 8;
      if (d.type === 'add-root') r = 35;
      if (d.type === 'workspace') r = 20;

      const nodeColor =
        d.type === 'add-root' ? "#4ECDC4" :
        (d.type === 'cluster' ? "#ff0055" : "#4ECDC4");

      el.append("circle")
        .attr("r", r + 6)
        .attr("fill", nodeColor)
        .attr("opacity", 0.15);

      if (isMatch) {
        el.append("circle")
          .attr("r", r + 10)
          .attr("fill", "#FFD700")
          .attr("opacity", 0.25);
      }

      const circle = el.append("circle")
        .attr("r", r)
        .attr("stroke", isMatch ? "#FFD700" : nodeColor)
        .attr("stroke-width", isMatch ? 3 : 2)
        .attr("fill", d.type === 'add-root' ? "rgba(78, 205, 196, 0.1)" : nodeColor)
        .attr("fill-opacity", d.type === 'add-root' ? 0 : 0.9);

      if (d.type === 'add-root') {
        circle.attr("stroke-dasharray", "5,5");
        el.append("text")
          .text("+")
          .attr("dy", 5)
          .attr("text-anchor", "middle")
          .style("font-size", "24px");
      }
    });

    // Labels
    node.append("text")
      .text(d => d.type === 'message' ? '' : d.name)
      .attr("dy", d => d.type === 'add-root' ? 55 : (d.type === 'cluster' ? 40 : 20))
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("pointer-events", "none");

    // Tooltip
    node.on("mouseenter", (event, d) => {
      if (!d || !d.name || d.type === 'add-root') return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setTooltipData({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        data: d
      });
    }).on("mouseleave", () => setTooltipData(null));

    node.on("click", (event, d) => {
      event.stopPropagation();
      handleNodeFocus(d);
    });

    svg.on("click", () => resetZoom());

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function handleNodeFocus(d) {
      setSelectedNode(d);
      const scale = 2;
      const x = -d.x * scale + width / 2;
      const y = -d.y * scale + height / 2;
      g.transition().duration(750).attr("transform", `translate(${x},${y}) scale(${scale})`);
      // Only call onNodeClick for home view or specific node types
      // In dashboard view, clicking nodes should just zoom, not trigger navigation
      if (onNodeClick && (isHome || d.type === 'cluster')) {
        onNodeClick(d);
      }
    }

    function resetZoom() {
      setSelectedNode(null);
      g.transition().duration(750).attr("transform", "translate(0,0) scale(1)");
      // Only reset on click if in home view
      if (onNodeClick && isHome) {
        onNodeClick(null);
      }
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
      d.fx = null; d.fy = null;
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

  return (
    <div ref={wrapperRef} className="view-container">
      {!isHome && (
        <button onClick={handleBackClick} className="btn-back">
          <ArrowLeft size={16} /> {selectedNode ? 'Back' : 'Home'}
        </button>
      )}

      <svg ref={svgRef} className="graph-svg" />

      {tooltipData && tooltipData.data && (
        <div
          className="graph-tooltip"
          style={{ left: tooltipData.x + 10, top: tooltipData.y + 10 }}
        >
          <div className="tooltip-card">
            <h4 className="tooltip-title">{tooltipData.data.name}</h4>
            {tooltipData.data.type === 'message' && tooltipData.data.full_text && (
              <div className="tooltip-message">
                <p className="tooltip-text">{tooltipData.data.full_text}</p>
                {tooltipData.data.user && (
                  <span className="tooltip-user">— {tooltipData.data.user}</span>
                )}
                {tooltipData.data.link && (
                  <a 
                    href={tooltipData.data.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="tooltip-link"
                  >
                    View original →
                  </a>
                )}
              </div>
            )}
            {tooltipData.data.tags && (
              <div className="tooltip-tags">
                {tooltipData.data.tags.map(t => (
                  <span key={t} className="tag-pill">#{t}</span>
                ))}
              </div>
            )}
            {tooltipData.data.type === 'cluster' && (
              <div className="tooltip-info">
                <span className="tooltip-type">Cluster</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveGraph;
