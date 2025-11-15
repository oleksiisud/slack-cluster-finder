import { useNavigate } from "react-router-dom";

export default function DataCard({ label, value }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (value === "/new-dashboard") {
      navigate(value);
    } else {
      const id = value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
  
      navigate(`/dashboard/${id}`, {
        state: { label }  
      });
    }
  };
  

  return (
    <div className="channel-card" onClick={handleClick}>
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}
