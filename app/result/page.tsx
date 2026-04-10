"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  name: string;
  brand: string;
  model: string;
  category: string;
  condition: string;
  confidence: number;
  description: string;
}

interface PlatformData {
  avg_sold?: number;
  low?: number;
  high?: number;
  sold_30d?: number;
  avg_price?: number;
  fba_est?: number;
}

interface Prices {
  flip_score: number;
  verdict: "FLIP IT" | "PASS";
  max_pay_price: number;
  estimated_profit: number;
  fees_estimate: number;
  reasoning: string;
  platforms: {
    ebay: PlatformData;
    poshmark: PlatformData;
    mercari: PlatformData;
    stockx: PlatformData | null;
    amazon: PlatformData | null;
  };
}

const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const PLATFORM_LABELS: Record<string, string> = {
  ebay: "eBay",
  poshmark: "Poshmark",
  mercari: "Mercari",
  stockx: "StockX",
  amazon: "Amazon",
};

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreBorder(score: number) {
  if (score >= 70) return "border-emerald-400/20";
  if (score >= 50) return "border-amber-400/20";
  return "border-red-400/20";
}

function verdictBg(verdict: string) {
  if (verdict === "FLIP IT") return "bg-emerald-400/10 text-emerald-400";
  return "bg-red-400/10 text-red-400";
}

function useAnimatedScore(target: number | null) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const finalScore = target;
    const start = performance.now();
    const duration = 800;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * finalScore));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);

  return display;
}

function saveScanHistory(product: Product, prices: Prices) {
  try {
    const raw = localStorage.getItem("flipscan_history");
    const history = raw ? JSON.parse(raw) : [];
    const entry = {
      id: Date.now().toString(),
      name: product.name,
      score: prices.flip_score,
      profit: prices.estimated_profit,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      "flipscan_history",
      JSON.stringify([entry, ...history].slice(0, 20))
    );
  } catch {
    // ignore storage errors
  }
}

async function shareResult(product: Product, prices: Prices) {
  const text = `FlipScan: ${product.name}\nFlip Score: ${prices.flip_score}/100 — ${prices.verdict}\nEst. profit: $${prices.estimated_profit} after fees\nBest platform: eBay avg $${prices.platforms.ebay?.avg_sold ?? "—"}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "FlipScan Result", text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // user cancelled or clipboard failed
  }
}

function PlatformRow({ name, data }: { name: string; data: PlatformData | null }) {
  if (!data) return null;
  const price = data.avg_sold ?? data.avg_price ?? data.fba_est;
  if (!price) return null;

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div>
        <div className="text-white text-sm font-medium">{PLATFORM_LABELS[name] ?? name}</div>
        {data.low != null && data.high != null && (
          <div className="text-zinc-500 text-xs mt-0.5">${data.low} – ${data.high}</div>
        )}
        {data.sold_30d != null && (
          <div className="text-zinc-600 text-xs">{data.sold_30d} sold / 30d</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-white font-semibold text-sm">${price}</div>
        <div className="text-zinc-600 text-xs">avg sold</div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const historySaved = useRef(false);

  const animatedScore = useAnimatedScore(prices?.flip_score ?? null);

  useEffect(() => {
    const raw = sessionStorage.getItem("flipscan_product");
    if (!raw) {
      router.push("/");
      return;
    }

    let p: Product;
    try {
      p = JSON.parse(raw);
    } catch {
      router.push("/");
      return;
    }
    setProduct(p);

    fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Prices) => {
        setPrices(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load prices. Tap to retry.");
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (product && prices && !historySaved.current) {
      historySaved.current = true;
      saveScanHistory(product, prices);
    }
  }, [product, prices]);

  if (!product) return null;

  return (
    <div className="min-h-dvh bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <Link href="/scan" className="text-zinc-400 text-sm font-medium">
          ← Scan again
        </Link>
        <span className="text-white font-semibold text-sm tracking-tight">
          Flip<span className="text-emerald-400">Scan</span>
        </span>
        <button
          onClick={() => product && prices && shareResult(product, prices)}
          className="text-zinc-400 text-sm font-medium disabled:opacity-30"
          disabled={!prices}
          aria-label="Share"
        >
          Share
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-4">
        {/* Product card */}
        <div className="bg-zinc-900/60 rounded-2xl p-4 border border-white/5">
          <h2 className="text-white font-semibold text-[17px] leading-snug">{product.name}</h2>
          {product.brand && product.brand !== product.name && (
            <p className="text-zinc-400 text-sm mt-0.5">{product.brand}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="bg-zinc-800 text-zinc-300 text-[11px] px-2.5 py-0.5 rounded-full">
              {CONDITION_LABELS[product.condition] ?? product.condition}
            </span>
            <span className="bg-zinc-800 text-zinc-300 text-[11px] px-2.5 py-0.5 rounded-full capitalize">
              {product.category}
            </span>
            <span className="bg-zinc-800 text-zinc-500 text-[11px] px-2.5 py-0.5 rounded-full">
              {product.confidence}% confidence
            </span>
          </div>
          {product.description && (
            <p className="text-zinc-500 text-xs mt-3 leading-relaxed">{product.description}</p>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-white/10 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm">Checking resell prices...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => router.push("/scan")}
              className="mt-3 text-white text-sm font-medium underline"
            >
              Scan again
            </button>
          </div>
        )}

        {prices && (
          <>
            {/* Score */}
            <div className={`rounded-2xl border p-6 text-center ${scoreBorder(prices.flip_score)} bg-zinc-900/40`}>
              <div className={`text-[72px] font-bold tabular-nums leading-none ${scoreColor(prices.flip_score)}`}>
                {animatedScore}
              </div>
              <div className="text-zinc-500 text-xs mt-1 mb-3">out of 100</div>
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full tracking-widest ${verdictBg(prices.verdict)}`}>
                {prices.verdict}
              </span>
            </div>

            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                <div className="text-zinc-500 text-[11px] uppercase tracking-widest mb-1.5">Max Pay</div>
                <div className="text-white text-[28px] font-bold leading-none">${prices.max_pay_price}</div>
                <div className="text-zinc-600 text-xs mt-1">at thrift store</div>
              </div>
              <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                <div className="text-zinc-500 text-[11px] uppercase tracking-widest mb-1.5">Est. Profit</div>
                <div className={`text-[28px] font-bold leading-none ${prices.estimated_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {prices.estimated_profit >= 0 ? "+" : ""}${prices.estimated_profit}
                </div>
                <div className="text-zinc-600 text-xs mt-1">after fees</div>
              </div>
            </div>

            {/* Platform prices */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-2">
              <div className="text-zinc-400 text-[11px] uppercase tracking-widest py-3">Platforms</div>
              <PlatformRow name="ebay" data={prices.platforms.ebay} />
              <PlatformRow name="poshmark" data={prices.platforms.poshmark} />
              <PlatformRow name="mercari" data={prices.platforms.mercari} />
              <PlatformRow name="stockx" data={prices.platforms.stockx} />
              <PlatformRow name="amazon" data={prices.platforms.amazon} />
            </div>

            {/* Reasoning */}
            {prices.reasoning && (
              <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                <div className="text-zinc-400 text-[11px] uppercase tracking-widest mb-2.5">Analysis</div>
                <p className="text-zinc-300 text-sm leading-relaxed">{prices.reasoning}</p>
              </div>
            )}

            <Link
              href="/scan"
              className="flex items-center justify-center w-full bg-emerald-400 text-black font-semibold text-[15px] py-4 rounded-2xl active:scale-95 transition-transform"
            >
              Scan another item
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
