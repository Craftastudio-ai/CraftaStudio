"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp, Sparkles, AlertTriangle, RefreshCw,
  Copy, Check, Wifi, Key, AlertCircle, ExternalLink, RotateCcw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  action?: string;
  affectedBlocks?: string[];
  isError?: boolean;
  rawError?: string;
  suggestions?: { id: string; label: string; prompt: string }[];
  canRegenerate?: boolean;
}

export interface BlockChatPanelProps {
  blockId: string;
  blockTitle: string;
  blockContext?: Record<string, unknown>;
  projectId?: string | null;
  onBlockUpdated?: (blockId: string, updatedBlock: Record<string, unknown>, action?: string) => void;
}

interface AIErrorData {
  error?: string;
  code?: string;
  model?: string;
  provider?: string;
  status?: number;
  hint?: string;
  details?: string;
  message?: string;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Error Parsing ─────────────────────────────────────────────────────────────
function parseAIError(raw: string): AIErrorData {
  if (!raw?.trim()) return { error: "Unknown error", code: "unknown_error" };
  // Try direct parse
  try {
    const p = JSON.parse(raw);
    if (p.error || p.code) return p as AIErrorData;
  } catch { /* not JSON */ }
  // Try to find JSON embedded in text
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const p = JSON.parse(match[0]);
      if (p.error || p.code) return p as AIErrorData;
    } catch { /* ignore */ }
  }
  return { error: raw.slice(0, 300), code: "unknown_error" };
}

function getStatusColor(code?: string, status?: number): "purple" | "orange" | "red" {
  if (code === "missing_api_key" || code === "authentication_error") return "purple";
  if (status === 503 || code === "network_error") return "red";
  return "orange";
}

const COLORS = {
  purple: {
    wrap: "bg-[#7c6fee]/10 border-[#7c6fee]/25 shadow-[0_0_24px_rgba(124,111,238,0.12)]",
    icon: "text-[#9d8ff5]",
    iconWrap: "bg-[#7c6fee]/15 border-[#7c6fee]/30",
    title: "text-[#c4bcfa]",
    badge: "bg-[#7c6fee]/15 text-[#c4bcfa] border-[#7c6fee]/30",
    hint: "bg-[#7c6fee]/8 border-[#7c6fee]/15 text-[#a78bfa]",
    retry: "bg-[#7c6fee]/15 border-[#7c6fee]/30 text-[#c4bcfa] hover:bg-[#7c6fee]/25",
  },
  orange: {
    wrap: "bg-[#f59e0b]/8 border-[#f59e0b]/20 shadow-[0_0_24px_rgba(245,158,11,0.08)]",
    icon: "text-[#f59e0b]",
    iconWrap: "bg-[#f59e0b]/15 border-[#f59e0b]/25",
    title: "text-[#fcd34d]",
    badge: "bg-[#f59e0b]/15 text-[#fcd34d] border-[#f59e0b]/25",
    hint: "bg-[#f59e0b]/8 border-[#f59e0b]/15 text-[#fbbf24]",
    retry: "bg-[#f59e0b]/15 border-[#f59e0b]/25 text-[#fcd34d] hover:bg-[#f59e0b]/25",
  },
  red: {
    wrap: "bg-[#f43f5e]/8 border-[#f43f5e]/20 shadow-[0_0_24px_rgba(244,63,94,0.08)]",
    icon: "text-[#f43f5e]",
    iconWrap: "bg-[#f43f5e]/15 border-[#f43f5e]/25",
    title: "text-[#fda4af]",
    badge: "bg-[#f43f5e]/15 text-[#fda4af] border-[#f43f5e]/25",
    hint: "bg-[#f43f5e]/8 border-[#f43f5e]/15 text-[#fb7185]",
    retry: "bg-[#f43f5e]/15 border-[#f43f5e]/25 text-[#fda4af] hover:bg-[#f43f5e]/25",
  },
} as const;

