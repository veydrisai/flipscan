"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ScanHistoryItem {
  id: string;
  name: string;
  score: number;
  profit: number;
  timestamp: number;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scoreDot(score: number) {
  if (score >= 70) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

export default function Home() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("flipscan_history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  return (
    <main className="flex flex-col min-h-dvh bg-black">
      {/* Status bar spacer */}
      <div className="pt-14" />

      {/* Wordmark */}
      <div className="px-6 mb-2">
        <h1 className="text-[28px] font-bold tracking-tight text-white">
          Flip<span className="text-emerald-400">Scan</span>
        </h1>
        <p className="text-zinc-500 text-[13px] mt-0.5">Thrift store profit finder</p>
      </div>

      {/* Hero area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center mb-10">
          <p className="text-zinc-300 text-[17px] leading-relaxed font-light">
            Point your camera at any thrift store item and instantly see what it&apos;s worth.
          </p>
        </div>

        {/* Scan button */}
        <Link
          href="/scan"
          className="w-full max-w-sm bg-emerald-400 text-black font-semibold text-[17px] py-4 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
        >
          Scan an item
        </Link>

        {/* Steps */}
        <div className="flex items-center gap-3 mt-8 text-zinc-600 text-xs">
          <span>Point camera</span>
          <span className="w-4 h-px bg-zinc-700" />
          <span>AI identifies</span>
          <span className="w-4 h-px bg-zinc-700" />
          <span>See profit</span>
        </div>
      </div>

      {/* Scan history */}
      {history.length > 0 && (
        <div className="pb-10">
          <div className="px-6 mb-3">
            <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-widest">
              Recent Scans
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-6 pb-1 no-scrollbar">
            {history.map((item) => (
              <div
                key={item.id}
                className="shrink-0 w-44 bg-zinc-900 rounded-2xl p-4 border border-white/5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${scoreDot(item.score)}`} />
                  <span className="text-white text-xs font-semibold">{item.score}</span>
                </div>
                <p className="text-white text-[13px] font-medium leading-tight line-clamp-2">
                  {item.name}
                </p>
                <p className="text-emerald-400 text-xs font-semibold mt-2">
                  {item.profit > 0 ? `+$${item.profit}` : `$${item.profit}`}
                </p>
                <p className="text-zinc-600 text-[11px] mt-1">{timeAgo(item.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
