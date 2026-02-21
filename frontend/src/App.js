import { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";

const API = "http://localhost:8000";

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e"
};

export default function App() {
  const [incidents, setIncidents]   = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [incRes, statRes] = await Promise.all([
        axios.get(`${API}/incidents/?limit=20`),
        axios.get(`${API}/incidents/stats`)
      ]);
      setIncidents(incRes.data);
      setStats(statRes.data);
    } catch (e) {
      console.error("API error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={styles.center}>
      <h2>⏳ Loading OSNIT Shield Dashboard...</h2>
    </div>
  );

  // Prepare chart data
  const severityData = stats?.severity_breakdown
    ? Object.entries(stats.severity_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const categoryData = stats?.category_breakdown
    ? Object.entries(stats.category_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🛡️ OSNIT Shield Dashboard</h1>
        <p style={styles.subtitle}>Real-time threat intelligence monitor</p>
      </div>

      {/* Stats Cards */}
      <div style={styles.cardRow}>
        <div style={styles.card}>
          <h3 style={styles.cardLabel}>Total Incidents</h3>
          <p style={styles.cardValue}>{stats?.total_incidents}</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardLabel}>NewsAPI Sources</h3>
          <p style={styles.cardValue}>{stats?.newsapi_incidents}</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardLabel}>Critical Threats</h3>
          <p style={{...styles.cardValue, color: "#ef4444"}}>
            {stats?.severity_breakdown?.critical || 0}
          </p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardLabel}>High Threats</h3>
          <p style={{...styles.cardValue, color: "#f97316"}}>
            {stats?.severity_breakdown?.high || 0}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartRow}>

        {/* Severity Pie Chart */}
        <div style={styles.chartBox}>
          <h2 style={styles.chartTitle}>Severity Breakdown</h2>
          <PieChart width={350} height={280}>
            <Pie
              data={severityData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {severityData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={SEVERITY_COLORS[entry.name] || "#8884d8"}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>

        {/* Category Bar Chart */}
        <div style={styles.chartBox}>
          <h2 style={styles.chartTitle}>Incident Categories</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Incident Feed */}
      <div style={styles.feedBox}>
        <h2 style={styles.chartTitle}>📰 Live Incident Feed</h2>
        {incidents.map((inc) => (
          <div key={inc.id} style={styles.incidentCard}>
            <div style={styles.incidentTop}>
              <span style={{
                ...styles.badge,
                background: SEVERITY_COLORS[inc.severity] || "#6b7280"
              }}>
                {inc.severity?.toUpperCase() || "UNKNOWN"}
              </span>
              <span style={styles.category}>
                {inc.incident_type || "unclassified"}
              </span>
              <span style={styles.source}>{inc.source}</span>
              <span style={styles.time}>
                {new Date(inc.collected_at).toLocaleString()}
              </span>
            </div>
            <p style={styles.content}>{inc.content}</p>
            {inc.url && (
              <a href={inc.url} target="_blank" rel="noreferrer" style={styles.link}>
                Read more →
              </a>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

const styles = {
  container:    { background: "#0f172a", minHeight: "100vh", padding: "24px", fontFamily: "sans-serif" },
  center:       { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0f172a", color: "#fff" },
  header:       { textAlign: "center", marginBottom: "32px" },
  title:        { color: "#f1f5f9", fontSize: "32px", margin: 0 },
  subtitle:     { color: "#94a3b8", marginTop: "8px" },
  cardRow:      { display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" },
  card:         { background: "#1e293b", borderRadius: "12px", padding: "20px", flex: 1, minWidth: "160px" },
  cardLabel:    { color: "#94a3b8", fontSize: "13px", margin: 0 },
  cardValue:    { color: "#f1f5f9", fontSize: "36px", fontWeight: "bold", margin: "8px 0 0" },
  chartRow:     { display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" },
  chartBox:     { background: "#1e293b", borderRadius: "12px", padding: "20px", flex: 1, minWidth: "300px" },
  chartTitle:   { color: "#f1f5f9", fontSize: "18px", marginTop: 0 },
  feedBox:      { background: "#1e293b", borderRadius: "12px", padding: "20px" },
  incidentCard: { background: "#0f172a", borderRadius: "8px", padding: "16px", marginBottom: "12px", borderLeft: "4px solid #6366f1" },
  incidentTop:  { display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" },
  badge:        { color: "#fff", padding: "2px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "bold" },
  category:     { color: "#a5b4fc", fontSize: "13px" },
  source:       { color: "#64748b", fontSize: "12px" },
  time:         { color: "#64748b", fontSize: "12px", marginLeft: "auto" },
  content:      { color: "#cbd5e1", fontSize: "14px", margin: "4px 0" },
  link:         { color: "#6366f1", fontSize: "13px" }
};