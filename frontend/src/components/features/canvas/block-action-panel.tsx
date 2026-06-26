"use client";

import { useAuth } from "@clerk/nextjs";
import { AlertCircle, CheckCircle2, ChevronRight, Zap, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NextBlockPreview {
  id: string;
  title: string;
  type: string;
  description?: string;
}

interface BlockActionPanelProps {
  currentBlockId: string;
  currentBlockType: string;
  currentBlockTitle: string;
  currentBlockStatus: "awaiting_confirm" | "failed";
  currentBlockError?: string | null;
  nextBlockPreview?: NextBlockPreview | null;
  runId: string | null;
  projectId: string;
  onConfirmed?: () => void;
  onSkipped?: () => void;
  onRetry?: () => void;
}

export function BlockActionPanel({
  currentBlockId,
  currentBlockType,
  currentBlockTitle,
  currentBlockStatus,
  currentBlockError,
  nextBlockPreview,
  runId,
  projectId,
  onConfirmed,
  onSkipped,
  onRetry,
}: BlockActionPanelProps) {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/workflow/confirm/${currentBlockId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, runId }),
      });
      
      if (res.ok) {
        onConfirmed?.();
      }
    } catch (err) {
      console.error("Confirm failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/workflow/skip/${currentBlockId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, runId }),
      });
      
      if (res.ok) {
        onSkipped?.();
      }
    } catch (err) {
      console.error("Skip failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/workflow/retry/${currentBlockId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, runId }),
      });
      
      if (res.ok) {
        onRetry?.();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const isFailed = currentBlockStatus === "failed";
  const isAwaitingConfirm = currentBlockStatus === "awaiting_confirm";

  return (
    <div className="flex flex-col gap-4 p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-700">
      {/* Current Block Status */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="mt-1 shrink-0">
          {isFailed ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-yellow-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              {currentBlockTitle}
            </span>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-700 text-slate-300">
              {currentBlockType}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {isFailed && (
              <span className="inline-flex items-center gap-1 text-xs text-red-300 bg-red-500/10 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3" />
                Generation Failed
              </span>
            )}
            {isAwaitingConfirm && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-300 bg-yellow-500/10 px-2 py-1 rounded">
                <Zap className="w-3 h-3" />
                Ready for confirmation
              </span>
            )}
          </div>
          {currentBlockError && (
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {currentBlockError}
            </p>
          )}
        </div>
      </div>

      {/* Next Block Preview */}
      {nextBlockPreview && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
          <ChevronRight className="w-5 h-5 text-blue-400 mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 mb-1">Next block</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-300">
                {nextBlockPreview.title}
              </span>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-700 text-slate-400">
                {nextBlockPreview.type}
              </span>
            </div>
            {nextBlockPreview.description && (
              <p className="text-xs text-slate-400 leading-relaxed">
                {nextBlockPreview.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {isAwaitingConfirm && (
          <>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "flex-1 min-w-fit px-4 py-2 rounded-lg font-medium text-sm transition-all inline-flex items-center justify-center gap-2",
                "bg-blue-600 hover:bg-blue-700 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Continue
                </>
              )}
            </button>
          </>
        )}

        {isFailed && (
          <>
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className={cn(
                "flex-1 min-w-fit px-4 py-2 rounded-lg font-medium text-sm transition-all inline-flex items-center justify-center gap-2",
                "bg-amber-600 hover:bg-amber-700 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Retry Block
                </>
              )}
            </button>
          </>
        )}

        {/* Skip Button - Always Available */}
        <button
          onClick={handleSkip}
          disabled={isLoading}
          className={cn(
            "flex-1 min-w-fit px-4 py-2 rounded-lg font-medium text-sm transition-all inline-flex items-center justify-center gap-2",
            "bg-slate-700 hover:bg-slate-600 text-slate-100",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-300 rounded-full animate-spin" />
              Skipping...
            </>
          ) : (
            <>
              <SkipForward className="w-4 h-4" />
              Skip Block
            </>
          )}
        </button>
      </div>

      {/* Help text */}
      <p className="text-xs text-slate-500 leading-relaxed">
        {isFailed
          ? "This block failed to generate. You can retry it, skip it and proceed to the next block, or review the error."
          : "Review the generated code above. Confirm to save and proceed to the next block, or skip this block."}
      </p>
    </div>
  );
}
