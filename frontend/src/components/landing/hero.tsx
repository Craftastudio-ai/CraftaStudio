"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { Play } from "lucide-react";
import VideoModal from "@/components/landing/video-modal";

// ─── Node / Edge geometry ─────────────────────────────────────────────────────

const NW = 152;
const NH = 70;
const VW = 656;
const VH = 320;

const CANVAS_NODES = [
  { id: "db",  x: 16,  y: 118, label: "PostgreSQL Schema", badge: "DB",  color: "#22c55e" },
  { id: "api", x: 228, y: 42,  label: "Auth & JWT API",    badge: "API", color: "#7c6fee" },
  { id: "svc", x: 228, y: 192, label: "User Service",      badge: "SVC", color: "#f59e0b" },
  { id: "ui",  x: 452, y: 78,  label: "Dashboard UI",      badge: "UI",  color: "#38bdf8" },
  { id: "job", x: 452, y: 200, label: "Email Job Queue",   badge: "JOB", color: "#f472b6" },
];

const CANVAS_EDGES = [
  { from: "db",  to: "api" },
  { from: "db",  to: "svc" },
  { from: "api", to: "ui"  },
  { from: "svc", to: "ui"  },
  { from: "svc", to: "job" },
];

function getNode(id: string) { return CANVAS_NODES.find(n => n.id === id)!; }
function srcPt(id: string) { const n = getNode(id); return { x: n.x + NW, y: n.y + NH / 2 }; }
function dstPt(id: string) { const n = getNode(id); return { x: n.x,      y: n.y + NH / 2 }; }

// ─── Canvas Mockup ────────────────────────────────────────────────────────────

