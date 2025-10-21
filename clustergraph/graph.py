import numpy as np
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering
from sklearn.manifold import TSNE
from matplotlib.patches import Circle
import matplotlib.patches as mpatches

class InteractiveMessageClusters:
    def __init__(self, messages, n_clusters=5):
        """
        Initialize the cluster visualization with Slack messages.
        
        Args:
            messages: List of dictionaries with keys 'text', 'channel', 'user', 'timestamp'
            n_clusters: Number of main clusters to create
        """
        self.messages = messages
        self.n_clusters = n_clusters
        self.fig, self.ax = plt.subplots(figsize=(14, 10))
        self.annotations = []
        
    def process_and_cluster(self):
        """Extract features and perform hierarchical clustering"""
        # Extract text from messages
        texts = [msg['text'] for msg in self.messages]
        
        # Vectorize text using TF-IDF
        self.vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        self.features = self.vectorizer.fit_transform(texts).toarray()
        
        # Hierarchical clustering for main clusters
        self.main_clustering = AgglomerativeClustering(
            n_clusters=self.n_clusters,
            linkage='ward'
        )
        self.main_labels = self.main_clustering.fit_predict(self.features)
        
        # Create subclusters within each main cluster
        self.sub_labels = np.zeros_like(self.main_labels)
        current_sublabel = 0
        
        for cluster_id in range(self.n_clusters):
            cluster_mask = self.main_labels == cluster_id
            cluster_features = self.features[cluster_mask]
            
            if len(cluster_features) > 3:
                n_subclusters = min(3, len(cluster_features) // 2)
                sub_clustering = AgglomerativeClustering(
                    n_clusters=n_subclusters,
                    linkage='ward'
                )
                sub_labels_temp = sub_clustering.fit_predict(cluster_features)
                self.sub_labels[cluster_mask] = sub_labels_temp + current_sublabel
                current_sublabel += n_subclusters
            else:
                self.sub_labels[cluster_mask] = current_sublabel
                current_sublabel += 1
        
        # Reduce dimensions for visualization
        tsne = TSNE(n_components=2, random_state=42, perplexity=min(30, len(texts)-1))
        self.positions = tsne.fit_transform(self.features)
        
    def visualize(self):
        """Create the interactive visualization"""
        self.ax.clear()
        
        # Color palette
        colors = plt.cm.tab10(np.linspace(0, 1, self.n_clusters))
        
        # Plot main cluster backgrounds
        for cluster_id in range(self.n_clusters):
            cluster_mask = self.main_labels == cluster_id
            cluster_pos = self.positions[cluster_mask]
            
            if len(cluster_pos) > 0:
                # Draw cluster boundary
                center = cluster_pos.mean(axis=0)
                radius = np.max(np.linalg.norm(cluster_pos - center, axis=1)) + 0.5
                circle = Circle(center, radius, alpha=0.1, color=colors[cluster_id], 
                              linewidth=2, linestyle='--', fill=True)
                self.ax.add_patch(circle)
        
        # Plot individual messages
        self.scatter = self.ax.scatter(
            self.positions[:, 0], 
            self.positions[:, 1],
            c=self.main_labels,
            cmap='tab10',
            s=100,
            alpha=0.7,
            edgecolors='black',
            linewidths=1.5,
            picker=True
        )
        
        # Add cluster labels
        for cluster_id in range(self.n_clusters):
            cluster_mask = self.main_labels == cluster_id
            cluster_pos = self.positions[cluster_mask]
            if len(cluster_pos) > 0:
                center = cluster_pos.mean(axis=0)
                self.ax.text(center[0], center[1], f'Cluster {cluster_id+1}',
                           fontsize=14, fontweight='bold',
                           bbox=dict(boxstyle='round,pad=0.5', facecolor=colors[cluster_id], 
                                   alpha=0.3, edgecolor='black', linewidth=2),
                           ha='center', va='center')
        
        self.ax.set_title('Interactive Slack Message Clusters\n(Click on points to see message details)', 
                         fontsize=16, fontweight='bold', pad=20)
        self.ax.set_xlabel('Dimension 1', fontsize=12)
        self.ax.set_ylabel('Dimension 2', fontsize=12)
        self.ax.grid(True, alpha=0.3)
        
        # Connect click event
        self.fig.canvas.mpl_connect('pick_event', self.on_pick)
        
    def on_pick(self, event):
        """Handle click events on data points"""
        if event.artist != self.scatter:
            return
        
        # Remove previous annotations
        for ann in self.annotations:
            ann.remove()
        self.annotations = []
        
        # Get clicked point index
        ind = event.ind[0]
        msg = self.messages[ind]
        
        # Create detailed annotation
        detail_text = (
            f"Channel: {msg['channel']}\n"
            f"User: {msg['user']}\n"
            f"Time: {msg['timestamp']}\n"
            f"Main Cluster: {self.main_labels[ind] + 1}\n"
            f"Sub-cluster: {self.sub_labels[ind] + 1}\n"
            f"\nMessage:\n{msg['text'][:100]}..."
        )
        
        # Position annotation
        x, y = self.positions[ind]
        ann = self.ax.annotate(
            detail_text,
            xy=(x, y),
            xytext=(20, 20),
            textcoords='offset points',
            bbox=dict(boxstyle='round,pad=1', facecolor='yellow', alpha=0.9, 
                     edgecolor='black', linewidth=2),
            arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0.3', 
                          lw=2, color='black'),
            fontsize=9,
            fontfamily='monospace'
        )
        self.annotations.append(ann)
        
        # Highlight selected point
        highlight = self.ax.scatter(
            [x], [y],
            s=300,
            facecolors='none',
            edgecolors='red',
            linewidths=3,
            zorder=10
        )
        self.annotations.append(highlight)
        
        self.fig.canvas.draw()
    
    def run(self):
        """Process data and show interactive plot"""
        print("Processing messages and creating clusters...")
        self.process_and_cluster()
        print("Rendering visualization...")
        self.visualize()
        plt.tight_layout()
        plt.show()

if __name__ == "__main__":
    import json
    
    with open('slack_messages.json', 'r') as f:
        messages = json.load(f)
    
    print(f"Loaded {len(messages)} messages from file")
    
    viz = InteractiveMessageClusters(messages, n_clusters=8)
    viz.run()