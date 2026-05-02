"use client";
import { useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";

export default function ChartSwitcher({
  casualtiesChart,
  typeDistribution,
  NEON_GREEN,
}: any) {
  const [activeChart, setActiveChart] = useState(0);

  const charts = [
    {
      title: "Projected Casualties",
      component: (
        <div className="h-44 text-white text-xs">
          <Bar
            className="text-white/70"
            color="green"
            data={casualtiesChart}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      ),
    },
    {
      title: "Attack Types Distribution",
      component: (
        <div className="h-36 text-white text-xs">
          <Doughnut
            color="green"
            data={typeDistribution}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      ),
    },
  ];

  const nextChart = () => {
    setActiveChart((prev) => (prev + 1) % charts.length);
  };

  return (
    <div className="bg-gray-950/65 backdrop-blur-2xl border border-green-500/35 p-6 rounded-3xl">
      
      {/* Title */}
      <h3
        className="text-xs font-semibold mb-4 flex items-center gap-2"
        style={{ color: NEON_GREEN }}
      >
        {charts[activeChart].title}
      </h3>

      {/* Chart */}
      {charts[activeChart].component}

      {/* Pagination Dots */}
      <div className="flex justify-center mt-4 gap-2">
        {charts.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-all ${
              activeChart === index
                ? "bg-green-400 scale-110"
                : "bg-gray-600"
            }`}
          />
        ))}
      </div>

      {/* Switch Button */}
      <button
        onClick={nextChart}
        className="mt-4 w-full py-2 text-xs font-semibold rounded-xl border border-green-500/40 hover:bg-green-500/10 transition"
        style={{ color: NEON_GREEN }}
      >
        Switch Chart
      </button>
    </div>
  );
}