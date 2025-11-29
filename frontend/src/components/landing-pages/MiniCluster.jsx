import 'aframe';
import React, { useEffect, useState, useRef } from "react";
import { ForceGraph2D } from "react-force-graph";

/* 🎨 Beautiful fake clusters */
const FAKE_CLUSTERS = [
  { label: "Bug Reports", size: 8, color: "#ff5f5f" },
  { label: "Team Updates", size: 10, color: "#5fa8ff" },
  { label: "Jokes", size: 7, color: "#c084fc" },
  { label: "CS Homework", size: 9, color: "#22c55e" },
  { label: "Planning", size: 8, color: "#facc15" }
];

const MiniCluster = ({ width = 300, height = 300 }) => {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const fgRef = useRef();

  const [hoverNode, setHoverNode] = useState(null);

  useEffect(() => {
    const nodes = FAKE_CLUSTERS.map((c, i) => ({
      id: "cluster-" + i,
      ...c,
      x: width/2 + (Math.random() - 0.5) * 100, // start roughly centered
      y: height/2 + (Math.random() - 0.5) * 100
    }));

    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        links.push({ source: nodes[i].id, target: nodes[j].id });
      }
    }

    setGraph({ nodes, links });
  }, [width, height]);

  // Prevent nodes from going out of bounds
  const handleNodeDrag = (node) => {
    node.x = Math.max(Math.min(node.x, width - 20), 20);
    node.y = Math.max(Math.min(node.y, height - 20), 20);
  };

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graph}
      width={width}
      height={height}

      // ✅ Interactions
      enablePanInteraction={true}
      enableZoomInteraction={true}
      enableNodeDrag={true}
      onNodeDrag={handleNodeDrag}
      // onNodeHover={setHoverNode}

      d3AlphaDecay={0.05}
      backgroundColor="transparent"
      
      linkColor={() => "rgba(150, 110, 255, 0.35)"}
      linkWidth={0.8}
      linkCurvature={0.25}

      nodeCanvasObject={(node, ctx) => {
        const baseRadius = node.size;
        let radius = baseRadius;

        // ✅ Pulse effect when hovered
        if (hoverNode && hoverNode.id === node.id) {
          radius = baseRadius * 1.5 + Math.sin(Date.now() / 200) * 2;
        }

        // Outer glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${node.color}33`; // softer glow
        ctx.fill();

        // Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.shadowBlur = hoverNode && hoverNode.id === node.id ? 20 : 10;
        ctx.shadowColor = node.color;
        ctx.fill();

        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = "white";
        ctx.font = "5px Courier New";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + radius + 8);
      }}

      nodePointerAreaPaint={(node, color, ctx) => {
        // slightly bigger pointer area for easier drag
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }}
    />
  );
};

export default MiniCluster;
