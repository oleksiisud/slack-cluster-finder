import 'aframe';
import React, { useEffect, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import messages from "../data/messages.json";

// ---- Keywords for auto labeling clusters ----
const TOPIC_KEYWORDS = {
  "Tech": ["prediction", "pipeline", "analylsis"],
  "Issues": ["bug", "error", "fail", "crash"],
  "Project" : ["meeting", "project", "deadline", "update", "sync", "fix"],
  "School": ["question", "professor", "homework", "assignment", "cs201", "class", "due", "notes"],
  "Social": ["weekend", "hiking", "plans", "boba", "fun"],
  "Cats": ["cat", "kitten", "loaf", "zoomies", "pet"],
  "Random Chat": []
};

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#06b6d4"];

const MiniCluster = ({ width = 300, height = 300 }) => {
  const [graph, setGraph] = useState({ nodes: [], links: [] });

  // ---------- FAKE EMBEDDINGS ----------
  const keywordVectors = Object.fromEntries(
    Object.keys(TOPIC_KEYWORDS).map((k, i) => {
      const v = Array(12).fill(0);
      v[i % 12] = 1;
      return [k, v];
    })
  );

  const embedText = (text) => {
    const v = Array(12).fill(0);
    const lower = text.toLowerCase();

    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      if (words.some((w) => lower.includes(w))) {
        const base = keywordVectors[topic];
        for (let i = 0; i < 12; i++) v[i] += base[i];
      }
    }

    for (let i = 0; i < 12; i++) v[i] += Math.random() * 0.15;
    return v;
  };

  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) + 1e-9);

  // ---------- FAST KMEANS ----------
  const kmeans = (embs, k = 4) => {
    const centroids = embs.slice(0, k).map((v) => v.slice());
    const labels = Array(embs.length).fill(0);

    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < embs.length; i++) {
        let best = 0,
          bestS = -Infinity;
        for (let c = 0; c < k; c++) {
          const s = cos(embs[i], centroids[c]);
          if (s > bestS) {
            best = c;
            bestS = s;
          }
        }
        labels[i] = best;
      }

      const sums = Array.from({ length: k }, () =>
        Array(12).fill(0)
      );
      const counts = Array(k).fill(0);

      labels.forEach((lbl, i) => {
        counts[lbl]++;
        for (let d = 0; d < 12; d++) sums[lbl][d] += embs[i][d];
      });

      for (let c = 0; c < k; c++) {
        if (counts[c] === 0) continue;
        for (let d = 0; d < 12; d++)
          centroids[c][d] = sums[c][d] / counts[c];
      }
    }

    return { labels, centroids };
  };

  // ---------- BUILD GRAPH ----------
  useEffect(() => {
    const texts = messages.map((m) => m.text || "");
    const embs = texts.map(embedText);

    const k = 4; // nice number for your bounding box
    const { labels, centroids } = kmeans(embs, k);

    // group messages by cluster
    const groups = {};
    labels.forEach((lbl, i) => {
      if (!groups[lbl]) groups[lbl] = [];
      groups[lbl].push(texts[i]);
    });

    // ----- AUTO LABEL CLUSTER -----
    const autoLabel = (clusterMessages) => {
      const lower = clusterMessages.join(" ").toLowerCase();

      for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
        if (words.some((w) => lower.includes(w))) return topic;
      }
      return "General Chat";
    };

    const nodes = Object.keys(groups).map((lbl, i) => ({
      id: "cluster-" + lbl,
      label: autoLabel(groups[lbl]),
      count: groups[lbl].length,
      size: 16 + Math.log(groups[lbl].length + 1) * 3
    }));

    const links = [];
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        links.push({
          source: "cluster-" + i,
          target: "cluster-" + j,
          value: cos(centroids[i], centroids[j])
        });
      }
    }

    setGraph({ nodes, links });
  }, []);

  return (
    <ForceGraph2D
      graphData={graph}
      width={width}
      height={height}
      enableZoomInteraction={false}
      enablePanInteraction={false}
      enableNodeDrag={true}
      d3AlphaDecay={0.1}
      d3VelocityDecay={0.6}
      cooldownTime={150}
      backgroundColor="black"
      linkColor={() => "#555"}
      linkWidth={1}

      nodeCanvasObject={(node, ctx) => {
        const i = parseInt(node.id.split("-")[1], 10);
        const color = COLORS[i % COLORS.length];
      
        const radius = 6 + Math.log(node.count + 1) * 1.5; // MUCH smaller
      
        // Draw tiny node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      
        // Label (closer, visible, not pushed off screen)
        ctx.fillStyle = "white";
        ctx.font = "6px sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${node.label}`,
          node.x + radius + 4,
          node.y
        );
      }}
      
    />
  );
};

export default MiniCluster;
