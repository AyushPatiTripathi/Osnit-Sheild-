import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, ResponsiveContainer, Legend, Area, AreaChart
} from "recharts";
// import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";

const INTEL = "http://127.0.0.1:8000/intelligence";
const INC   = "http://127.0.0.1:8000/incidents";
const OPS   = "http://127.0.0.1:8000/operations";

const TABS = ["Overview", "Intelligence", "Map", "Explorer", "Operations"];

const SEV_COLOR = {
  critical: "#ff2d55",
  high:     "#ff6b35",
  medium:   "#ffd60a",
  low:      "#30d158",
};

const CAT_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6"];

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"10px 14px" }}>
      <div style={{ color:"#8b949e", fontSize:11, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, fontSize:13, fontWeight:700 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

function MetricCard({ icon, label, value, color, trend }) {
  return (
    <div style={{
      flex:1, minWidth:160,
      background:"#0d1117", border:`1px solid ${color}44`, borderRadius:10,
      padding:"18px 20px", position:"relative", overflow:"hidden", transition:"transform 0.15s"
    }}
    onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}
    >
      <div style={{ position:"absolute", top:0, right:0, width:90, height:90, background:color+"18", borderRadius:"0 10px 0 90px" }} />
      <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
      <div style={{ color:"#6e7681", fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:38, fontWeight:800, lineHeight:1, color }}>
        {value ?? <span style={{ color:"#30363d" }}>0</span>}
      </div>
      {trend && <div style={{ color:"#484f58", fontSize:11, marginTop:4 }}>{trend}</div>}
    </div>
  );
}

function SevBadge({ level }) {
  const c = SEV_COLOR[level?.toLowerCase()] || "#8b949e";
  return (
    <span style={{ background:c+"22", color:c, border:`1px solid ${c}44`, padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:800, letterSpacing:1, textTransform:"uppercase" }}>
      {level || "unknown"}
    </span>
  );
}

function Panel({ title, dot="#6366f1", children, style={} }) {
  return (
    <div style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:10, padding:"16px 18px", ...style }}>
      {title && (
        <div style={{ display:"flex", alignItems:"center", gap:8, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:1.5, color:"#6e7681", textTransform:"uppercase", marginBottom:14 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:dot, flexShrink:0 }} />
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function AlertBanner({ spikes }) {
  if (!spikes?.length) return null;
  const msg = spikes.map(s => `${s.incident_type?.replace(/_/g," ").toUpperCase()} (+${Math.round(s.growth_rate*100)}%)`).join("  •  ");
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      background:"linear-gradient(90deg,#7f1d1d,#991b1b)", border:"1px solid #ff2d5550",
      borderRadius:8, padding:"10px 18px", marginBottom:20, animation:"pulse 2.5s ease-in-out infinite"
    }}>
      <span style={{ fontSize:16 }}>⚠</span>
      <span style={{ color:"#fca5a5", fontWeight:700, fontSize:12, letterSpacing:0.5, flex:1 }}>ALERT: SPIKE DETECTED — {msg}</span>
      <span style={{ color:"#f87171", fontWeight:700, fontSize:18 }}>›››</span>
    </div>
  );
}

