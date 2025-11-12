import { useParams } from "react-router-dom";

export default function Dashboard() {
  const { channelId } = useParams();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard: {channelId}</h1>
      <p>This is where your cluster graph and message analysis will appear.</p>

      {/* TODO: Insert cluster visualization */}
    </div>
  );
}
