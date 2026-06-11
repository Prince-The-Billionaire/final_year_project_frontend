"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  Popup,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
  FaFilter,
  FaCalendarAlt,
  FaBrain,
  FaSync,
  FaVolumeUp,
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [predictedTotal, setPredictedTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [simulationPaths, setSimulationPaths] = useState<number[][][]>([]);

  // Monte Carlo Dot Loop State
  const [simStep, setSimStep] = useState<number>(0);

  // Parameter Tuning
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedAttackType, setSelectedAttackType] = useState<string>("All");
  const [minProb, setMinProb] = useState<number>(5);
  const [topN, setTopN] = useState<number>(15);

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

  // ANIMATION CONTROL LOOP: Increments steps to render running bad actor dots across line nodes
  useEffect(() => {
    if (simulationPaths.length === 0) {
      setSimStep(0);
      return;
    }
    const timer = setInterval(() => {
      setSimStep((prev) => {
        const totalPoints = simulationPaths[0]?.length || 1;
        if (prev >= totalPoints - 1) return 0; // Loop tracking cycle
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [simulationPaths]);

  // Read Aloud Feature
  const handleReadAloud = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const topStates = hotspots.slice(0, 3).map(h => h.state).join(", ");
    const text = `Threat simulation active. The AI predicts ${predictedTotal || 0} total attacks. Top critical hotspots identified are ${topStates}. Please review the Monte Carlo spread and charts on the dashboard for tactical mitigation.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

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
    <div ref={mapContainerRef} className="fixed inset-0 bg-black text-white overflow-hidden">
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

        {/* Render Hotspots */}
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
              <div className="p-2 text-black">
                <h3 className="text-xl font-bold">{spot.state}</h3>
                <p>Threat: <b>{spot.probability}%</b></p>
                <p>Code: {spot.attack_type}</p>
                <p>Weapon: {spot.weapon}</p>
                <p>Casualties: {spot.expected_casualties}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Render Monte Carlo Simulation Paths and Active Bad Actor Dots */}
        {simulationPaths.map((path, idx) => {
          const currentActorPoint = path[simStep] || path[path.length - 1];
          return (
            <div key={`sim-group-${idx}`}>
              {/* Underlying Track Guideline */}
              <Polyline 
                positions={path as any} 
                pathOptions={{ color: "rgba(255, 45, 85, 0.5)", weight: 1.5, dashArray: "5, 5" }} 
              />
              {/* Moving Bad Actor Dot */}
              {currentActorPoint && (
                <CircleMarker 
                  center={[currentActorPoint[0], currentActorPoint[1]]}
                  radius={5}
                  pathOptions={{
                    color: "#ff2d55",
                    fillColor: "#ffffff",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Tooltip>Actor Token {idx + 1}</Tooltip>
                </CircleMarker>
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Global Status Banner Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-[1000]">
        <div className="bg-black/75 backdrop-blur-2xl px-10 py-4 rounded-full border border-green-500/40 shadow-[0_0_40px_rgba(57,255,20,0.22)] text-lg font-medium">
          {hovered ? hovered : "Hover or click states for details"}
        </div>
        <button 
          onClick={handleReadAloud}
          className="bg-black/80 backdrop-blur-md p-4 rounded-full border border-green-500/50 hover:bg-green-900/50 transition shadow-[0_0_20px_rgba(57,255,20,0.2)] text-green-400"
          title="Read Dashboard Aloud"
        >
          <FaVolumeUp size={20} />
        </button>
      </div>

      {/* Left Panel - Control Matrix */}
      <div className="absolute top-5 left-5 z-[1000] w-80 space-y-5">
        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-6 rounded-3xl">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-3" style={{ color: NEON_GREEN }}>
            <FaFilter size={18} /> Threat Parameters
          </h2>
          <div className="space-y-6">
            <div>
              <label className="text-sm mb-2 flex items-center gap-2 text-gray-50">
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

            <div>
              <label className="text-sm mb-2 flex items-center gap-2 text-gray-50">
                Filter by Attack Code/Type
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
              <label className="block text-sm mb-2 text-gray-50">Minimum Probability {minProb}%</label>
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
              <label className="block text-sm mb-2 text-gray-50">Display Top N : Top {topN}</label>
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
                setSimulationPaths([]);
              }}
              className="w-full py-3 bg-black border-2 border-green-600/60 rounded-xl font-medium hover:bg-green-950/40 transition flex items-center justify-center gap-2 text-base"
              style={{ color: NEON_GREEN }}
            >
              <FaSync size={15} /> Reset Topology
            </button>
          </div>
        </div>

        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-5 rounded-3xl text-center">
          <p className="text-sm text-gray-50 mb-1">Predicted Attacks</p>
          <p className="text-4xl font-black tracking-tight" style={{ color: NEON_GREEN }}>
            {predictedTotal ?? "—"}
          </p>
        </div>
      </div>

      {/* Right Panel - Master Component Switcher */}
      <div className="absolute top-5 right-5 z-[1000] w-[400px] space-y-5">
        {/* REARRANGEMENT TRADEOFF: Risk Matrix has taken precedence at the top */}
        <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-6 rounded-3xl">
          <h4 className="font-bold mb-3 flex items-center gap-2 text-green-400 text-sm">Risk Classification Matrix</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-50">
            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff2d55]"></div> Critical (≥ 80%)</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ff9500]"></div> High (60–79%)</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#ffcc00]"></div> Elevated (40–59%)</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-[#39FF14]"></div> Monitored (≤ 39%)</div>
          </div>
        </div>

        <ChartSwitcher 
          casualtiesChart={casualtiesChart} 
          typeDistribution={typeDistribution} 
          NEON_GREEN={NEON_GREEN}
          hotspots={hotspots}
          setSimulationPaths={setSimulationPaths}
          mapRef={mapContainerRef}
        />
      </div>

      {/* Down-Migrated Tactical Observations - Now anchored safely in Bottom-Left layout */}
      {/* <div className="absolute bottom-6 left-5 bg-black/80 backdrop-blur-2xl p-5 rounded-3xl border border-green-500/40 shadow-2xl z-[1000] w-80">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-3" style={{ color: NEON_GREEN }}>
          <FaBrain size={15} /> Tactical Observations
        </h2>
        <div className="space-y-2 max-h-32 overflow-y-scroll text-[11px]">
          {insights.map((text, i) => (
            <div key={i} className="bg-black/45 p-2 rounded-xl border border-green-600/25 text-gray-200">
              {text}
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}