// ── Premium Error Card ─────────────────────────────────────────────────────────
function ErrorCard({ rawError, onRetry }: { rawError: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const err = parseAIError(rawError);
  const colorKey = getStatusColor(err.code, err.status);
  const c = COLORS[colorKey];

  // Pick icon
  const Icon =
    err.code === "missing_api_key" || err.code === "authentication_error" ? Key
    : err.code === "network_error" ? Wifi
    : err.code === "not_found_error" ? AlertCircle
    : AlertTriangle;

  // Human-readable title
  const title =
    err.code === "not_found_error" ? "AI Model Not Found"
    : err.code === "missing_api_key" ? "API Key Missing"
    : err.code === "authentication_error" ? "Authentication Failed"
    : err.code === "network_error" ? "Connection Error"
    : err.code === "rate_limit_error" ? "Rate Limit Reached"
    : "AI Service Error";

  // Human-readable explanation
  const explanation =
    err.code === "not_found_error"
      ? `The model "${err.model ?? "unknown"}" does not exist on the Anthropic API. This is a backend configuration issue — the model name in your .env is likely incorrect.`
    : err.code === "missing_api_key"
      ? "No ANTHROPIC_API_KEY found. The backend cannot make AI calls without a valid key."
    : err.code === "authentication_error"
      ? "Your API key was rejected. It may be expired, revoked, or for a different account."
    : err.code === "network_error"
      ? "Could not connect to the AI provider. Make sure the backend is running and has internet access."
    : err.code === "rate_limit_error"
      ? "You've hit the rate limit. Wait a moment and try again, or upgrade your Anthropic plan."
    : err.details || err.error || "The AI service returned an unexpected error.";

  const handleCopy = () => {
    navigator.clipboard.writeText(rawError).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn("rounded-2xl rounded-tl-sm border p-3.5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full", c.wrap)}>
      {/* ── Header ── */}
      <div className="flex items-start gap-2.5">
        <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0 border", c.iconWrap)}>
          <Icon className={cn("size-4", c.icon)} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[12px] font-bold leading-none", c.title)}>{title}</span>
            {err.status && (
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border font-mono", c.badge)}>
                HTTP {err.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {err.provider && (
              <span className="text-[9px] font-mono text-[#5c5a7a] bg-white/[0.03] px-1.5 py-0.5 rounded-md border border-white/[0.04]">
                {err.provider}
              </span>
            )}
            {err.model && (
              <span className="text-[9px] font-mono text-[#5c5a7a] truncate max-w-[180px] bg-white/[0.03] px-1.5 py-0.5 rounded-md border border-white/[0.04]" title={err.model}>
                {err.model}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Explanation ── */}
      <p className="text-[11.5px] text-[#9896b8] leading-relaxed">
        {explanation}
      </p>

      {/* ── Hint ── */}
      {err.hint && (
        <div className={cn("flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[11px] leading-relaxed", c.hint)}>
          <span className="shrink-0 mt-0.5">💡</span>
          <span>{err.hint}</span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={onRetry}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all",
            c.retry
          )}
        >
          <RotateCcw className="size-3" />
          Retry
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#9896b8] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
        >
          {copied ? <Check className="size-3 text-[#22c55e]" /> : <Copy className="size-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href="https://docs.anthropic.com/en/api/models-list"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-[10px] text-[#5c5a7a] hover:text-[#9896b8] transition-colors"
        >
          Model Docs
          <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function BlockChatPanel({
  blockId,
  blockTitle,
  blockContext = {},
  projectId,
  onBlockUpdated,
}: BlockChatPanelProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [affectedBanner, setAffectedBanner] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMessageRef = useRef<string>("");

  // Load chat history
  useEffect(() => {
    if (!blockId) return;
    setMessages([]);
    setAffectedBanner([]);

    const load = async () => {
      setIsLoadingHistory(true);
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${apiUrl}/api/blocks/${blockId}/chat`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (res.ok) {
          const history = await res.json() as Array<{
            id: string; role: string; content: string; createdAt: string;
            metadata?: {
              action?: string;
              affectedBlocks?: string[];
              suggestions?: { id: string; label: string; prompt: string }[];
              canRegenerate?: boolean;
            };
          }>;
          if (history.length > 0) {
            setMessages(history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              action: m.metadata?.action,
              affectedBlocks: m.metadata?.affectedBlocks,
              suggestions: m.metadata?.suggestions ?? undefined,
              canRegenerate: m.metadata?.canRegenerate ?? undefined,
            })));
          } else {
            setMessages([{
              role: "assistant",
              content: `Hi! I'm your AI assistant for the **${blockTitle}** block. I can explain its purpose, suggest improvements, change the tech stack, or regenerate it entirely.\n\nWhat would you like to do?`,
              timestamp: now(),
            }]);
          }
        }
      } catch {
        setMessages([{ role: "assistant", content: `Ask me anything about the **${blockTitle}** block!`, timestamp: now() }]);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    load();
  }, [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;
    lastUserMessageRef.current = userText;

    const userMsg: ChatMessage = { role: "user", content: userText, timestamp: now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setAffectedBanner([]);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const chatHistory = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${apiUrl}/api/blocks/${blockId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ message: userText, chatHistory, blockContext, projectId: projectId ?? undefined }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "{}");
        setMessages((prev) => [...prev, {
          role: "assistant", content: "", timestamp: now(),
          isError: true, rawError: errText,
        }]);
        return;
      }

      const data = await res.json() as {
        action: string;
        message: string;
        updatedBlock?: Record<string, unknown>;
        affectedBlocks?: string[];
        suggestions?: { id: string; label: string; prompt: string }[];
        canRegenerate?: boolean;
      };

      setMessages((prev) => [...prev, {
        role: "assistant", content: data.message, timestamp: now(),
        action: data.action, affectedBlocks: data.affectedBlocks ?? [],
        suggestions: data.suggestions ?? undefined,
        canRegenerate: data.canRegenerate ?? false,
      }]);

      if (data.action === "regenerate_block" && data.updatedBlock) {
        onBlockUpdated?.(blockId, data.updatedBlock, data.action);
      }
      if ((data.affectedBlocks ?? []).length > 0) {
        setAffectedBanner(data.affectedBlocks!);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, {
        role: "assistant", content: "", timestamp: now(),
        isError: true,
        rawError: JSON.stringify({
          error: "Network error", code: "network_error",
          details: detail,
          hint: "Check that the backend server is running on the correct port.",
        }),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, blockId, blockContext, projectId, messages, getToken, onBlockUpdated]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  }, [input, sendMessage]);

  const handleRetry = useCallback(() => {
    if (!lastUserMessageRef.current) return;
    // Remove the last error message then resend
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.isError ? prev.slice(0, -1) : prev;
    });
    sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Affected blocks banner ── */}
      {affectedBanner.length > 0 && (
        <div className="shrink-0 mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-300 font-semibold">
              {affectedBanner.length} other block{affectedBanner.length > 1 ? "s" : ""} need updates
            </p>
            <p className="text-[10px] text-amber-400/60 mt-0.5 font-mono truncate">
              {affectedBanner.join(", ")}
            </p>
          </div>
          <button onClick={() => setAffectedBanner([])} className="text-amber-400/40 hover:text-amber-400 transition-colors">
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1e1e38]">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8">
            <div className="size-4 rounded-full border-2 border-[#7c6fee]/30 border-t-[#7c6fee] animate-spin" />
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200",
              msg.role === "user" ? "self-end items-end max-w-[88%]" : "self-start items-start w-full max-w-full"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex items-center gap-1.5 px-1 mb-0.5">
                <div className="size-4 rounded-md bg-[#7c6fee]/20 border border-[#7c6fee]/30 flex items-center justify-center">
                  <Sparkles className="size-2.5 text-[#9d8ff5]" />
                </div>
                <span className="text-[9px] font-bold text-[#5c5a7a] uppercase tracking-wider">Block AI</span>
                {msg.action === "regenerate_block" && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-400 uppercase tracking-wider">
                    <RefreshCw className="size-2.5" /> Updated
                  </span>
                )}
              </div>
            )}

            {/* Error card OR normal bubble */}
            {msg.isError ? (
              <ErrorCard rawError={msg.rawError ?? ""} onRetry={handleRetry} />
            ) : (
              <>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed w-full",
                    msg.role === "user"
                      ? "bg-[#7c6fee]/20 border-[#7c6fee]/25 text-white/90 rounded-tr-sm"
                      : "bg-[#111120] border-[#1e1e38] text-[#9896b8] rounded-tl-sm"
                  )}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-semibold'>$1</strong>")
                      .replace(/`([^`]+)`/g, "<code class='px-1 py-0.5 bg-[#1e1e38] rounded text-[#9d8ff5] text-[11px] font-mono'>$1</code>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />

                {/* Suggestions A, B, C */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2 w-full animate-in fade-in duration-200">
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-[#3a3858] uppercase tracking-wider px-1">
                      Choose an Option:
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => sendMessage(s.prompt)}
                          className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e1e38] bg-zinc-50 dark:bg-[#0d0d1a] hover:border-[#7c6fee]/40 hover:bg-[#7c6fee]/5 text-[11.5px] transition-all flex items-start gap-2 group cursor-pointer"
                        >
                          <span className="size-5 rounded-md bg-[#7c6fee]/10 text-[#9d8ff5] font-bold flex items-center justify-center shrink-0 border border-[#7c6fee]/15 group-hover:bg-[#7c6fee] group-hover:text-white transition-colors text-[10px]">
                            {s.id}
                          </span>
                          <span className="text-[#9896b8] group-hover:text-[#f0effe] pt-0.5 transition-colors font-medium">
                            {s.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regenerate Block Button */}
                {msg.canRegenerate && (
                  <button
                    onClick={() => sendMessage("Please apply these changes and regenerate the block.")}
                    className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2 w-full rounded-xl text-[12px] font-bold text-white transition-all bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_0_24px_-4px_rgba(245,158,11,0.25)] border-none cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    Regenerate Block
                  </button>
                )}
              </>
            )}
            <span className="text-[9px] text-[#3a3858] px-1">{msg.timestamp}</span>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="self-start flex items-center gap-2 px-3 py-2.5 rounded-2xl rounded-tl-sm bg-[#111120] border border-[#1e1e38] animate-in fade-in duration-200">
            <div className="flex gap-1">
              {[0, 1, 2].map((j) => (
                <div key={j} className="size-1.5 rounded-full bg-[#7c6fee]/60 animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 pt-3 border-t border-[#1e1e38]">
        <div className="flex items-end gap-2 bg-[#111120] border border-[#1e1e38] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-[#7c6fee]/40 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${blockTitle}…`}
            className="flex-1 bg-transparent text-[12px] text-[#f0effe] placeholder:text-[#3a3858] resize-none focus:outline-none max-h-20 overflow-y-auto leading-relaxed"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "mb-0.5 shrink-0 size-6 rounded-lg flex items-center justify-center transition-all",
              input.trim() && !isLoading
                ? "bg-[#7c6fee] text-white hover:bg-[#6355d4] hover:scale-105"
                : "bg-[#1e1e38] text-[#3a3858] cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-[#3a3858] text-center mt-1.5">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
