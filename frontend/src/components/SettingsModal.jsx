/**
 * Settings Modal - Configure chat settings and data sources
 */
import { Settings, X } from 'lucide-react';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            <Settings className="highlight" size={20} /> Settings
          </h2>
          <button onClick={onClose} className="btn-icon-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Time Filter</label>
            <div className="filter-options">
              {['1 Month', '3 Months', 'All Time'].map((opt, i) => (
                <button key={i} className={`filter-btn ${i === 1 ? 'active' : 'inactive'}`}>
                  {opt}
                </button>
              ))}
            </div>
            <p className="form-hint">
              Only clustering messages from the last 3 months to optimize performance.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Integrations</label>
            <div className="integration-card">
              <div className="integration-info">
                <div className="status-dot"></div>
                <div>
                  <div className="integration-title">Slack Connected</div>
                  <div className="integration-subtitle">Last synced 5 mins ago</div>
                </div>
              </div>
              <button className="btn-resync">
                Re-sync
              </button>
            </div>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" className="checkbox-input" />
              Include Direct Messages (DMs)
            </label>
            <label className="checkbox-label">
              <input type="checkbox" className="checkbox-input" />
              Enable Semantic Search (Beta)
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={onClose} className="btn-save">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;