function TopThreats({ threats }) {
  return (
    <Panel title="Top Threats" dot="#ff2d55">
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr>
            {["ID","Type","Risk Score","Cluster"].map(h => (
              <th key={h} style={{ padding:"8px 10px", color:"#484f58", fontSize:10, textAlign:"left", letterSpacing:1, textTransform:"uppercase", borderBottom:"1px solid #21262d", fontFamily:"'IBM Plex Mono',monospace" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {threats?.slice(0,8).map((t,i) => {
            const score = t.risk_score ? Math.round(t.risk_score*30) : null;
            const sc = score > 75 ? "#ff2d55" : score > 50 ? "#ff6b35" : "#ffd60a";
            return (
              <tr key={t.id} style={{ background: i%2===0 ? "#0d111750":"transparent" }}>
                <td style={{ padding:"8px 10px", color:"#484f58" }}>#{t.id}</td>
                <td style={{ padding:"8px 10px", color:"#e6edf3" }}>{t.incident_type?.replace(/_/g," ")||"—"}</td>
                <td style={{ padding:"8px 10px" }}>
                  <span style={{ color:sc, fontWeight:800, fontFamily:"monospace", fontSize:14 }}>{score ?? "—"}</span>
                </td>
                <td style={{ padding:"8px 10px" }}>
                  {t.cluster_id != null
                    ? <span style={{ color:"#6366f1", background:"#6366f120", padding:"2px 6px", borderRadius:4, fontSize:11 }}>C{t.cluster_id}</span>
                    : <span style={{ color:"#484f58" }}>—</span>}
                </td>
              </tr>
            );
          })}
          {!threats?.length && (
            <tr><td colSpan={4} style={{ color:"#484f58", textAlign:"center", padding:24 }}>No threat data yet</td></tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}


function AlertsList({ alerts }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {alerts?.slice(0,6).map((a,i) => (
        <div key={i} style={{
          display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px",
          background:"#161b22", borderLeft:`3px solid ${SEV_COLOR[a.alert_level?.toLowerCase()]||"#30363d"}`,
          borderRadius:"0 6px 6px 0"
        }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:SEV_COLOR[a.alert_level?.toLowerCase()]||"#8b949e", marginTop:3, flexShrink:0 }} />
          <div>
            <span style={{ color:SEV_COLOR[a.alert_level?.toLowerCase()]||"#8b949e", fontSize:10, fontWeight:800, letterSpacing:1, marginRight:8 }}>{a.alert_level?.toUpperCase()}</span>
            <span style={{ color:"#8b949e", fontSize:13 }}>{a.message}</span>
          </div>
        </div>
      ))}
      {!alerts?.length && <div style={{ color:"#484f58", fontSize:13, padding:"10px 0" }}>No active alerts</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Add `useRef` to your existing import at the top of App_dashboard.jsx:
//   import { useEffect, useState, useCallback, useRef } from "react";
//
// STEP 2: REMOVE these 3 lines from App_dashboard.jsx:
//   import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
//   import "leaflet/dist/leaflet.css";
//
// STEP 3: Replace your entire WorldMap function with everything below this block.
//
// That's it — <WorldMap incidents={mapData} height={420} /> stays exactly the same.
// ─────────────────────────────────────────────────────────────────────────────

const INDIA_STATES = [
  { name:"Jammu & Kashmir",  d:"M238,52 L270,42 L310,38 L355,45 L378,62 L370,88 L345,105 L318,118 L290,125 L262,118 L240,100 L228,78 Z",                                                                                cx:305, cy:80,  fill:"#1a2744" },
  { name:"Ladakh",           d:"M355,45 L410,32 L445,40 L450,70 L430,95 L395,100 L370,88 Z",                                                                                                                             cx:410, cy:65,  fill:"#162038" },
  { name:"Himachal Pradesh", d:"M290,125 L318,118 L345,105 L362,118 L358,148 L335,162 L308,165 L288,150 Z",                                                                                                              cx:323, cy:140, fill:"#1e3050" },
  { name:"Punjab",           d:"M240,100 L262,118 L290,125 L288,150 L268,162 L242,158 L222,140 L220,118 Z",                                                                                                              cx:255, cy:132, fill:"#243858" },
  { name:"Haryana",          d:"M268,162 L308,165 L318,188 L305,210 L278,215 L255,200 L248,178 Z",                                                                                                                       cx:283, cy:190, fill:"#1e3050" },
  { name:"Uttarakhand",      d:"M358,148 L395,140 L415,155 L418,178 L395,192 L368,188 L355,170 Z",                                                                                                                       cx:387, cy:170, fill:"#1a2744" },
  { name:"Delhi",            d:"M305,210 L318,205 L325,218 L312,228 L300,222 Z",                                                                                                                                         cx:313, cy:218, fill:"#ff6b3530" },
  { name:"Uttar Pradesh",    d:"M278,215 L305,210 L312,228 L368,188 L395,192 L425,205 L452,228 L468,262 L458,292 L418,308 L372,315 L325,300 L298,278 L275,248 Z",                                                        cx:372, cy:258, fill:"#1e3a5f" },
  { name:"Rajasthan",        d:"M165,178 L220,118 L222,140 L242,158 L248,178 L255,200 L245,255 L228,308 L200,348 L172,362 L148,328 L138,272 L140,215 Z",                                                                 cx:195, cy:268, fill:"#162038" },
  { name:"Gujarat",          d:"M140,328 L172,362 L200,348 L218,372 L222,408 L215,448 L195,470 L168,478 L148,458 L130,418 L128,370 Z",                                                                                  cx:172, cy:408, fill:"#1a2744" },
  { name:"Madhya Pradesh",   d:"M228,308 L245,255 L298,278 L325,300 L372,315 L408,332 L415,372 L388,398 L348,408 L298,402 L258,382 L232,355 Z",                                                                          cx:322, cy:358, fill:"#1e3050" },
  { name:"Bihar",            d:"M452,228 L498,220 L525,235 L530,262 L515,285 L482,295 L458,292 Z",                                                                                                                       cx:492, cy:258, fill:"#1a2744" },
  { name:"Jharkhand",        d:"M458,292 L482,295 L515,285 L535,302 L528,338 L498,355 L468,345 L452,320 Z",                                                                                                              cx:492, cy:322, fill:"#162038" },
  { name:"West Bengal",      d:"M525,235 L568,228 L592,248 L588,285 L572,318 L548,345 L528,338 L535,302 L515,285 L530,262 Z",                                                                                            cx:558, cy:292, fill:"#1e3050" },
  { name:"Odisha",           d:"M468,345 L498,355 L528,338 L548,345 L545,388 L518,415 L488,422 L462,408 L452,378 Z",                                                                                                     cx:500, cy:385, fill:"#1a2744" },
  { name:"Chhattisgarh",     d:"M388,398 L415,372 L408,332 L452,320 L468,345 L452,378 L462,408 L438,428 L405,422 L385,405 Z",                                                                                           cx:425, cy:388, fill:"#243858" },
  { name:"Maharashtra",      d:"M218,408 L258,382 L298,402 L348,408 L388,398 L385,405 L405,422 L398,458 L368,480 L322,488 L275,480 L238,460 L215,448 Z",                                                                 cx:312, cy:445, fill:"#1e3a5f" },
  { name:"Andhra Pradesh",   d:"M405,422 L438,428 L462,408 L488,422 L498,458 L488,498 L455,522 L415,528 L388,515 L372,485 L378,455 Z",                                                                                  cx:435, cy:475, fill:"#1e3050" },
  { name:"Telangana",        d:"M348,408 L385,405 L378,455 L372,485 L342,492 L318,478 L322,448 Z",                                                                                                                       cx:352, cy:452, fill:"#162038" },
  { name:"Karnataka",        d:"M238,460 L275,480 L322,488 L318,478 L342,492 L335,535 L308,558 L272,560 L245,538 L228,505 Z",                                                                                            cx:285, cy:515, fill:"#1a2744" },
  { name:"Goa",              d:"M228,505 L245,502 L248,518 L232,522 Z",                                                                                                                                                  cx:238, cy:512, fill:"#243858" },
  { name:"Tamil Nadu",       d:"M335,535 L388,515 L415,528 L422,565 L408,612 L385,652 L355,665 L328,655 L308,625 L305,590 L318,562 Z",                                                                                  cx:362, cy:592, fill:"#1e3050" },
  { name:"Kerala",           d:"M272,560 L308,558 L305,590 L308,625 L285,652 L262,638 L255,598 Z",                                                                                                                       cx:282, cy:605, fill:"#162038" },
  { name:"Assam",            d:"M568,228 L608,218 L632,235 L628,262 L605,275 L578,268 L572,248 Z",                                                                                                                       cx:602, cy:248, fill:"#1e3050" },
  { name:"Northeast States", d:"M608,218 L648,208 L675,222 L678,255 L658,278 L632,282 L628,262 L632,235 Z",                                                                                                              cx:648, cy:248, fill:"#1a2744" },
  { name:"Sikkim",           d:"M568,210 L582,205 L590,218 L578,228 L568,222 Z",                                                                                                                                         cx:579, cy:218, fill:"#243858" },
];

const INDIA_CITIES = [
  { name:"New Delhi",      x:313, y:218, risk:"critical", capital:true  },
  { name:"Mumbai",         x:215, y:448, risk:"high",     capital:false },
  { name:"Kolkata",        x:572, y:318, risk:"high",     capital:false },
  { name:"Chennai",        x:385, y:555, risk:"medium",   capital:false },
  { name:"Bengaluru",      x:308, y:545, risk:"medium",   capital:false },
  { name:"Hyderabad",      x:352, y:468, risk:"high",     capital:false },
  { name:"Ahmedabad",      x:178, y:375, risk:"medium",   capital:false },
  { name:"Pune",           x:248, y:455, risk:"medium",   capital:false },
  { name:"Jaipur",         x:248, y:235, risk:"low",      capital:false },
  { name:"Lucknow",        x:395, y:235, risk:"medium",   capital:false },
  { name:"Chandigarh",     x:268, y:162, risk:"low",      capital:false },
  { name:"Bhopal",         x:322, y:358, risk:"low",      capital:false },
  { name:"Patna",          x:468, y:258, risk:"medium",   capital:false },
  { name:"Guwahati",       x:612, y:252, risk:"low",      capital:false },
  { name:"Kochi",          x:275, y:625, risk:"low",      capital:false },
  { name:"Srinagar",       x:278, y:72,  risk:"critical", capital:false },
  { name:"Visakhapatnam",  x:462, y:478, risk:"medium",   capital:false },
  { name:"Nagpur",         x:362, y:395, risk:"low",      capital:false },
  { name:"Indore",         x:292, y:355, risk:"low",      capital:false },
  { name:"Varanasi",       x:432, y:258, risk:"medium",   capital:false },
];

function WorldMap({ incidents, height }) {
  height = height || 420;

  const [zoom,         setZoom]         = useState(1);
  const [pan,          setPan]          = useState({ x:0, y:0 });
  const [dragging,     setDragging]     = useState(false);
  const [dragStart,    setDragStart]    = useState(null);
  const [tooltip,      setTooltip]      = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const svgRef = useRef();

  // Merge live severity from incidents if backend sends city field
  const incMap = {};
  (incidents||[]).forEach(inc => { if (inc.city) incMap[inc.city] = inc.severity?.toLowerCase(); });
  const cities = INDIA_CITIES.map(c => ({ ...c, risk: incMap[c.name] || c.risk }));

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0012;
    setZoom(z => Math.min(5, Math.max(0.6, z + delta * z)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive:false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e) => { setDragging(true);  setDragStart({ x:e.clientX-pan.x, y:e.clientY-pan.y }); };
  const onMouseMove = (e) => { if (!dragging) return; setPan({ x:e.clientX-dragStart.x, y:e.clientY-dragStart.y }); };
  const onMouseUp   = ()  => { setDragging(false); };

  const riskCounts = { critical:0, high:0, medium:0, low:0 };
  cities.forEach(c => { if (riskCounts[c.risk]!==undefined) riskCounts[c.risk]++; });

  const transform = `translate(${pan.x},${pan.y}) scale(${zoom}) translate(${400*(1-1/zoom)},${440*(1-1/zoom)})`;
  const dotR   = r => ({ critical:7, high:6, medium:5, low:4 }[r]||4);
  const glowId = r => ({ critical:"imGlowC", high:"imGlowH", medium:"imGlowM", low:"imGlowL" }[r]||"imGlowL");

  return (
    <div style={{ position:"relative", background:"#060d1a", borderRadius:8, overflow:"hidden", height, display:"flex", flexDirection:"column", userSelect:"none", fontFamily:"'IBM Plex Mono',monospace" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", borderBottom:"1px solid #1a2540", flexShrink:0, background:"#07101f" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:14 }}>🇮🇳</span>
          <span style={{ color:"#7c8cf8", fontSize:11, fontWeight:700, letterSpacing:2 }}>INDIA THREAT MAP</span>
          <span style={{ background:"#0f1e35", color:"#4a5568", fontSize:10, padding:"2px 7px", borderRadius:4, border:"1px solid #1a2540" }}>{cities.length} CITIES</span>
        </div>
        <div style={{ display:"flex", gap:14 }}>
          {Object.entries(riskCounts).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:SEV_COLOR[k], boxShadow:`0 0 5px ${SEV_COLOR[k]}` }}/>
              <span style={{ color:"#4a5568", fontSize:10 }}>{k.toUpperCase()} {v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{ position:"absolute", right:12, top:46, zIndex:20, display:"flex", flexDirection:"column", gap:3 }}>
        {[
          { label:"+", fn:() => setZoom(z => Math.min(5, z*1.3))              },
          { label:"−", fn:() => setZoom(z => Math.max(0.6, z/1.3))            },
          { label:"⌂", fn:() => { setZoom(1); setPan({ x:0, y:0 }); }         },
        ].map(btn => (
          <button key={btn.label} onClick={btn.fn} style={{
            width:30, height:30, background:"#0f1e35", border:"1px solid #1a3055",
            borderRadius:6, color:"#7c8cf8", cursor:"pointer", fontSize:15,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 8px #00000066"
          }}>{btn.label}</button>
        ))}
        <div style={{ color:"#2a3a55", fontSize:9, textAlign:"center", marginTop:2 }}>{Math.round(zoom*100)}%</div>
      </div>

      {/* SVG canvas */}
      <div
        style={{ flex:1, overflow:"hidden", cursor:dragging?"grabbing":"grab" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}    onMouseLeave={onMouseUp}
      >
        <svg ref={svgRef} viewBox="0 0 800 880" style={{ width:"100%", height:"100%", display:"block" }}>
          <defs>
            <radialGradient id="imBg" cx="45%" cy="50%" r="60%">
              <stop offset="0%"   stopColor="#0d1a2e"/>
              <stop offset="100%" stopColor="#060d1a"/>
            </radialGradient>
            <filter id="imGlowC"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="imGlowH"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="imGlowM"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="imGlowL"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="imStateHover"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="imTextShadow"><feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#000" floodOpacity="1"/></filter>
          </defs>

          <rect width="800" height="880" fill="url(#imBg)"/>

          {/* Grid */}
          {Array.from({length:9}).map((_,i) => <line key={"h"+i} x1="0"     y1={i*110} x2="800"   y2={i*110} stroke="#0d1825" strokeWidth="0.5"/>)}
          {Array.from({length:9}).map((_,i) => <line key={"v"+i} x1={i*100} y1="0"     x2={i*100} y2="880"   stroke="#0d1825" strokeWidth="0.5"/>)}

          <g transform={transform}>

            {/* Ocean tint */}
            <rect x="90" y="25" width="640" height="820" rx="10" fill="#081525" opacity="0.4"/>

            {/* States */}
            {INDIA_STATES.map((s,i) => {
              const hov = hoveredState===s.name;
              return (
                <g key={i}>
                  {hov && <path d={s.d} fill={s.fill} stroke="#6366f1" strokeWidth="4" opacity="0.4" filter="url(#imStateHover)"/>}
                  <path
                    d={s.d}
                    fill={hov?"#223060":s.fill}
                    stroke={hov?"#6366f1":"#2a3f65"}
                    strokeWidth={hov?1.8:1}
                    style={{ cursor:"pointer", transition:"fill 0.15s" }}
                    onMouseEnter={() => setHoveredState(s.name)}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                  <text
                    x={s.cx} y={s.cy}
                    fill={hov?"#a5b4fc":"#4a6090"}
                    fontSize={zoom>2.5?7:zoom>1.5?6:5}
                    textAnchor="middle" fontFamily="'IBM Plex Mono',monospace"
                    style={{ pointerEvents:"none" }}
                    filter="url(#imTextShadow)"
                  >{s.name}</text>
                </g>
              );
            })}

            {/* India outer border */}
            <path
              d="M238,52 L310,38 L410,32 L450,70 L430,95 L418,178 L452,228 L525,235 L568,228 L608,218 L648,208 L675,222 L678,255 L658,278 L628,262 L572,318 L548,345 L545,388 L518,415 L488,422 L498,458 L488,498 L455,522 L422,565 L408,612 L385,652 L355,665 L328,655 L308,625 L285,652 L262,638 L255,598 L272,560 L228,505 L215,448 L128,370 L130,418 L148,458 L148,328 L138,272 L140,215 L165,178 L220,118 L240,100 L228,78 Z"
              fill="none" stroke="#4a5af0" strokeWidth="1.5" opacity="0.65"
            />

            {/* Water labels */}
            <text x="108" y="495" fill="#0e2035" fontSize="11" fontFamily="'IBM Plex Mono',monospace" fontStyle="italic">ARABIAN</text>
            <text x="112" y="510" fill="#0e2035" fontSize="11" fontFamily="'IBM Plex Mono',monospace" fontStyle="italic">SEA</text>
            <text x="505" y="545" fill="#0e2035" fontSize="11" fontFamily="'IBM Plex Mono',monospace" fontStyle="italic">BAY OF</text>
            <text x="503" y="560" fill="#0e2035" fontSize="11" fontFamily="'IBM Plex Mono',monospace" fontStyle="italic">BENGAL</text>
            <text x="290" y="765" fill="#0e2035" fontSize="11" fontFamily="'IBM Plex Mono',monospace" fontStyle="italic">INDIAN OCEAN</text>

            {/* Pulse rings — critical + high only */}
            {cities.filter(c=>c.risk==="critical"||c.risk==="high").map((c,i)=>(
              <circle key={"p"+i} cx={c.x} cy={c.y} r={18} fill="none" stroke={SEV_COLOR[c.risk]} strokeWidth="0.8" opacity="0.25">
                <animate attributeName="r"       values="8;24;8"    dur="2.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2.2s" repeatCount="indefinite"/>
              </circle>
            ))}

            {/* City markers */}
            {cities.map((c,i)=>{
              const color  = SEV_COLOR[c.risk]||"#8b949e";
              const r      = dotR(c.risk);
              const anchor = c.x>450?"end":"start";
              const lx     = c.x>450?c.x-r-5:c.x+r+5;
              return (
                <g key={i} style={{ cursor:"pointer" }}
                  onMouseEnter={e=>setTooltip({...c,mx:e.clientX,my:e.clientY})}
                  onMouseLeave={()=>setTooltip(null)}>
                  <circle cx={c.x} cy={c.y} r={r+5} fill="none" stroke={color} strokeWidth="0.8" opacity="0.3"/>
                  <circle cx={c.x} cy={c.y} r={r+2} fill="none" stroke={color} strokeWidth="0.5" opacity="0.5"/>
                  <circle cx={c.x} cy={c.y} r={r}   fill={color} opacity="0.95" filter={`url(#${glowId(c.risk)})`}/>
                  {c.capital&&<text x={c.x} y={c.y+2} fill="#fff" fontSize={r-1} textAnchor="middle" dominantBaseline="middle" style={{pointerEvents:"none"}}>★</text>}
                  <text
                    x={lx} y={c.y+3}
                    fill={color}
                    fontSize={zoom>2.5?7.5:zoom>1.5?6.5:6}
                    textAnchor={anchor}
                    fontFamily="'IBM Plex Mono',monospace"
                    fontWeight={c.risk==="critical"||c.risk==="high"?"bold":"normal"}
                    style={{ pointerEvents:"none" }}
                    filter="url(#imTextShadow)"
                  >{c.name}</text>
                </g>
              );
            })}

          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip&&(
        <div style={{
          position:"fixed", left:tooltip.mx+14, top:tooltip.my-14, zIndex:9999, pointerEvents:"none",
          background:"#0a1628", border:`1px solid ${SEV_COLOR[tooltip.risk]}`,
          borderRadius:8, padding:"10px 14px",
          boxShadow:`0 0 20px ${SEV_COLOR[tooltip.risk]}55, 0 4px 24px #00000099`,
          fontFamily:"'IBM Plex Mono',monospace", fontSize:11
        }}>
          <div style={{ color:"#e6edf3", fontWeight:700, marginBottom:6, fontSize:13 }}>{tooltip.name}</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:9, height:9, borderRadius:"50%", background:SEV_COLOR[tooltip.risk], boxShadow:`0 0 6px ${SEV_COLOR[tooltip.risk]}` }}/>
            <span style={{ color:SEV_COLOR[tooltip.risk], textTransform:"uppercase", letterSpacing:1 }}>{tooltip.risk} RISK</span>
          </div>
          {tooltip.capital&&<div style={{ color:"#6366f1", fontSize:10, marginTop:5 }}>★ National Capital Territory</div>}
        </div>
      )}

      {/* Hovered state badge */}
      {hoveredState&&(
        <div style={{ position:"absolute", bottom:28, left:14, background:"#0f1e35", border:"1px solid #1a3055", borderRadius:5, padding:"4px 10px", fontSize:10, color:"#7c8cf8", pointerEvents:"none", zIndex:10 }}>
          {hoveredState}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:"4px 14px", borderTop:"1px solid #1a2540", display:"flex", justifyContent:"space-between", flexShrink:0, background:"#07101f" }}>
        <span style={{ color:"#2a3a55", fontSize:9 }}>SCROLL TO ZOOM  ·  DRAG TO PAN  ·  HOVER FOR DETAILS</span>
        <span style={{ color:"#2a3a55", fontSize:9 }}>IND-OSNIT v2.0</span>
      </div>
    </div>
  );
}


function IncidentFeed({ incidents }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {incidents?.map(inc => (
        <div key={inc.id} style={{
          background:"#0d1117", border:"1px solid #21262d",
          borderLeft:`4px solid ${SEV_COLOR[inc.severity?.toLowerCase()]||"#30363d"}`,
          borderRadius:"0 8px 8px 0", padding:"14px 16px"
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
            <SevBadge level={inc.severity} />
            <span style={{ color:"#6366f1", fontSize:12 }}>{inc.incident_type?.replace(/_/g," ")||"unclassified"}</span>
            <span style={{ color:"#484f58", fontSize:11 }}>{inc.source}</span>
            <span style={{ color:"#30363d", fontSize:11, marginLeft:"auto" }}>{inc.collected_at ? new Date(inc.collected_at).toLocaleString() : ""}</span>
          </div>
          <p style={{ color:"#8b949e", fontSize:13, margin:0, lineHeight:1.6 }}>{inc.content}</p>
          {inc.url && <a href={inc.url} target="_blank" rel="noreferrer" style={{ color:"#6366f1", fontSize:12, marginTop:6, display:"inline-block", textDecoration:"none" }}>View source →</a>}
        </div>
      ))}
      {!incidents?.length && <div style={{ color:"#484f58", textAlign:"center", padding:40 }}>No incidents loaded</div>}
    </div>
  );
}

function OperationsPanel({ schedulerStatus }) {
  const [ingRunning, setIngRunning] = useState(false);
  const [aiRunning, setAiRunning]   = useState(false);
  const [log, setLog] = useState([{ msg:"$ system ready", type:"info", time:new Date().toLocaleTimeString() }]);
  const addLog = (msg, type="info") => setLog(p => [...p.slice(-19), { msg, type, time:new Date().toLocaleTimeString() }]);

  const runIngestion = async () => {
    setIngRunning(true); addLog("Starting ingestion...");
    try { await axios.post(`${OPS}/run-ingestion`); addLog("✓ Ingestion completed","success"); }
    catch { addLog("✗ Ingestion failed — check backend","error"); }
    setIngRunning(false);
  };
  const runAI = async () => {
    setAiRunning(true); addLog("Running AI pipeline...");
    try { await axios.post(`${OPS}/run-ai`); addLog("✓ AI processing completed","success"); }
    catch { addLog("✗ AI pipeline failed — check backend","error"); }
    setAiRunning(false);
  };

  return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
      <Panel title="Controls" dot="#30d158" style={{ flex:1, minWidth:260 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { label: ingRunning?"⟳ Running...":"▶ Run Ingestion", color:"#0a84ff", fn:runIngestion, dis:ingRunning },
            { label: aiRunning?"⟳ Processing...":"⚡ Run AI Analysis", color:"#6366f1", fn:runAI, dis:aiRunning },
          ].map(b => (
            <button key={b.label} onClick={b.fn} disabled={b.dis} style={{
              padding:"10px 16px", borderRadius:8, cursor:b.dis?"not-allowed":"pointer",
              background:b.dis?"#21262d":b.color+"18", color:b.dis?"#6e7681":b.color,
              border:`1px solid ${b.dis?"#30363d":b.color+"44"}`,
              fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, textAlign:"left", letterSpacing:0.5
            }}>{b.label}</button>
          ))}
          <div style={{ padding:"12px 14px", background:"#161b22", borderRadius:8, border:"1px solid #21262d", marginTop:4 }}>
            <div style={{ color:"#484f58", fontSize:10, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Scheduler Status</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:schedulerStatus?.running?"#30d158":"#ff2d55", boxShadow:schedulerStatus?.running?"0 0 8px #30d158":"none" }} />
              <span style={{ color:schedulerStatus?.running?"#30d158":"#ff2d55", fontWeight:700, fontSize:13, fontFamily:"monospace" }}>
                {schedulerStatus?.running ? "ACTIVE":"INACTIVE"}
              </span>
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="System Log" dot="#ffd60a" style={{ flex:2, minWidth:300 }}>
        <div style={{ background:"#161b22", borderRadius:8, padding:12, fontFamily:"monospace", fontSize:12, height:200, overflowY:"auto", border:"1px solid #21262d" }}>
          {log.map((l,i) => (
            <div key={i} style={{ color:l.type==="success"?"#30d158":l.type==="error"?"#ff2d55":"#8b949e", marginBottom:4 }}>
              <span style={{ color:"#484f58" }}>[{l.time}]</span> {l.msg}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export default function App() {
  const [tab, setTab]             = useState("Overview");
  const [summary, setSummary]     = useState(null);
  const [trends, setTrends]       = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [threats, setThreats]     = useState([]);
  const [mapData, setMapData]     = useState([]);
  const [spikes, setSpikes]       = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading]     = useState(true);

  const fetchAll = useCallback(async () => {
    const r = await Promise.allSettled([
      axios.get(`${INTEL}/summary`),
      axios.get(`${INTEL}/trends`),
      axios.get(`${INTEL}/alerts`),
      axios.get(`${INTEL}/top-threats`),
      axios.get(`${INC}/map`),
      axios.get(`${INTEL}/spikes`),
      axios.get(`${INC}/?limit=30`),
      axios.get(`${OPS}/status`),
    ]);
    const d = i => r[i].status==="fulfilled" ? r[i].value.data : null;
    if (d(0)) setSummary(d(0));
    if (d(1)) setTrends(d(1).hourly_trends||[]);
    if (d(2)) setAlerts(d(2).alerts||[]);
    if (d(3)) setThreats(d(3).top_threats||[]);
    if (d(4)) setMapData(d(4).incidents||[]);
    if (d(5)) setSpikes(d(5).spikes||[]);
    if (d(6)) setIncidents(d(6)||[]);
    if (d(7)) setSchedulerStatus(d(7));
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const trendData = trends.map(t => ({
    time: t.hour ? new Date(t.hour).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "",
    total: t.incident_count,
    high: Math.round((t.incident_count||0)*0.38),
  }));

  const sevData = summary?.severity_breakdown
    ? Object.entries(summary.severity_breakdown).map(([k,v]) => ({ name:k, count:v, fill:SEV_COLOR[k]||"#6366f1" }))
    : [];

  const catData = summary?.top_incident_types?.map((t,i) => ({
    name: t.incident_type?.replace(/_/g," ")||"other",
    count: t.count, fill: CAT_COLORS[i%CAT_COLORS.length]
  })) || [];

  const isActive = schedulerStatus?.running;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#010409", flexDirection:"column", gap:16 }}>
      <div style={{ width:36, height:36, border:"3px solid #21262d", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <div style={{ color:"#6e7681", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:2, fontSize:12 }}>LOADING OSNIT SHIELD...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const SLabel = ({ children }) => (
    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:2, color:"#6e7681", textTransform:"uppercase", margin:"20px 0 10px" }}>{children}</div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#010409", color:"#e6edf3", fontFamily:"'IBM Plex Sans',sans-serif", fontSize:14 }}>

      <header style={{ display:"flex", alignItems:"center", gap:16, padding:"0 24px", height:56, background:"#0d1117", borderBottom:"1px solid #21262d", position:"sticky", top:0, zIndex:200, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>🛡</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, letterSpacing:1 }}>
            OSNIT <strong style={{ color:"#6366f1" }}>Shield</strong>
          </span>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:8 }}>
          {[{l:"▶ START INGESTION",c:"#0a84ff"},{l:"⚡ RUN AI ANALYSIS",c:"#30d158"}].map(b=>(
            <button key={b.l} onClick={fetchAll} style={{ padding:"6px 14px", borderRadius:6, cursor:"pointer", background:b.c+"18", color:b.c, border:`1px solid ${b.c}44`, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:0.5 }}>{b.l}</button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:isActive?"#30d158":"#ff2d55", boxShadow:isActive?"0 0 8px #30d158":"none" }} />
          <span style={{ color:"#8b949e", fontSize:12 }}>Scheduler: <strong style={{ color:isActive?"#30d158":"#ff2d55" }}>{isActive?"ACTIVE":"INACTIVE"}</strong></span>
        </div>
        <div style={{ color:"#484f58", fontSize:12, marginLeft:"auto" }}>Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"}</div>
      </header>

      <nav style={{ display:"flex", background:"#0d1117", borderBottom:"1px solid #21262d", padding:"0 24px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:"transparent", border:"none",
            borderBottom: tab===t ? "2px solid #6366f1":"2px solid transparent",
            color: tab===t ? "#e6edf3":"#6e7681",
            padding:"12px 18px", cursor:"pointer",
            fontFamily:"'IBM Plex Sans',sans-serif", fontSize:13,
            fontWeight: tab===t ? 700:400, letterSpacing:0.3, transition:"all 0.15s"
          }}>{t}</button>
        ))}
      </nav>

      <div style={{ padding:24, maxWidth:1600, margin:"0 auto" }}>
        <AlertBanner spikes={spikes} />

        {tab==="Overview" && (
          <>
            <div style={{ display:"flex", gap:14, marginBottom:18, flexWrap:"wrap" }}>
              <MetricCard icon="🔥" label="High Incidents" value={summary?.severity_breakdown?.high??0} color="#ff2d55" trend={`Critical: ${summary?.severity_breakdown?.critical??0}`} />
              <MetricCard icon="⚠️" label="Active Alerts" value={summary?.total_alerts??0} color="#ffd60a" trend="last 24h" />
              <MetricCard icon="📈" label="Avg Risk Score" value={summary?.average_risk_score ? Math.round(summary.average_risk_score*30):0} color="#30d158" trend="normalized 0–100" />
              <MetricCard icon="🗄️" label="Total Records (24h)" value={summary?.incidents_last_24h??0} color="#0a84ff" trend={`Total: ${summary?.total_incidents??0}`} />
            </div>

            <div style={{ display:"flex", gap:16, marginBottom:18, flexWrap:"wrap" }}>
              <Panel title="Incident Trend (Last 24 Hours)" dot="#30d158" style={{ flex:2, minWidth:300 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#30d158" stopOpacity={0.3}/><stop offset="95%" stopColor="#30d158" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff6b35" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="time" tick={{ fill:"#484f58", fontSize:10 }} />
                    <YAxis tick={{ fill:"#484f58", fontSize:10 }} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend wrapperStyle={{ fontSize:11, color:"#8b949e" }} />
                    <Area type="monotone" dataKey="total" stroke="#30d158" fill="url(#gT)" strokeWidth={2} dot={{ r:3 }} name="Total Incidents" />
                    <Area type="monotone" dataKey="high" stroke="#ff6b35" fill="url(#gH)" strokeWidth={2} dot={{ r:3 }} name="High Severity" />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Severity Breakdown" dot="#ff2d55" style={{ flex:1, minWidth:240 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sevData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="name" tick={{ fill:"#484f58", fontSize:11 }} />
                    <YAxis tick={{ fill:"#484f58", fontSize:11 }} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[5,5,0,0]} fill="#ff6b35" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:2, minWidth:300 }}>
                <Panel title={`Global Incident Map — ${mapData.filter(i=>i.latitude&&i.longitude).length} geotagged`} dot="#0a84ff" style={{ padding:0, overflow:"hidden" }}>
                  <WorldMap incidents={mapData} height={340} />
                  <div style={{ padding:"14px 18px", borderTop:"1px solid #21262d" }}>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:1.5, color:"#6e7681", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:"#ffd60a" }} />Recent Alerts
                    </div>
                    <AlertsList alerts={alerts} />
                  </div>
                </Panel>
              </div>
              <div style={{ flex:1, minWidth:260 }}><TopThreats threats={threats} /></div>
            </div>
          </>
        )}

        {tab==="Intelligence" && (
          <>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:18 }}>
              <div style={{ flex:1, minWidth:300 }}><TopThreats threats={threats} /></div>
              <Panel title="Incident Categories" dot="#6366f1" style={{ flex:1, minWidth:300 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                    <XAxis type="number" tick={{ fill:"#484f58", fontSize:10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill:"#8b949e", fontSize:11 }} width={110} />
                    <Tooltip content={<DarkTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[0,5,5,0]} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
            <Panel title="Active Alerts" dot="#ffd60a"><AlertsList alerts={alerts} /></Panel>
          </>
        )}

        {tab==="Map" && (
          <>
            <Panel title={`Global Incident Map — ${mapData.filter(i=>i.latitude&&i.longitude).length} geotagged incidents`} dot="#0a84ff" style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
              <WorldMap incidents={mapData} height={560} />
            </Panel>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              <Panel title="Map Legend" dot="#6e7681" style={{ flex:1 }}>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
                  {Object.entries(SEV_COLOR).map(([k,v]) => (
                    <div key={k} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:12, height:12, borderRadius:"50%", background:v, display:"inline-block" }} />
                      <span style={{ color:"#8b949e", fontSize:12, textTransform:"capitalize" }}>{k}</span>
                    </div>
                  ))}
                  <span style={{ color:"#484f58", fontSize:11, marginLeft:"auto" }}>Circle size = risk score</span>
                </div>
              </Panel>
              <Panel title="Recent Alerts" dot="#ffd60a" style={{ flex:1 }}><AlertsList alerts={alerts} /></Panel>
            </div>
          </>
        )}

        {tab==="Explorer" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <SLabel>Live Incident Feed</SLabel>
              <span style={{ color:"#484f58", fontSize:12 }}>{incidents.length} incidents</span>
            </div>
            <IncidentFeed incidents={incidents} />
          </>
        )}

        {tab==="Operations" && (
          <>
            <SLabel>System Controls</SLabel>
            <OperationsPanel schedulerStatus={schedulerStatus} />
            <SLabel>Spike Detection</SLabel>
            <Panel title="" dot="">
              {spikes?.length ? spikes.map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:16, padding:"10px 14px", background:"#ff2d5510", border:"1px solid #ff2d5530", borderRadius:8, marginBottom:8 }}>
                  <span style={{ color:"#ff2d55", fontWeight:800, textTransform:"uppercase" }}>{s.incident_type?.replace(/_/g," ")}</span>
                  <span style={{ color:"#8b949e" }}>{s.previous_count} → {s.current_count} incidents</span>
                  <span style={{ color:"#ffd60a", marginLeft:"auto", fontWeight:700 }}>▲ +{Math.round(s.growth_rate*100)}%</span>
                </div>
              )) : <div style={{ color:"#484f58", fontSize:13 }}>No spikes detected in the last hour.</div>}
            </Panel>
            <SLabel>System Summary</SLabel>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
              <MetricCard icon="📊" label="Total Incidents" value={summary?.total_incidents??0} color="#6366f1" />
              <MetricCard icon="🔔" label="Total Alerts" value={summary?.total_alerts??0} color="#ffd60a" />
              <MetricCard icon="🎯" label="Avg Risk" value={summary?.average_risk_score ? Math.round(summary.average_risk_score*30):0} color="#30d158" />
              <MetricCard icon="📅" label="Last 24h" value={summary?.incidents_last_24h??0} color="#0a84ff" />
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
        *{box-sizing:border-box} body{margin:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.8}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0d1117}
        ::-webkit-scrollbar-thumb{background:#21262d;border-radius:3px}
        .leaflet-container{background:#010409!important}
        .leaflet-popup-content-wrapper{background:#0d1117!important;border:1px solid #21262d!important;color:#e6edf3!important;border-radius:8px!important;box-shadow:0 8px 32px rgba(0,0,0,0.5)!important}
        .leaflet-popup-tip{background:#0d1117!important}
        .leaflet-control-attribution{background:#0d111788!important;color:#484f58!important}
      `}</style>
    </div>
  );
}
