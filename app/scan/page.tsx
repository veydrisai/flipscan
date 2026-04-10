"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "init" | "ready" | "capturing" | "identifying" | "error";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("init");
  const [errorMsg, setErrorMsg] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualError, setManualError] = useState("");
  const [searching, setSearching] = useState(false);
  // Increment to re-trigger the camera useEffect on retry
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    // iOS Safari only exposes mediaDevices over HTTPS or localhost
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMsg("Camera requires HTTPS. Use manual search to look up any item.");
      setShowManual(true);
      return;
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
        setErrorMsg("Camera access denied. Allow permissions and try again, or use manual search.");
      }
    }

    start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [retryKey]);

  async function capture() {
    const video = videoRef.current;
    if (!video || status !== "ready") return;

    setStatus("capturing");

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("identifying");

    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        setStatus("error");
        setErrorMsg("Identification failed. Try again or use manual search.");
        return;
      }

      const data = await res.json();

      if (!data.identified) {
        setStatus("error");
        setErrorMsg("Couldn't identify this item. Try better lighting or use manual search.");
        return;
      }

      sessionStorage.setItem("flipscan_product", JSON.stringify(data));
      router.push("/result");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  async function searchManual() {
    if (!manualText.trim()) return;
    setManualError("");
    setSearching(true);

    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualText.trim() }),
      });

      if (!res.ok) {
        setManualError("Search failed. Please try again.");
        setSearching(false);
        return;
      }

      const data = await res.json();

      if (!data.identified) {
        setManualError("Couldn't identify that item. Try being more specific.");
        setSearching(false);
        return;
      }

      sessionStorage.setItem("flipscan_product", JSON.stringify(data));
      router.push("/result");
    } catch {
      setManualError("Something went wrong. Please try again.");
      setSearching(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Full-screen video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark vignette top */}
      <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

      {/* Dark vignette bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-12">
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            router.push("/");
          }}
          className="text-white/80 text-sm font-medium tracking-wide"
        >
          Cancel
        </button>
        <span className="text-white font-semibold text-sm tracking-tight">
          Flip<span className="text-emerald-400">Scan</span>
        </span>
        <div className="w-14" />
      </div>

      {/* Thin reticle */}
      {status === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 rounded-2xl border border-white/40" />
        </div>
      )}

      {/* Init spinner */}
      {status === "init" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Identifying overlay */}
      {(status === "capturing" || status === "identifying") && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium text-base">
              {status === "capturing" ? "Capturing..." : "Identifying item..."}
            </p>
            <p className="text-white/40 text-sm mt-1">Gemini Vision</p>
          </div>
        </div>
      )}

      {/* Error overlay — only when manual panel is not open */}
      {status === "error" && !showManual && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <p className="text-white/90 text-base leading-relaxed">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStatus("init");
                setErrorMsg("");
                setRetryKey((k) => k + 1);
              }}
              className="bg-white/10 text-white text-sm font-medium px-6 py-3 rounded-full border border-white/20"
            >
              Retry camera
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="bg-white text-black text-sm font-semibold px-6 py-3 rounded-full"
            >
              Search manually
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {status === "ready" && !showManual && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-14 gap-5">
          <p className="text-white/50 text-xs tracking-wide">Point at an item</p>
          <button
            onClick={capture}
            className="w-[72px] h-[72px] rounded-full bg-white/90 border-[3px] border-white/30 flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
            aria-label="Capture"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
          <button
            onClick={() => setShowManual(true)}
            className="text-white/50 text-sm"
          >
            Search manually
          </button>
        </div>
      )}

      {/* Manual search slide-up panel */}
      {showManual && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-zinc-900 rounded-t-3xl px-6 pt-5 pb-12">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
          <p className="text-white font-semibold text-base mb-4">What is this item?</p>
          <input
            autoFocus
            type="text"
            value={manualText}
            onChange={(e) => { setManualText(e.target.value); setManualError(""); }}
            onKeyDown={(e) => e.key === "Enter" && searchManual()}
            placeholder="e.g. Nike Air Max 90 size 10"
            className="w-full bg-zinc-800 text-white placeholder-zinc-500 text-sm rounded-xl px-4 py-3.5 outline-none border border-white/10 focus:border-emerald-400/50"
          />
          {manualError && (
            <p className="text-red-400 text-xs mt-2">{manualError}</p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setShowManual(false); setManualError(""); }}
              className="flex-1 text-white/60 text-sm font-medium py-3 rounded-xl border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={searchManual}
              disabled={searching || !manualText.trim()}
              className="flex-1 bg-emerald-400 text-black text-sm font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
