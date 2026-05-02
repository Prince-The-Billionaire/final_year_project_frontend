"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";
import {
  FaExclamationTriangle,
  FaFilter,
  FaCalendarAlt,
  FaBrain,
  FaSync,
  FaNewspaper,
  FaCheckCircle,
} from "react-icons/fa";
import ChartSwitcher from "./SwitchChart";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend, ArcElement);

interface Hotspot {
  state: string;
  probability: number;
  attack_type: string;
  weapon: string;
  expected_casualties: number;
  latitude: number;
  longitude: number;
  expected_attacks: number;
}

const NEON_GREEN = "#39FF14";

const getColorByProbability = (prob: number): string => {
  if (prob >= 80) return "#ff2d55";
  if (prob >= 60) return "#ff9500";
  if (prob >= 40) return "#ffcc00";
  return NEON_GREEN;
};

const getFillOpacity = (prob: number) => Math.min(0.94, 0.48 + prob / 105);

export default function Map() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [predictedTotal, setPredictedTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);

  // Parameter Tuning
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedAttackType, setSelectedAttackType] = useState<string>("All");   // ← NEW
  const [minProb, setMinProb] = useState<number>(5);
  const [topN, setTopN] = useState<number>(15);

  // News Ingester
  const [newsUrl, setNewsUrl] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const futureQuarters = useMemo(() => {
    const opts: string[] = [""];
    for (let y = 2025; y <= 2028; y++) {
      for (let q = 1; q <= 4; q++) {
        opts.push(`${y}Q${q}`);
      }
    }
    return opts;
  }, []);

  // Attack Type options (matching your GTD mapping)
  const attackTypes = [
    "All",
    "Kidnapping",
    "Armed Assault",
    "Bombing/Explosion",
    "Assassination",
  ];

  useEffect(() => {
    fetch("/full.json")
      .then((res) => res.json())
      .then(setGeoJson)
      .catch(() => setError("GeoJSON failed"));

    const loadData = async () => {
      try {
        let url = "";
        if (selectedAttackType === "All") {
          url = `http://127.0.0.1:8001/hotspots/all?min_prob=${minProb}`;
          if (selectedQuarter) url += `&quarter=${selectedQuarter}`;
        } else {
          url = `http://127.0.0.1:8001/predict/by-attack-type?attack_type=${encodeURIComponent(selectedAttackType)}`;
          if (selectedQuarter) url += `&quarter=${selectedQuarter}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        const sorted = [...(data.states || data.hotspots || [])].sort((a, b) => b.probability - a.probability);
        setHotspots(sorted.slice(0, topN));
        setPredictedTotal(data.predicted_total ?? null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedQuarter, selectedAttackType, minProb, topN]);

  const handleIngest = async () => {
    if (!newsUrl) return;
    setIngestLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8001/ingest-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newsUrl }),
      });
      const result = await res.json();
      if (result.status === "success") {
        setToast({ message: `✅ Added: ${result.attack_type}`, type: "success" });
        window.location.reload();
      }
    } catch {
      setToast({ message: "Failed to add news", type: "error" });
    } finally {
      setIngestLoading(false);
      setNewsUrl("");
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Charts (kept exactly as before)
  const casualtiesChart = useMemo(() => ({
    labels: hotspots.map((h) => h.state),
    datasets: [{
      label: "Est. Casualties",
      data: hotspots.map((h) => h.expected_casualties),
      backgroundColor: "rgba(57, 255, 20, 0.25)",
      borderColor: NEON_GREEN,
      borderWidth: 2,
    }],
  }), [hotspots]);

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    hotspots.forEach((h) => {
      counts[h.attack_type] = (counts[h.attack_type] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ["#39FF14", "#ff2d55", "#ff9500", "#00f0ff", "#a855f7"],
        borderWidth: 1,
      }],
    };
  }, [hotspots]);

  const insights = [
    "Northern states continue to show elevated kidnapping & ambush patterns.",
    "Urban areas increasingly vulnerable to explosive & armed assault tactics.",
    "Highest casualty projections where multiple attack vectors overlap.",
    "Border zones require enhanced monitoring due to potential spillover.",
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-7xl mb-5 animate-pulse" style={{ color: NEON_GREEN }}>⟡</div>
          <p className="text-2xl font-semibold" style={{ color: NEON_GREEN }}>Loading Threat Surface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <MapContainer center={[9.082, 8.6753]} zoom={6} style={{ width: "100%", height: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

        {geoJson && (
          <GeoJSON
            data={geoJson}
            style={(feature) => {
              const name = feature?.properties?.name || feature?.properties?.NAME_1 || "";
              const match = hotspots.find((h) => h.state.toLowerCase() === name.toLowerCase());
              const p = match?.probability ?? 0;
              return {
                fillColor: getColorByProbability(p),
                weight: 1.5,
                color: NEON_GREEN,
                fillOpacity: getFillOpacity(p),
              };
            }}
          />
        )}

        {hotspots.map((spot) => (
          <CircleMarker
            key={spot.state}
            center={[spot.latitude, spot.longitude]}
            radius={Math.max(12, spot.probability / 4.2)}
            pathOptions={{
              color: getColorByProbability(spot.probability),
              fillColor: getColorByProbability(spot.probability),
              fillOpacity: 0.88,
              weight: 3,
            }}
          >
            <Tooltip>{spot.state} • {spot.probability}%</Tooltip>
            <Popup className="z-[100]">
              <div className="p-2">
                <h3 className="text-xl font-bold">{spot.state}</h3>
                <p>Threat: <b>{spot.probability}%</b></p>
                <p>Type: {spot.attack_type}</p>
                <p>Weapon: {spot.weapon}</p>
                <p>Casualties: {spot.expected_casualties}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* News Ingester */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-950/90 backdrop-blur-xl border border-green-500/50 p-4 rounded-2xl shadow-2xl z-[1000] flex gap-3 w-[420px]">
        <input
          type="text"
          value={newsUrl}
          onChange={(e) => setNewsUrl(e.target.value)}
          placeholder="Paste news URL here..."
          className="flex-1 bg-black border border-green-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
        />
        <button
          onClick={handleIngest}
          disabled={ingestLoading}
          className="bg-green-600 hover:bg-green-500 px-6 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {ingestLoading ? "Adding..." : <><FaNewspaper /> Add News</>}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl z-[2000] ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <FaCheckCircle className="text-2xl" />
          {toast.message}
        </div>
      )}

      {/* Left Panel - Controls (Quarter + NEW Attack Type Dropdown) */}
      <div className="absolute top-5 left-5 z-[1000] w-80 space-y-5">
        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-6 rounded-3xl">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-3" style={{ color: NEON_GREEN }}>
            <FaFilter size={18} /> Controls
          </h2>
          <div className="space-y-6">
            {/* Quarter Selector */}
            <div>
              <label className=" text-sm mb-2 flex items-center gap-2">
                <FaCalendarAlt size={15} /> Forecast Quarter
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full bg-black/55 border border-green-600/50 rounded-xl px-4 py-2.5 text-green-100 focus:outline-none focus:border-green-400"
              >
                <option value="">Next Quarter (default)</option>
                {futureQuarters.slice(1).map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            {/* NEW: Predict by Attack Type Dropdown */}
            <div>
              <label className=" text-sm mb-2 flex items-center gap-2">
                Predict by Attack Type
              </label>
              <select
                value={selectedAttackType}
                onChange={(e) => setSelectedAttackType(e.target.value)}
                className="w-full bg-black/55 border border-green-600/50 rounded-xl px-4 py-2.5 text-green-100 focus:outline-none focus:border-green-400"
              >
                {["All", "Kidnapping", "Armed Assault", "Bombing/Explosion", "Assassination", "Hostage Taking"].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">Minimum Probability {minProb}%</label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minProb}
                onChange={(e) => setMinProb(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              
            </div>

            <div>
              <label className="block text-sm mb-2">Display Top N : Top {topN}</label>
              <input
                type="range"
                min={5}
                max={36}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              
            </div>

            <button
              onClick={() => {
                setSelectedQuarter("");
                setSelectedAttackType("All");
                setMinProb(5);
                setTopN(15);
              }}
              className="w-full py-3 bg-black border-2 border-green-600/60 rounded-xl font-medium hover:bg-green-950/40 transition flex items-center justify-center gap-2 text-base"
              style={{ color: NEON_GREEN }}
            >
              <FaSync size={15} /> Reset
            </button>
          </div>
        </div>

        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-5 rounded-3xl text-center">
          <p className="text-sm opacity-80 mb-1">Predicted Attacks</p>
          <p className="text-4xl font-black tracking-tight" style={{ color: NEON_GREEN }}>
            {predictedTotal ?? "—"}
          </p>
        </div>
      </div>

      {/* Right Panel - AI Insights + Charts (unchanged) */}
      <div className="absolute top-5 right-5 z-[1000] w-96 space-y-5">
        {/* Your existing AI Observations + Charts stay exactly here */}
        {/* (I kept them identical to your previous version) */}
        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-6 rounded-3xl">
          <h2 className="text-xl font-bold mb-5 flex items-center gap-3" style={{ color: NEON_GREEN }}>
            <FaBrain size={18} /> AI Observations
          </h2>
          <div className="space-y-4 h-44 overflow-y-scroll text-sm">
            {insights.map((text, i) => (
              <div key={i} className="bg-black/45 p-4 rounded-2xl border border-green-600/25">
                {text}
              </div>
            ))}
          </div>
        </div>

        <ChartSwitcher casualtiesChart={casualtiesChart} typeDistribution={typeDistribution} NEON_GREEN={NEON_GREEN}/>
      </div>

      {/* Legend - Top Right */}
      <div className="absolute bottom-6 left-[25vw] bg-black/80 backdrop-blur-2xl p-5 rounded-3xl border border-green-500/40 shadow-2xl z-[1000] text-xs">
        <h4 className="font-bold mb-3 flex items-center gap-2 text-green-400">Risk Levels</h4>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff2d55]"></div> ≥ 80%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff9500]"></div> 60–79%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ffcc00]"></div> 40–59%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#39FF14]"></div> ≤ 39%</div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-2xl px-10 py-4 rounded-full border border-green-500/40 shadow-[0_0_40px_rgba(57,255,20,0.22)] text-lg font-medium z-[1000]">
        {hovered ? hovered : "Hover or click states for details"}
      </div>
    </div>
  );
}