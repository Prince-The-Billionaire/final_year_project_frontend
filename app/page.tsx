"use client"
// app/page.tsx (example)
import dynamic from 'next/dynamic';

const NigeriaThreatMap = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  return (
    <div>
      <h1>Nigeria Threat Map</h1>
      <NigeriaThreatMap/>
    </div>
  );
}