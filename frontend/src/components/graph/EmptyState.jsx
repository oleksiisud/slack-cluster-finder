/**
 * Empty State component - shown when no clustering data is available
 */
import { ArrowLeft, Loader } from 'lucide-react';
import './EmptyState.css';

const EmptyState = ({ activeChat, onBackToHome }) => {
  return (
    <div className="empty-state">
      {onBackToHome && (
        <button onClick={onBackToHome} className="empty-state-back-btn">
          <ArrowLeft size={16} /> Home
        </button>
      )}
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <Loader size={64} />
        </div>
        <h2 className="empty-state-title">No Clustering Data Available</h2>
        <p className="empty-state-description">
          {activeChat?.name ? (
            <>
              The chat "{activeChat.name}" doesn't have any clustering data yet. 
              This happens when the AI clustering service was unavailable during upload.
            </>
          ) : (
            'This chat has not been processed for clustering yet.'
          )}
        </p>
        <div className="empty-state-actions">
          <p className="empty-state-hint">
            To see the cluster visualization, the chat needs to be processed with AI clustering.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;

