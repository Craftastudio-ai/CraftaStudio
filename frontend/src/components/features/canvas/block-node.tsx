"use client";

import { Handle, Position } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, MessageSquare, ArrowUp, Info, ChevronRight, Code2, Play, Zap, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CanvasBlock, CanvasSubBlock } from "@/types/canvas";

interface BlockNodeProps {
  data: CanvasBlock & {
    onInfoClick?: (data: any) => void;
    onSubblockClick?: (sub: CanvasSubBlock) => void;
    onViewCode?: (data: CanvasBlock) => void;
    onGenerateCode?: (data: CanvasBlock) => void;
    runId?: string | null;
    blockIndex?: number;
  };
  selected?: boolean;
}

// Design-spec type → strip color mapping
const BLOCK_TYPE_STRIP: Record<string, { color: string; label: string }> = {
  ui:          { color: "#9d8ff5", label: "UI" },
  frontend:    { color: "#9d8ff5", label: "FRONTEND" },
  api:         { color: "#3b82f6", label: "API" },
  backend:     { color: "#3b82f6", label: "BACKEND" },
  server:      { color: "#3b82f6", label: "SERVER" },
  data:        { color: "#22c55e", label: "DATA" },
  database:    { color: "#22c55e", label: "DATABASE" },
  db:          { color: "#22c55e", label: "DB" },
  auth:        { color: "#f59e0b", label: "AUTH" },
  service:     { color: "#14b8a6", label: "SERVICE" },
  integration: { color: "#14b8a6", label: "INTEGRATION" },
  job:         { color: "#6366f1", label: "JOB" },
  worker:      { color: "#6366f1", label: "WORKER" },
};

