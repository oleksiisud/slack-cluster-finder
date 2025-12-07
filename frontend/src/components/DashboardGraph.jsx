import React, { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function DashboardGraph({ onNodeClick }) {
    const fgRef = useRef();
    const [canvasSize, setCanvasSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  
    useEffect(() => {
      const handleResize = () =>
        setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  
    // Put node in the center
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
  
    const graphData = {
      nodes: [
        {
          id: "create",
          label: "Create Dashboard",
          x: centerX,
          y: centerY,
          fx: centerX, // fixed x
          fy: centerY, // fixed y
        },
      ],
      links: [],
    };
  
    useEffect(() => {
      const fg = fgRef.current;
      if (!fg) return;
      // Disable simulation forces
      fg.d3Force("charge", null);
      fg.d3Force("center", null);
      fg.d3Force("link", null);
    }, []);
  
    const handleNodeClick = (node) => {
      if (node.id === "create" && onNodeClick) onNodeClick(node);
    };
  
    return (
      <ForceGraph2D
        ref={fgRef}
        width={canvasSize.width}
        height={canvasSize.height}
        graphData={graphData}
        onNodeClick={handleNodeClick}
        enableNodeDrag={false}
        enableZoomPanInteraction={false}
        nodeCanvasObject={(node, ctx) => {
          ctx.beginPath();
          const radius = 12;
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = "#d3d3d3";
          ctx.fill();
          ctx.strokeStyle = "#888";
          ctx.stroke();
  
          ctx.fillStyle = "black";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(node.label, node.x, node.y - 16);
        }}
      />
    );
  }