function CanvasMockup() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="w-full rounded-xl border border-[#1e1e38] bg-[#08080f] overflow-hidden select-none">
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-[#1e1e38]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/60" />
        </div>
        <span className="text-[9px] font-mono text-[#3a3858]">craftastudio — canvas</span>
        <div className="w-14" />
      </div>

      {/* SVG canvas */}
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full block" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cvdots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.85" fill="rgba(124,111,238,0.2)" />
          </pattern>
          <marker id="arr-dim" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,1 L0,6 L6,3.5 z" fill="#252540" />
          </marker>
          <marker id="arr-lit" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,1 L0,6 L6,3.5 z" fill="#7c6fee" />
          </marker>
        </defs>
        <rect width={VW} height={VH} fill="#08080f" />
        <rect width={VW} height={VH} fill="url(#cvdots)" />

        {CANVAS_EDGES.map((e, i) => {
          const f  = srcPt(e.from);
          const t  = dstPt(e.to);
          const cp = 52;
          const active = hovered === e.from || hovered === e.to;
          return (
            <path
              key={i}
              d={`M${f.x},${f.y} C${f.x + cp},${f.y} ${t.x - cp},${t.y} ${t.x},${t.y}`}
              fill="none"
              stroke={active ? "#7c6fee" : "#1e1e38"}
              strokeWidth={active ? 1.5 : 1}
              strokeDasharray="5 3.5"
              markerEnd={active ? "url(#arr-lit)" : "url(#arr-dim)"}
              style={{ transition: "stroke 0.2s, stroke-width 0.15s" }}
            />
          );
        })}

        {CANVAS_NODES.map((n) => {
          const active = hovered === n.id;
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <rect x={n.x} y={n.y} width={NW} height={NH} rx={9}
                fill={active ? "#111120" : "#0d0d1a"}
                stroke={active ? `${n.color}55` : "#1e1e38"}
                strokeWidth={active ? 1.2 : 0.8}
                style={{ transition: "all 0.2s" }}
              />
              <line x1={n.x + 1} y1={n.y + 38} x2={n.x + NW - 1} y2={n.y + 38}
                stroke="#1e1e38" strokeWidth={0.8} />
              <rect x={n.x + 8} y={n.y + 10} width={32} height={14} rx={4}
                fill={`${n.color}1a`} stroke={`${n.color}40`} strokeWidth={0.7} />
              <text x={n.x + 24} y={n.y + 21} textAnchor="middle"
                fill={n.color} fontSize={7} fontWeight="700" fontFamily="monospace">
                {n.badge}
              </text>
              <circle cx={n.x + NW - 10} cy={n.y + 17} r={3}
                fill={active ? n.color : "#1e1e38"}
                style={{ transition: "fill 0.2s" }} />
              <text x={n.x + 8} y={n.y + 32}
                fill={active ? "#f0effe" : "#b8b4d4"} fontSize={9} fontWeight="600">
                {n.label}
              </text>
              <rect x={n.x + 8} y={n.y + 44} width={40} height={14} rx={3}
                fill={active ? `${n.color}15` : "#0a0a14"} />
              <text x={n.x + 28} y={n.y + 54} textAnchor="middle"
                fill={active ? n.color : "#2a2a48"} fontSize={7} fontFamily="monospace">
                {active ? "running" : "IDLE"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Status bar */}
      <div className="flex items-center px-4 h-7 border-t border-[#1e1e38]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[8px] font-mono text-[#9896b8]">5 blocks · 5 connections</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[8px] font-mono text-[#3a3858]">Anthropic · Claude Haiku</span>
          <span className="text-[8px] font-mono text-[#7c6fee]">READY</span>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export default function Hero() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#13131f] min-h-[90vh] flex items-center">
        {/* Animated grid */}
        <div className="hero-grid absolute inset-0 pointer-events-none" />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 py-20 w-full">
          <div className="grid lg:grid-cols-[4.5fr_6.5fr] gap-12 lg:gap-20 items-center">

            {/* ── Left: copy ── */}
            <div className="flex flex-col">

              {/* Badge */}
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center self-start gap-2 px-3 py-1.5 rounded-full border border-[#1e1e38] bg-[#0d0d1a] mb-8"
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute h-1.5 w-1.5 rounded-full bg-[#7c6fee] opacity-50" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#7c6fee]" />
                </span>
                <span className="text-[10px] font-mono text-[#7c6fee] tracking-[0.15em] uppercase">
                  Architecture-First AI · Beta
                </span>
              </m.div>

              {/* Headline */}
              <m.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="text-[56px] lg:text-[72px] font-black tracking-[-0.04em] leading-[1.05] mb-6"
              >
                <span className="text-[#eeeaf8]">Architecture</span>
                <br />
                <span className="text-[#7c6fee]">first.</span>
                <br />
                <span className="text-[#42406a]">Code second.</span>
              </m.h1>

              {/* Description */}
              <m.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="text-[16px] lg:text-[18px] text-[#7a7898] leading-[1.7] mb-20 max-w-[460px] font-light"
              >
                Describe your system. CraftaStudio plans the full architecture
                visually, then generates every file — block by block, with
                complete transparency.
              </m.p>

              {/* CTAs */}
              <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.38 }}
                className="flex flex-wrap items-center gap-5"
              >
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-waitlist-modal"))}
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#f0effe] hover:bg-white text-[#0a0a12] font-semibold text-[15px] transition-transform active:scale-95 shadow-[0_0_30px_-5px_rgba(240,239,254,0.3)]"
                >
                  Join the Waitlist
                </button>
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-[#1e1e38] hover:border-[#3a3858] hover:bg-[#111120] text-[#9896b8] hover:text-[#f0effe] font-medium text-[15px] transition-all active:scale-95"
                >
                  <Play size={14} className="text-[#7c6fee]" /> See how it works
                </button>
              </m.div>
            </div>

            {/* ── Right: canvas mockup ── */}
            <m.div
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-full drop-shadow-2xl"
            >
              <CanvasMockup />
            </m.div>
          </div>
        </div>
      </section>

      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
    </>
  );
}
