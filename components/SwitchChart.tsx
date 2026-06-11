"use client";
import { useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { FaBrain, FaChartPie, FaCrosshairs, FaDatabase, FaCamera } from "react-icons/fa";
import html2canvas from "html2canvas-pro"; // Upgraded to support Tailwind v4 oklab/oklch colors

export default function ChartSwitcher({
  casualtiesChart,
  typeDistribution,
  NEON_GREEN,
  hotspots,
  setSimulationPaths,
  mapRef,
}: any) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Pipeline States
  const [newsUrl, setNewsUrl] = useState("");
  const [tweetText, setTweetText] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Monte Carlo States
  const [mcState, setMcState] = useState("");
  const [mcLoading, setMcLoading] = useState(false);

  // AI Vision States
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleIngestNews = async () => {
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
        setToast({ message: `✅ Added: Code [${result.attack_code}] ${result.attack_type}`, type: "success" });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setToast({ message: "Failed to add news", type: "error" });
    } finally {
      setIngestLoading(false);
      setNewsUrl("");
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleIngestTwitter = async () => {
    if (!tweetText) return;
    setIngestLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8001/ingest-twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweet_text: tweetText }),
      });
      const result = await res.json();
      if (result.status === "success") {
        setToast({ message: `✅ Tweet Added: Code [${result.attack_code}] ${result.attack_type}`, type: "success" });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setToast({ message: "Failed to add tweet", type: "error" });
    } finally {
      setIngestLoading(false);
      setTweetText("");
      setTimeout(() => setToast(null), 4000);
    }
  };

  const runMonteCarlo = async () => {
    if (!mcState) return;
    setMcLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8001/simulate/monte-carlo?state=${encodeURIComponent(mcState)}`);
      const data = await res.json();
      if (data.status === "success" && setSimulationPaths) {
        setSimulationPaths(data.paths);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMcLoading(false);
    }
  };

  const captureAIOverview = async () => {
    if (!mapRef?.current) {
      setAiAnalysis("Map reference not found. Cannot capture screenshot.");
      return;
    }
    setAiLoading(true);
    try {
      // html2canvas-pro handles the oklab parsing without throwing errors
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#030712"
      });
      const base64 = canvas.toDataURL("image/jpeg").split(",")[1];
      
      const res = await fetch("http://127.0.0.1:8001/ai-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setAiAnalysis(data.analysis);
      }
    } catch (err) {
      setAiAnalysis("Vision capture failed. Ensure backend API key is set.");
    } finally {
      setAiLoading(false);
    }
  };

  // Safe fallback for charts in case they haven't loaded yet
  const safeCasualtiesChart = casualtiesChart || { labels: [], datasets: [] };
  const safeTypeDistribution = typeDistribution || { labels: [], datasets: [] };

  const tabs = [
    {
      title: "Data Pipelines",
      icon: <FaDatabase />,
      component: (
        <div className="space-y-4">
          <div className="bg-black/45 p-3 rounded-xl border border-green-600/25">
            <label className="text-xs text-gray-50 mb-1 block">News URL Pipeline (Maps to Attack Code)</label>
            <input
              type="text"
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
              placeholder="Paste news URL..."
              className="w-full bg-black border border-green-600/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-green-400 mb-2"
            />
            <button onClick={handleIngestNews} disabled={ingestLoading} className="w-full bg-green-900/50 hover:bg-green-600/50 border border-green-600 rounded-lg py-2 text-xs font-medium text-white transition">
              {ingestLoading ? "Processing..." : "Ingest News"}
            </button>
          </div>
          <div className="bg-black/45 p-3 rounded-xl border border-green-600/25">
            <label className="text-xs text-gray-50 mb-1 block">Twitter Data Pipeline</label>
            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              placeholder="Paste raw tweet text..."
              className="w-full bg-black border border-green-600/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-green-400 mb-2 h-16 resize-none"
            />
            <button onClick={handleIngestTwitter} disabled={ingestLoading} className="w-full bg-green-900/50 hover:bg-green-600/50 border border-green-600 rounded-lg py-2 text-xs font-medium text-white transition">
              {ingestLoading ? "Processing..." : "Ingest Tweet"}
            </button>
          </div>
        </div>
      ),
    },
    {
      title: "Threat Charts",
      icon: <FaChartPie />,
      component: (
        <div className="space-y-6">
          <div className="h-32 text-white text-xs">
            <p className="text-gray-50 mb-2 text-[10px]">Projected Casualties per Hotspot</p>
            <Bar 
              data={safeCasualtiesChart} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: "#ffffff" // Makes the chart legend labels white
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      color: "#ffffff" // Makes labels/titles underneath each bar white
                    },
                    grid: {
                      color: "rgba(255, 255, 255, 0.1)"
                    }
                  },
                  y: {
                    ticks: {
                      color: "#ffffff" // Makes Y-axis ticks white
                    },
                    grid: {
                      color: "rgba(255, 255, 255, 0.1)"
                    }
                  }
                }
              }} 
            />
          </div>
          <div className="h-32 text-white text-xs">
             <p className="text-gray-50 mb-2 text-[10px]">Distribution by Attack Code / Type</p>
            <Doughnut 
              data={safeTypeDistribution} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: "#ffffff" // Makes doughnut chart labels white
                    }
                  }
                }
              }} 
            />
          </div>
        </div>
      ),
    },
    {
      title: "Monte Carlo Simulator",
      icon: <FaCrosshairs />,
      component: (
        <div className="space-y-4">
          <p className="text-xs text-gray-50">Simulate stochastic actor dispersion from predictive hotspots to identify potential spillover zones.</p>
          <select
             value={mcState}
             onChange={(e) => setMcState(e.target.value)}
             className="w-full bg-black border border-green-600/50 rounded-xl px-4 py-2.5 text-green-100 focus:outline-none focus:border-green-400 text-xs"
          >
             <option value="">Select Origin Hotspot...</option>
             {(hotspots || []).map((h: any) => (
                <option key={h.state} value={h.state}>{h.state} (Prob: {h.probability}%)</option>
             ))}
          </select>
          <button
            onClick={runMonteCarlo}
            disabled={mcLoading || !mcState}
            className="w-full py-2 text-xs font-semibold rounded-xl border border-red-500 hover:bg-red-500/20 text-red-400 transition disabled:opacity-50"
          >
            {mcLoading ? "Calculating Paths..." : "Execute Simulation"}
          </button>
          <button
             onClick={() => { if(setSimulationPaths) setSimulationPaths([]) }}
             className="w-full py-2 text-xs font-semibold rounded-xl border border-gray-500 hover:bg-gray-500/20 text-gray-400 transition"
          >
             Clear Paths
          </button>
        </div>
      ),
    },
    {
      title: "AI Overview",
      icon: <FaBrain />,
      component: (
        <div className="space-y-4">
          <p className="text-xs text-gray-50 mb-2">Generate a live tactical summary by having LLM Vision analyze the current dashboard state.</p>
          <button
            onClick={captureAIOverview}
            disabled={aiLoading}
            className="w-full py-2 text-xs font-semibold rounded-xl border border-purple-500 hover:bg-purple-500/20 text-purple-400 transition flex items-center justify-center gap-2"
          >
            <FaCamera /> {aiLoading ? "Capturing & Analyzing..." : "Run AI Vision Scan"}
          </button>
          {aiAnalysis && (
            <div className="bg-black/60 border border-purple-500/40 p-3 rounded-lg text-[11px] text-gray-50 leading-relaxed max-h-40 overflow-y-auto">
              {aiAnalysis}
            </div>
          )}
        </div>
      ),
    }
  ];

  const nextTab = () => {
    setActiveTab((prev) => (prev + 1) % tabs.length);
  };

  return (
    <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-5 rounded-3xl w-full">
      {/* Toast Notification for pipelines */}
      {toast && (
        <div className={`absolute -left-48 top-10 px-4 py-2 rounded-xl flex items-center gap-2 shadow-2xl z-[2000] text-xs font-bold text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-green-500/20 pb-2">
         <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: NEON_GREEN }}>
           {tabs[activeTab].icon} {tabs[activeTab].title}
         </h3>
      </div>

      {/* Active Component */}
      <div className="min-h-[220px]">
         {tabs[activeTab].component}
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center mt-5 gap-2">
        {tabs.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-all ${
              activeTab === index ? "bg-green-400 scale-125" : "bg-white cursor-pointer"
            }`}
            onClick={() => setActiveTab(index)}
          />
        ))}
      </div>

      {/* Switch Button */}
      <button
        onClick={nextTab}
        className="mt-4 w-full py-2 text-xs font-semibold rounded-xl border border-green-500/40 hover:bg-green-500/10 transition"
        style={{ color: NEON_GREEN }}
      >
        Next Module
      </button>
    </div>
  );
}