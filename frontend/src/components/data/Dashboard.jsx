import { useParams, useLocation } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const { channelId } = useParams();
  const location = useLocation();

  const label = location.state?.label || channelId;

  return (
    <div className="Dashboard">
      <h1>Dashboard: {label}</h1>

      <div className="dashboard-layout">
        {/* Graph Area */}
        <div className="graph-section">
          <h2>Cluster Graph</h2>
          <div className="graph-placeholder">
            {/* Graph will be placed in here */}
            <p>Graph will render here</p>
          </div>
        </div>

        {/* Filter/Seach bar Area */}
        <div className="filter-section">
          <h2>Filters</h2>
          <div className="filter-placeholder">
            {/* Filter/Seach bar will go here */}
            <p>No filters yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
