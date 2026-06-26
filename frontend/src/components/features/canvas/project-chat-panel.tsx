"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp, X, Bot, Sparkles, FileText,
  Clock, Zap, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight,
  RotateCcw, MessageSquare, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RunHistoryItem {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  totalTokens: number;
  blockCount: number;
}

interface ProjectChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null | undefined;
  projectName?: string;
  onOpenPlan?: () => void;
  currentPrompt?: string;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const STATUS_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  done:    { icon: CheckCircle2, color: "text-[#22c55e]" },
  failed:  { icon: XCircle,      color: "text-red-400"   },
  running: { icon: Loader2,      color: "text-[#9d8ff5]" },
  pending: { icon: Clock,        color: "text-[#5c5a7a]" },
};

function RunHistoryCard({ run, onClick }: { run: RunHistoryItem; onClick: () => void }) {
  const cfg = STATUS_ICON[run.status] ?? STATUS_ICON.pending;
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-xl border border-[#1a1a2e] bg-[#0d0d1a] hover:border-[#7c6fee]/30 hover:bg-[#111120] transition-all duration-200 group"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          <Icon className={cn("size-3.5", cfg.color, run.status === "running" && "animate-spin")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#c8c6e0] group-hover:text-white font-medium leading-snug line-clamp-2 transition-colors">
            {run.prompt}
          </p>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="text-[10px] text-[#3a3858] font-mono">{relTime(run.createdAt)}</span>
            {run.totalTokens > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#3a3858] font-mono">
                <Zap className="size-2.5" />{fmt(run.totalTokens)}
              </span>
            )}
            {run.blockCount > 0 && (
              <span className="text-[10px] text-[#3a3858] font-mono">{run.blockCount}b</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {!isUser && (
        <div className="flex items-center gap-1.5 px-1">
          <div className="size-4 rounded-md bg-[#7c6fee]/20 border border-[#7c6fee]/30 flex items-center justify-center">
            <Sparkles className="size-2.5 text-[#9d8ff5]" />
          </div>
          <span className="text-[9px] font-bold text-[#4a4870] uppercase tracking-wider">CraftaAI</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed",
          isUser
            ? "bg-[#7c6fee]/20 border border-[#7c6fee]/25 text-white/90 rounded-tr-sm"
            : "bg-[#111120] border border-[#1e1e38] text-[#9896b8] rounded-tl-sm"
        )}
        dangerouslySetInnerHTML={{
          __html: msg.content
            .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-semibold'>$1</strong>")
            .replace(/`([^`]+)`/g, "<code class='px-1 py-0.5 bg-[#1e1e38] rounded text-[#9d8ff5] text-[11px] font-mono'>$1</code>")
            .replace(/\n/g, "<br/>"),
        }}
      />
      <span className="text-[9px] text-[#2a2a48] px-1">{msg.timestamp}</span>
    </div>
  );
}

export function ProjectChatPanel({
  isOpen, onClose, projectId, projectName, onOpenPlan, currentPrompt,
}: ProjectChatPanelProps) {
  const { getToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Seed welcome message + current prompt when project changes
  useEffect(() => {
    const msgs: ChatMessage[] = [{
      role: "assistant",
      content: `Hi! I'm **CraftaAI** for **${projectName ?? "this project"}**.\n\nI have full context of your architecture. Ask me anything — how blocks connect, tech choices, how to extend the system, or anything else.`,
      timestamp: now(),
    }];
    if (currentPrompt?.trim()) {
      msgs.push({ role: "user", content: currentPrompt.trim(), timestamp: now() });
    }
    setMessages(msgs);
  }, [projectId]); // intentionally only re-seed on project change

  // Insert prompt as user message when it changes (new run started)
  const prevPromptRef = useRef<string>("");
  useEffect(() => {
    if (!currentPrompt?.trim()) return;
    if (currentPrompt === prevPromptRef.current) return;
    prevPromptRef.current = currentPrompt;
    setMessages(prev => {
      // Don't duplicate if already the last user message
      const last = prev[prev.length - 1];
      if (last?.role === "user" && last.content === currentPrompt.trim()) return prev;
      return [...prev, { role: "user", content: currentPrompt.trim(), timestamp: now() }];
    });
  }, [currentPrompt]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Fetch run history for this specific project
  useEffect(() => {
    if (!isOpen || !projectId) return;
    setHistoryLoading(true);
    getToken().then(token => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      // Use project-specific endpoint which returns runs directly as an array
      return fetch(`${apiUrl}/api/history/${projectId}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
    }).then(res => res.ok ? res.json() : [])
      .then((data: any[]) => {
        if (!Array.isArray(data)) { setRunHistory([]); return; }
        const mapped: RunHistoryItem[] = data.slice(0, 8).map((r: any) => ({
          id: r.id,
          prompt: r.prompt ?? "",
          status: r.status ?? "unknown",
          createdAt: r.createdAt ?? "",
          totalTokens: r.totalTokens ?? 0,
          blockCount: Array.isArray(r.blockOutputs) ? r.blockOutputs.length : 0,
        }));
        setRunHistory(mapped);
      })
      .catch(() => setRunHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [isOpen, projectId, getToken]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading || !projectId) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ message: msg, chatHistory }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as { message: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.message, timestamp: now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't connect right now. Please try again.",
        timestamp: now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, projectId, messages, getToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const QUICK_PROMPTS = [
    "How do my blocks connect?",
    "What's the deployment order?",
    "Suggest performance improvements",
    "Explain the data flow",
  ];

  const hasMessages = messages.length > 1;

  return (
    <div className={cn(
      "fixed top-0 right-0 h-full w-[380px] z-[90] flex flex-col",
      "bg-[#09091a]/98 backdrop-blur-2xl border-l border-white/[0.06]",
      "shadow-[-24px_0_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
      isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
    )}>

      {/* ── Top accent line ── */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#7c6fee]/50 to-transparent shrink-0" />

      {/* ── Header ── */}
      <div className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-[#7c6fee]/30 blur-[6px]" />
            <div className="relative size-8 rounded-xl bg-gradient-to-br from-[#9d8ff5] to-[#5a4fd4] flex items-center justify-center shadow-lg">
              <Bot className="size-4 text-white" />
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight tracking-tight">CraftaAI</div>
            <div className="text-[10px] text-[#4a4870] font-mono truncate max-w-[200px]">{projectName ?? "Untitled Project"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Plan icon button */}
          {onOpenPlan && (
            <button
              onClick={onOpenPlan}
              title="Open Plan"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#9d8ff5] border border-[#7c6fee]/20 bg-[#7c6fee]/8 hover:bg-[#7c6fee]/15 hover:border-[#7c6fee]/35 transition-all duration-200"
            >
              <FileText className="size-3.5" />
              Plan
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 p-1.5 rounded-lg hover:bg-white/5 text-[#4a4870] hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Run History ── */}
      {projectId && (
        <div className="shrink-0 border-b border-white/[0.05]">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="size-3 text-[#4a4870]" />
              <span className="text-[10px] font-semibold text-[#4a4870] uppercase tracking-[0.1em]">Run History</span>
              {runHistory.length > 0 && (
                <span className="text-[9px] text-[#2a2a48] font-mono bg-[#1a1a2e] border border-[#1e1e38] px-1.5 py-0.5 rounded-full">
                  {runHistory.length}
                </span>
              )}
            </div>
            {historyOpen
              ? <ChevronDown className="size-3 text-[#3a3858]" />
              : <ChevronRight className="size-3 text-[#3a3858]" />
            }
          </button>

          {historyOpen && (
            <div className="px-3 pb-3 max-h-[240px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1a1a2e]">
              {historyLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-[#3a3858]">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="text-[11px]">Loading history…</span>
                </div>
              ) : runHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                  <MessageSquare className="size-4 text-[#2a2a48]" />
                  <p className="text-[11px] text-[#3a3858]">No runs yet. Generate a plan to get started.</p>
                </div>
              ) : (
                runHistory.map(run => (
                  <RunHistoryCard
                    key={run.id}
                    run={run}
                    onClick={() => handleSend(`Tell me about this run: "${run.prompt.slice(0, 80)}"`)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1a1a2e]">

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && (
          <div className="self-start flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#111120] border border-[#1e1e38]">
            <div className="flex gap-1">
              {[0, 1, 2].map(j => (
                <div
                  key={j}
                  className="size-1.5 rounded-full bg-[#7c6fee]/60 animate-bounce"
                  style={{ animationDelay: `${j * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {!projectId && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12 text-center">
            <div className="size-12 rounded-2xl bg-[#0d0d1a] border border-[#1e1e38] flex items-center justify-center">
              <Bot className="size-5 text-[#2a2a48]" />
            </div>
            <p className="text-[12px] text-[#4a4870] max-w-[200px] leading-relaxed">
              Generate a plan first to start chatting about your project.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick prompts ── */}
      {!hasMessages && projectId && (
        <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium text-[#9896b8] bg-[#111120] border border-[#1e1e38] hover:border-[#7c6fee]/40 hover:text-[#f0effe] hover:bg-[#16162a] transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="shrink-0 p-3 border-t border-white/[0.05] bg-[#07071a]/80">
        <div className="flex items-end gap-2 bg-[#111120] border border-[#1e1e38] rounded-xl px-3 pt-2.5 pb-2 focus-within:border-[#7c6fee]/40 focus-within:shadow-[0_0_0_1px_rgba(124,111,238,0.15)] transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!projectId}
            placeholder={projectId ? "Ask anything about your project…" : "Generate a plan first…"}
            className="flex-1 bg-transparent text-[12px] text-[#f0effe] placeholder:text-[#2a2a48] resize-none focus:outline-none max-h-28 overflow-y-auto leading-relaxed disabled:opacity-40"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !projectId}
            className={cn(
              "mb-0.5 shrink-0 size-7 rounded-lg flex items-center justify-center transition-all",
              input.trim() && !isLoading && projectId
                ? "bg-[#7c6fee] text-white hover:bg-[#6355d4] shadow-[0_0_12px_rgba(124,111,238,0.4)]"
                : "bg-[#1a1a2e] text-[#3a3858] cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[9px] text-[#2a2a48]">All blocks in context · Enter to send</span>
          {onOpenPlan && (
            <button
              onClick={onOpenPlan}
              className="flex items-center gap-1 text-[9px] text-[#3a3858] hover:text-[#7c6fee] transition-colors"
            >
              <FileText className="size-2.5" />
              Open Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
