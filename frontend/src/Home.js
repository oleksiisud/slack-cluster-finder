import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const dashboards = [
    { id: 1, title: "Slack — CTP-11", source: "Slack", url: "fake1" },
    // { id: 2, title: "Discord — CISC_1115", source: "Discord", url: "fake2" },
    // { id: 3, title: "WhatsApp — Trip To Japan", source: "WhatsApp", url: "fake3" },
  ];

  return (
    <div className="home">
      <div className="hero-section">
        <h1 className="jersey-10-regular hero-title">Hello CX40</h1>
        <p className="hero-subtitle">Your personalized dashboards</p>
      </div>

      <div className="dashboard-grid">
        {dashboards.map(d => (
          <div
            className="dashboard-card"
            key={d.id}
            onClick={() => navigate(`/dashboard/${d.id}`)}
          >
            <h3>{d.title}</h3>
            <p>{d.source}</p>
          </div>
        ))}

        <div
          className="dashboard-card new"
          onClick={() => navigate("/new-dashboard")}
        >
          <h3>＋ Create New Dashboard</h3>
        </div>
      </div>
    </div>
  );
}
