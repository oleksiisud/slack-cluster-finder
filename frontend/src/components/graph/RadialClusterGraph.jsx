/**
 * Radial Cluster Graph with hierarchical layout
 * - Fixed radial distances for each level
 * - Zoom/focus on node selection
 * - Animated search results
 * - Drag with snap-back
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import './RadialClusterGraph.css';

// Import SVG icons
import UserIcon from '../../assets/settings.svg';
import ChannelIcon from '../../assets/cloud-data-connection.svg';
import ClockIcon from '../../assets/clock-hour-3.svg';
import LinkIcon from '../../assets/search.svg';

const RadialClusterGraph = ({
  clusteringData,
  onClusterClick,
  onMessageClick,
  searchQuery = '',
  selectedClusterId = null,
  onBackClick,
}) => {
  const graphRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [searchResults, setSearchResults] = useState(new Set());
  
  // Animation state
  const draggedNodeRef = useRef(null);
  const originalPositionsRef = useRef({});

  // Fixed radii for each level
  const RADII = {
    1: 150,  // Main clusters
    2: 300,  // Sub-clusters
    3: 450,  // Message nodes
  };

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = graphRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        setDimensions({
          width: rect.width - 20,
          height: rect.height - 20,
        });
      }
    };

    setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform clustering data to radial graph format
  useEffect(() => {
    if (!clusteringData || !clusteringData.clusters) {
      setGraphData({ nodes: [], links: [] });
      return;
    }

    const { clusters, messages } = clusteringData;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Separate clusters by level
    const mainClusters = clusters.filter(c => c.level === 1);
    const subClusters = clusters.filter(c => c.level === 2);
    const messageNodes = clusters.filter(c => c.level === 3);

    const nodes = [];
    const links = [];

    // Calculate positions for main clusters (Level 1) - radially distributed
    const angleStep1 = (2 * Math.PI) / Math.max(mainClusters.length, 1);
    mainClusters.forEach((cluster, idx) => {
      const angle = idx * angleStep1;
      const radius = focusedNode?.id === cluster.cluster_id ? 0 : RADII[1];
      
      nodes.push({
        id: cluster.cluster_id,
        label: cluster.label,
        tags: cluster.tags,
        size: cluster.size,
        type: 'main-cluster',
        level: 1,
        val: 25,
        color: getClusterColor(idx),
        cluster: cluster,
        // Fixed position
        fx: centerX + radius * Math.cos(angle),
        fy: centerY + radius * Math.sin(angle),
        targetX: centerX + radius * Math.cos(angle),
        targetY: centerY + radius * Math.sin(angle),
      });
    });

    // Add sub-clusters (Level 2)
    subClusters.forEach((cluster, idx) => {
      const parent = nodes.find(n => n.id === cluster.parent_cluster_id);
      if (!parent) return;

      // Calculate position around parent
      const parentIdx = mainClusters.findIndex(c => c.cluster_id === cluster.parent_cluster_id);
      const siblingCount = subClusters.filter(c => c.parent_cluster_id === cluster.parent_cluster_id).length;
      const siblingIdx = subClusters.filter(c => c.parent_cluster_id === cluster.parent_cluster_id).indexOf(cluster);
      
      const baseAngle = parentIdx * angleStep1;
      const spreadAngle = angleStep1 * 0.8; // Spread sub-clusters around parent
      const angle = baseAngle - spreadAngle / 2 + (siblingIdx / Math.max(siblingCount - 1, 1)) * spreadAngle;
      
      const radius = focusedNode?.id === cluster.parent_cluster_id ? RADII[1] : RADII[2];

      nodes.push({
        id: cluster.cluster_id,
        label: cluster.label,
        tags: cluster.tags,
        size: cluster.size,
        type: 'sub-cluster',
        level: 2,
        val: 15,
        color: parent.color,
        cluster: cluster,
        parentId: cluster.parent_cluster_id,
        fx: centerX + radius * Math.cos(angle),
        fy: centerY + radius * Math.sin(angle),
        targetX: centerX + radius * Math.cos(angle),
        targetY: centerY + radius * Math.sin(angle),
      });

      // Link to parent
      links.push({
        source: cluster.parent_cluster_id,
        target: cluster.cluster_id,
      });
    });

    // Add message nodes (Level 3)
    messageNodes.forEach((cluster) => {
      const parent = nodes.find(n => n.id === cluster.parent_cluster_id);
      if (!parent) return;

      // Find the sub-cluster's angle and parent main cluster
      const subCluster = subClusters.find(c => c.cluster_id === cluster.parent_cluster_id);
      const mainClusterIdx = mainClusters.findIndex(c => c.cluster_id === subCluster?.parent_cluster_id);
      
      const baseAngle = mainClusterIdx * angleStep1;
      const siblingCount = messageNodes.filter(c => c.parent_cluster_id === cluster.parent_cluster_id).length;
      const siblingIdx = messageNodes.filter(c => c.parent_cluster_id === cluster.parent_cluster_id).indexOf(cluster);
      
      const spreadAngle = angleStep1 * 0.6 / Math.max(siblingCount, 1);
      const angle = baseAngle + (siblingIdx - siblingCount / 2) * spreadAngle;
      
      const radius = focusedNode?.id === cluster.parent_cluster_id ? RADII[2] : RADII[3];

      // Find the actual message
      const message = messages.find(m => m.message_id === cluster.message_ids[0]);

      nodes.push({
        id: cluster.cluster_id,
        label: message?.text?.substring(0, 30) + '...' || '',
        type: 'message',
        level: 3,
        val: 5,
        color: parent.color,
        cluster: cluster,
        message: message,
        parentId: cluster.parent_cluster_id,
        fx: centerX + radius * Math.cos(angle),
        fy: centerY + radius * Math.sin(angle),
        targetX: centerX + radius * Math.cos(angle),
        targetY: centerY + radius * Math.sin(angle),
      });

      // Link to parent sub-cluster
      links.push({
        source: cluster.parent_cluster_id,
        target: cluster.cluster_id,
      });
    });

    // Store original positions
    originalPositionsRef.current = {};
    nodes.forEach(node => {
      originalPositionsRef.current[node.id] = {
        fx: node.fx,
        fy: node.fy,
        targetX: node.targetX,
        targetY: node.targetY,
      };
    });

    setGraphData({ nodes, links });
  }, [clusteringData, dimensions, focusedNode]);

  // Handle search - move matching nodes toward center
  useEffect(() => {
    if (!searchQuery || !graphData.nodes.length) {
      setSearchResults(new Set());
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = new Set();

    graphData.nodes.forEach(node => {
      let isMatch = false;

      if (node.type === 'message' && node.message) {
        isMatch = node.message.text.toLowerCase().includes(query);
      } else if (node.label) {
        isMatch = node.label.toLowerCase().includes(query);
      }

      if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(query))) {
        isMatch = true;
      }

      if (isMatch) {
        matches.add(node.id);
      }
    });

    setSearchResults(matches);

    // Animate matching nodes toward center
    graphData.nodes.forEach(node => {
      const original = originalPositionsRef.current[node.id];
      if (!original) return;

      if (matches.has(node.id)) {
        // Move 50% closer to center
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        node.fx = centerX + (original.fx - centerX) * 0.5;
        node.fy = centerY + (original.fy - centerY) * 0.5;
      } else {
        // Keep original position but make slightly transparent
        node.fx = original.fx;
        node.fy = original.fy;
      }
    });

    // Force re-render
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
    }
  }, [searchQuery, graphData.nodes, dimensions]);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    if (node.type === 'message') {
      // Click on message - open permalink
      if (node.message?.permalink) {
        window.open(node.message.permalink, '_blank');
      }
      onMessageClick?.(node.message);
    } else {
      // Click on cluster - zoom/focus
      setFocusedNode(node);
      onClusterClick?.(node);
    }
  }, [onClusterClick, onMessageClick]);

  // Handle back button
  const handleBackClick = useCallback(() => {
    setFocusedNode(null);
    onBackClick?.();
  }, [onBackClick]);

  // Custom node rendering
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isSelected = node.id === selectedClusterId;
    const isHovered = hoveredNode?.id === node.id;
    const isSearchMatch = searchResults.has(node.id);
    const isFaded = searchQuery && !isSearchMatch;

    // Apply opacity for non-matches during search
    ctx.globalAlpha = isFaded ? 0.3 : 1.0;

    // Draw node
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected || isHovered ? '#FFD700' : node.color;
    ctx.fill();

    // Glow effect
    if (node.level <= 2) {
      ctx.shadowBlur = isSelected || isHovered ? 25 : 12;
      ctx.shadowColor = node.color;
    }

    // Border
    ctx.strokeStyle = isSelected ? '#FFF' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.stroke();

    // Reset shadow and alpha
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // Label - only show for main clusters (level 1)
    if (node.level === 1) {
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${14 / globalScale}px Sans-Serif`;

      // Draw label below node
      const maxWidth = 120;
      const words = node.label.split(' ');
      let line = '';
      let y = node.y + node.val + 25;

      words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line, node.x, y);
          line = word + ' ';
          y += 16 / globalScale;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line, node.x, y);

      // Size badge
      ctx.beginPath();
      ctx.arc(node.x + node.val - 8, node.y - node.val + 8, 10, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = `bold ${11 / globalScale}px Sans-Serif`;
      ctx.fillText(node.size, node.x + node.val - 8, node.y - node.val + 8);
    }
  }, [selectedClusterId, hoveredNode, searchResults, searchQuery]);

  // Link rendering
  const linkCanvasObject = useCallback((link, ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, []);

  // Handle node hover
  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node);
    
    if (node) {
      // Create tooltip content based on node type
      let tooltipContent = null;

      if (node.type === 'main-cluster' || node.type === 'sub-cluster') {
        tooltipContent = (
          <div className="graph-tooltip cluster-tooltip">
            <h4>{node.label}</h4>
            <p className="tooltip-size">{node.size} messages</p>
            {node.tags && node.tags.length > 0 && (
              <div className="tooltip-tags">
                {node.tags.slice(0, 5).map(tag => (
                  <span key={tag} className="tooltip-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        );
      } else if (node.type === 'message' && node.message) {
        tooltipContent = (
          <div className="graph-tooltip message-tooltip">
            <div className="tooltip-header">
              <span className="tooltip-user">
                <img src={UserIcon} alt="" className="tooltip-icon" />
                {node.message.user}
              </span>
              <span className="tooltip-channel">
                <img src={ChannelIcon} alt="" className="tooltip-icon" />
                {node.message.channel}
              </span>
            </div>
            <p className="tooltip-text">{node.message.text}</p>
            <div className="tooltip-meta">
              <span className="tooltip-meta-item">
                <img src={ClockIcon} alt="" className="tooltip-icon" />
                {new Date(node.message.timestamp).toLocaleString()}
              </span>
              {node.message.permalink && (
                <span className="tooltip-link">
                  <img src={LinkIcon} alt="" className="tooltip-icon" />
                  Click to open
                </span>
              )}
            </div>
          </div>
        );
      }

      setTooltip(tooltipContent);
    } else {
      setTooltip(null);
    }
  }, []);

  // Handle node drag
  const handleNodeDrag = useCallback((node) => {
    draggedNodeRef.current = node;
  }, []);

  const handleNodeDragEnd = useCallback((node) => {
    if (draggedNodeRef.current) {
      // Animate back to original position
      const original = originalPositionsRef.current[node.id];
      if (original) {
        node.fx = original.fx;
        node.fy = original.fy;
      }
      draggedNodeRef.current = null;
    }
  }, []);

  if (!clusteringData || graphData.nodes.length === 0) {
    return (
      <div className="cluster-graph-empty">
        <p>No clusters to display. Upload messages to get started.</p>
      </div>
    );
  }

  return (
    <div className="radial-cluster-graph-container">
      {focusedNode && (
        <button className="back-button" onClick={handleBackClick}>
          ← Back
        </button>
      )}

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel={() => ''}
        nodeVal="val"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0e27"
        cooldownTicks={0}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
        enableNodeDrag={true}
        enableZoomInteraction={false}
        enablePanInteraction={false}
      />

      {/* Tooltip */}
      {tooltip && hoveredNode && (
        <div
          className="graph-tooltip-wrapper"
          style={{
            left: `${hoveredNode.x + 20}px`,
            top: `${hoveredNode.y}px`,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
};

// Get color for cluster
const getClusterColor = (index) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  ];
  return colors[index % colors.length];
};

export default RadialClusterGraph;

