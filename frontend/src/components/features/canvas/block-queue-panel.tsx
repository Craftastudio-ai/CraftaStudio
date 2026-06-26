"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Zap, CheckCircle2, Circle, Loader2, AlertCircle,
  ChevronRight, Play, SkipForward, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QueueBlock {
  id: string;
  title: string;
  type: string;
  status: "pending" | "approved" | "running" | "done" | "failed" | "skipped";
  outputCode?: string;
  tokensUsed?: number;
  errorMsg?: string;
}

interface BlockQueuePanelProps {
  projectId: string;
  runId: string | null;
  blocks: QueueBlock[];
  onApprove: (blockId: string) => void;
  onSkip?: (blockId: string) => void;
  onClose?: () => void;
  isOpen: boolean;
}

// ─── Status icon ───────────────────────────────────────────────────────────────

function BlockStatusIcon({ status }: { status: QueueBlock["status"] }) {
  switch (status) {
    case "done":     return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
    case "running":  return <Loader2 size={14} className="text-[#7c6fee] animate-spin shrink-0" />;
    case "failed":   return <AlertCircle size={14} className="text-red-400 shrink-0" />;
    case "skipped":  return <SkipForward size={14} className="text-[#3a3858] shrink-0" />;
    case "approved": return <ChevronRight size={14} className="text-amber-400 shrink-0" />;
    default:         return <Circle size={14} className="text-[#3a3858] shrink-0" />;
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function BlockQueuePanel({
  projectId, runId, blocks, onApprove, onSkip, onClose, isOpen,
}: BlockQueuePanelProps) {
  if (!isOpen) return null;

  const doneCount = blocks.filter(b => b.status === "done").length;
  const totalCount = blocks.length;
  const currentBlock = blocks.find(b => b.status === "running");
  const nextPending = blocks.find(b => b.status === "pending");
  const allDone = blocks.every(b => b.status === "done" || b.status === "skipped" || b.status === "failed");

  return (
    <div className="absolute right-4 top-14 w-[320px] z-50 bg-[#0d0d1a] border border-[#1e1e38] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-in slide-in-from-right-2 duration-200">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e38]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-[#7c6fee]" />
          <span className="text-[12px] font-semibold text-[#f0effe]">Block Queue</span>
          <span className="text-[10px] text-[#5c5a7a] bg-[#16162a] border border-[#1e1e38] px-1.5 py-0.5 rounded font-mono">
            {doneCount}/{totalCount}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#3a3858] hover:text-[#9896b8] transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-[#1e1e38]">
        <div
          className="h-full bg-gradient-to-r from-[#7c6fee] to-[#9d8ff5] transition-all duration-700"
          style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Block list */}
      <div className="max-h-[380px] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-[#1e1e38]">
        {blocks.map((block, idx) => {
          const isCurrent = block.status === "running";
          const isNextUp = !currentBlock && block.status === "pending" && idx === blocks.findIndex(b => b.status === "pending");

          return (
            <div
              key={block.id}
              className={cn(
                "flex items-start gap-3 px-4 py-2.5 border-b border-[#1e1e38]/40 transition-colors",
                isCurrent && "bg-[#7c6fee]/8",
                isNextUp && "bg-[#1e1e38]/40",
              )}
            >
              <div className="mt-0.5">
                <BlockStatusIcon status={block.status} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[12px] font-medium truncate",
                    block.status === "done" ? "text-[#9896b8]" : "text-[#f0effe]",
                  )}>
                    {idx + 1}. {block.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-[#3a3858]">{block.type}</span>
                  {block.status === "done" && block.tokensUsed && block.tokensUsed > 0 && (
                    <span className="text-[10px] font-mono text-[#3a3858]">{block.tokensUsed}t</span>
                  )}
                  {block.status === "failed" && block.errorMsg && (
                    <span className="text-[10px] text-red-400 truncate max-w-[140px]">{block.errorMsg}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] text-[#9d8ff5] animate-pulse">Generating…</span>
                  )}
                </div>
              </div>

              {/* Approve / Skip buttons for next pending */}
              {isNextUp && !currentBlock && (
                <div className="flex items-center gap-1 shrink-0">
                  {onSkip && (
                    <button
                      onClick={() => onSkip(block.id)}
                      className="p-1.5 rounded-lg text-[#3a3858] hover:text-[#9896b8] hover:bg-[#1e1e38] transition-colors"
                      title="Skip this block"
                    >
                      <SkipForward size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => onApprove(block.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7c6fee] hover:bg-[#6355d4] text-white text-[11px] font-semibold transition-colors"
                  >
                    <Play size={10} />
                    Run
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#1e1e38]">
        {allDone ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={13} />
            <span className="text-[12px] font-semibold">All blocks generated</span>
          </div>
        ) : currentBlock ? (
          <div className="flex items-center gap-2 text-[#9d8ff5]">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[12px]">Generating <strong>{currentBlock.title}</strong>…</span>
          </div>
        ) : nextPending ? (
          <p className="text-[11px] text-[#5c5a7a]">
            Click <span className="text-[#7c6fee] font-semibold">Run</span> to generate the next block
          </p>
        ) : null}
      </div>
    </div>
  );
}