const STATUS_CONFIG = {
  idle:             { color: "#5c5a7a", glow: "rgba(92,90,122,0.4)",   pulse: false, label: "IDLE"      },
  running:          { color: "#22c55e", glow: "rgba(34,197,94,0.5)",   pulse: true,  label: "RUNNING"   },
  awaiting_confirm: { color: "#7c6fee", glow: "rgba(124,111,238,0.6)", pulse: true,  label: "REVIEW"    },
  approved:         { color: "#3b82f6", glow: "rgba(59,130,246,0.5)",  pulse: true,  label: "APPROVED"  },
  pending_approval: { color: "#9d8ff5", glow: "rgba(157,143,245,0.4)", pulse: false, label: "QUEUED"    },
  done:             { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   pulse: false, label: "DONE"      },
  success:          { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   pulse: false, label: "DONE"      },
  error:            { color: "#ef4444", glow: "rgba(239,68,68,0.6)",   pulse: true,  label: "ERROR"     },
  failed:           { color: "#ef4444", glow: "rgba(239,68,68,0.6)",   pulse: false, label: "FAILED"    },
  pending:          { color: "#5c5a7a", glow: "rgba(92,90,122,0.3)",   pulse: false, label: "QUEUED"    },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;
  return (
    <div className="relative flex items-center justify-center size-4">
      {cfg.pulse && (
        <motion.div
          className="absolute rounded-full"
          style={{ backgroundColor: cfg.color, width: 14, height: 14 }}
          animate={{ scale: [1, 2.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div
        className="relative size-2 rounded-full"
        style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest font-mono"
      style={{
        color: cfg.color,
        backgroundColor: `${cfg.color}18`,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      {cfg.label}
    </span>
  );
}

export function BlockNode({ data, selected }: BlockNodeProps) {
  const [input, setInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const status = data.status ?? "idle";
  const statusCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;

  // Block type strip color — prefer data.type, fallback to "service"
  const typeKey = (data.type ?? "service").toLowerCase();
  const typeStrip = BLOCK_TYPE_STRIP[typeKey] ?? { color: "#14b8a6", label: typeKey.toUpperCase() };

  const handleSend = () => {
    if (!input.trim()) return;
    setInput("");
  };

  const isGenerating = status === "running";
  const isAwaiting = status === "awaiting_confirm";

  return (
    <motion.div
      className="relative"
      style={{ width: 240 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Invisible Handles */}
      <Handle type="target" position={Position.Left}   id="left-in"   className="!opacity-0 !w-0 !h-0 !border-none" />
      <Handle type="target" position={Position.Top}    id="top-in"    className="!opacity-0 !w-0 !h-0 !border-none" />
      <Handle type="target" position={Position.Right}  id="right-in"  className="!opacity-0 !w-0 !h-0 !border-none" />
      <Handle type="target" position={Position.Bottom} id="bottom-in" className="!opacity-0 !w-0 !h-0 !border-none" />

      {/* Outer glow when selected or active */}
      {(selected || isGenerating || isAwaiting) && (
        <div
          className="absolute -inset-[3px] rounded-[18px] pointer-events-none"
          style={{
            boxShadow: selected
              ? `0 0 0 2px ${typeStrip.color}, 0 0 20px ${typeStrip.color}40`
              : isAwaiting
                ? `0 0 0 2px #7c6fee, 0 0 24px #7c6fee50`
                : `0 0 0 1px ${statusCfg.color}60, 0 0 16px ${statusCfg.color}30`,
          }}
        />
      )}

      {/* Hover Toolbar */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute -top-11 left-0 flex items-center gap-1 z-20"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl bg-white dark:bg-[#111120] border border-zinc-200 dark:border-[#1e1e38] shadow-xl backdrop-blur-md">
              {[
                { Icon: RefreshCw,    title: "Regenerate",  onClick: () => {}, show: true },
                { Icon: MessageSquare,title: "Chat",        onClick: () => setIsChatOpen(!isChatOpen), active: isChatOpen, show: true },
                { Icon: Info,         title: "Inspector",   onClick: () => data.onInfoClick?.(data), show: true },
                { Icon: Code2,        title: "View Code",   onClick: () => data.onViewCode?.(data), show: status === "done" || status === "awaiting_confirm" },
              ].filter(t => t.show).map(({ Icon, title, onClick, active }) => (
                <button
                  key={title}
                  title={title}
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-150",
                    active
                      ? "bg-[#7c6fee] text-white shadow-[0_0_10px_rgba(124,111,238,0.4)]"
                      : "text-zinc-500 dark:text-zinc-600 dark:text-[#9896b8] hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-[#f0effe] hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:hover:bg-[#16162a]"
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "relative rounded-[14px] overflow-hidden transition-all duration-200 bg-white dark:bg-[#111120]",
          "border",
          selected ? "border-[#7c6fee]/60" : isHovered ? "border-zinc-300 dark:border-[#2a2a48]" : "border-zinc-200 dark:border-[#1e1e38]"
        )}
        style={{
          backgroundImage: `linear-gradient(180deg, ${typeStrip.color}15 0%, transparent 40px)`,
          boxShadow: isHovered
            ? "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)"
            : "0 2px 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* Top color strip — type indicator */}
        <div
          className="h-[3px] w-full"
          style={{ background: `linear-gradient(90deg, ${typeStrip.color}cc, ${typeStrip.color}40, transparent)` }}
        />

        {/* Generating shimmer overlay */}
        {isGenerating && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[14px]"
            style={{
              background: `linear-gradient(105deg, transparent 40%, ${statusCfg.color}08 50%, transparent 60%)`,
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Header */}
        <div className="px-3 pt-3 pb-2.5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              {/* Serial number badge */}
              {typeof data.blockIndex === "number" && (
                <span
                  className="inline-flex items-center justify-center size-4 rounded text-[8px] font-bold font-mono shrink-0"
                  style={{ backgroundColor: `${typeStrip.color}22`, color: typeStrip.color, border: `1px solid ${typeStrip.color}44` }}
                >
                  {data.blockIndex + 1}
                </span>
              )}
              {/* Type label */}
              <span
                className="text-[8px] font-mono font-bold tracking-[0.2em] uppercase"
                style={{ color: typeStrip.color }}
              >
                {typeStrip.label}
              </span>
            </div>
            <StatusDot status={status} />
          </div>

          {/* Block title */}
          <h3 className="font-semibold text-[13px] text-zinc-900 dark:text-[#f0effe] tracking-tight leading-snug mb-0.5 truncate">
            {data.title ?? "Unnamed Block"}
          </h3>

          {/* Stack pill */}
          {data.stack && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-zinc-600 dark:text-[#9896b8] truncate">{data.stack}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {data.description && !isChatOpen && (
          <div className="px-3 pb-2.5">
            <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-[#5c5a7a] line-clamp-2">
              {data.description}
            </p>
          </div>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="mx-3 mb-2.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
            <div className="size-2.5 rounded-full border-[1.5px] border-[#22c55e]/30 border-t-[#22c55e] animate-spin" />
            Generating code...
          </div>
        )}

        {/* Done indicator */}
        {status === "done" && (
          <div className="mx-3 mb-2.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[#22c55e]/8 text-[#22c55e] border border-[#22c55e]/20">
            <CheckCircle2 className="size-3 shrink-0" />
            Code generated — click to view
          </div>
        )}

        {/* Awaiting confirm indicator */}
        {isAwaiting && (
          <div className="mx-3 mb-2.5 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[#7c6fee]/10 text-[#9d8ff5] border border-[#7c6fee]/20">
            <Zap className="size-3 fill-[#9d8ff5]" />
            Ready to review
          </div>
        )}

        {/* Sub-blocks */}
        <AnimatePresence>
          {!isChatOpen && data.subBlocks && data.subBlocks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2 pb-2 space-y-0.5"
            >
              <div className="h-px bg-zinc-200 dark:bg-[#1e1e38] mx-1 mb-1" />
              {data.subBlocks.slice(0, 4).map((sub, i) => {
                const subCfg = STATUS_CONFIG[(sub.status ?? "idle") as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;
                return (
                  <motion.button
                    key={sub.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={(e) => { e.stopPropagation(); data.onSubblockClick?.(sub); }}
                    className="w-full group/sub flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all duration-150 hover:bg-zinc-100 dark:hover:bg-[#16162a]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: subCfg.color, boxShadow: `0 0 4px ${subCfg.glow}` }}
                      />
                      <span className="text-[10px] font-medium text-zinc-600 dark:text-[#5c5a7a] group-hover/sub:text-zinc-900 dark:group-hover/sub:text-[#9896b8] transition-colors truncate">
                        {sub.title ?? sub.type}
                      </span>
                    </div>
                    <ChevronRight className="size-3 text-transparent group-hover/sub:text-zinc-500 dark:group-hover/sub:text-[#5c5a7a] transition-all duration-150" />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer: status badge + action button */}
        <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2">
          <StatusBadge status={status} />
          {status === "done" && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onViewCode?.(data); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 hover:bg-[#22c55e]/20 transition-all"
            >
              <Code2 className="size-2.5" />
              View
            </button>
          )}
          {(status === "idle" || status === "error" || status === "failed") && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onGenerateCode?.(data); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#7c6fee] bg-[#7c6fee]/10 border border-[#7c6fee]/20 hover:bg-[#7c6fee]/20 transition-all"
            >
              <Play className="size-2.5" />
              Generate
            </button>
          )}
        </div>

        {/* Chat Input */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-slate-200 dark:border-[#1e1e38]">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#0d0d1a] border border-zinc-200 dark:border-[#1e1e38] focus-within:border-[#7c6fee]/40 transition-all duration-200 mt-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ask about this module..."
                    className="bg-transparent text-[11px] w-full focus:outline-none text-zinc-900 dark:text-[#f0effe] placeholder:text-zinc-400 dark:placeholder:text-[#3a3858]"
                    value={input}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") handleSend(); }}
                  />
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); handleSend(); }}
                    animate={{ scale: input.trim() ? 1 : 0.85, opacity: input.trim() ? 1 : 0.3 }}
                    className="p-1 rounded-lg shrink-0 bg-[#7c6fee] text-white shadow-[0_0_8px_rgba(124,111,238,0.3)]"
                  >
                    <ArrowUp className="size-3" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Source Handles */}
      <Handle type="source" position={Position.Left}   id="left-out"   className="!opacity-0 !w-0 !h-0 !border-none" />
      <Handle type="source" position={Position.Right}  id="right-out"  className="!opacity-0 !w-0 !h-0 !border-none" />
      <Handle type="source" position={Position.Bottom} id="bottom-out" className="!opacity-0 !w-0 !h-0 !border-none" />
    </motion.div>
  );
}
