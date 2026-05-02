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
import { FaExclamationTriangle, FaFilter, FaCalendarAlt, FaBrain, FaSync, FaNewspaper, FaCheckCircle } from "react-icons/fa";

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

export default function OldMap() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [predictedTotal, setPredictedTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);

  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [minProb, setMinProb] = useState<number>(5);
  const [topN, setTopN] = useState<number>(15);

  // News ingestion
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

  useEffect(() => {
    fetch("/full.json")
      .then((res) => res.json())
      .then(setGeoJson)
      .catch(() => setError("GeoJSON failed"));

    const loadData = async () => {
      try {
        let url = `http://127.0.0.1:8001/hotspots/all?min_prob=${minProb}`;
        if (selectedQuarter) url += `&quarter=${selectedQuarter}`;
        const res = await fetch(url);
        const data = await res.json();
        const sorted = [...(data.states || [])].sort((a, b) => b.probability - a.probability);
        setHotspots(sorted.slice(0, topN));
        setPredictedTotal(data.predicted_total ?? null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedQuarter, minProb, topN]);

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
            <Popup>
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

      {/* News Input */}
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

      {/* Legend - Top Right (no overlap) */}
      <div className="absolute top-6 right-6 bg-black/80 backdrop-blur-2xl p-5 rounded-3xl border border-green-500/40 shadow-2xl z-[1000] text-sm">
        <h4 className="font-bold mb-3 flex items-center gap-2 text-green-400">Risk Levels</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff2d55]"></div> ≥ 80%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff9500]"></div> 60–79%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ffcc00]"></div> 40–59%</div>
          <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#39FF14]"></div> ≤ 39%</div>
        </div>
      </div>
    </div>
  );
}