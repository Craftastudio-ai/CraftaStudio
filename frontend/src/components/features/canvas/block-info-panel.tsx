"use client";

import { useEffect, useState } from "react";
import { X, Check, FileText, Sparkles, ArrowRight, Code2, Layers, Globe, Loader2, ChevronDown, ChevronRight, MessageSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { BlockChatPanel } from "./block-chat-panel";
import { HealthIntelligencePanel } from "./health-intelligence-panel";

interface Endpoint {
  method: string;
  route: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

interface BlockMeta {
  id: string;
  title: string;
  stack: string;
  tech_stack?: string[];
  status: string;
  description?: string;
  files?: string[];
  acceptance_criteria?: string[];
  dependencies?: string[];
  estimated_lines?: number;
  type?: string;
  endpoints?: Endpoint[];
  implementation_notes?: string;
}

interface BlockInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: BlockMeta | null;
  projectId?: string | null;
  onImplement?: () => void;
  isImplementing?: boolean;
  onBlockUpdated?: (blockId: string, updatedBlock: Record<string, unknown>, action?: string) => void;
  onViewCode?: () => void;
}

const STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  idle:             { text: "text-[#5c5a7a]",  bg: "bg-[#1e1e38]/60",    border: "border-[#1e1e38]" },
  running:          { text: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/20" },
  awaiting_confirm: { text: "text-[#9d8ff5]",  bg: "bg-[#7c6fee]/10",    border: "border-[#7c6fee]/20" },
  done:             { text: "text-green-400",   bg: "bg-green-500/10",    border: "border-green-500/20" },
  success:          { text: "text-green-400",   bg: "bg-green-500/10",    border: "border-green-500/20" },
  error:            { text: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/20" },
  failed:           { text: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/20" },
};

const DEP_COLORS = [
  { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  { text: "text-[#9d8ff5]", bg: "bg-[#7c6fee]/10",  border: "border-[#7c6fee]/20" },
  { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20" },
  { text: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20" },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-green-400 bg-green-500/10 border-green-500/20",
  POST:   "text-blue-400  bg-blue-500/10  border-blue-500/20",
  PUT:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
  PATCH:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  DELETE: "text-red-400   bg-red-500/10   border-red-500/20",
  WS:     "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-mono text-[#5c5a7a] uppercase tracking-widest mb-2.5">
      {label}
    </div>
  );
}

export function BlockInfoPanel({ isOpen, onClose, data, projectId, onImplement, isImplementing, onBlockUpdated, onViewCode }: BlockInfoPanelProps) {
  const { getToken } = useAuth();
  const [richMeta, setRichMeta] = useState<BlockMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "architecture" | "chat">("details");
  const [endpointsOpen, setEndpointsOpen] = useState(true);

  // Fetch rich metadata from DB whenever a new block is selected
  useEffect(() => {
    if (!data?.id || !isOpen) return;
    // Reset tab & use canvas data immediately (no flicker)
    setActiveTab("details");
    setRichMeta(data);

    const fetchMeta = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004";
        const res = await fetch(`${apiUrl}/api/blocks/${data.id}`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (res.ok) {
          const block = await res.json();
          const bj = block.blockJson ?? {};
          setRichMeta({
            id: block.id,
            title: bj.title ?? data.title,
            stack: bj.stack ?? data.stack,
            tech_stack: bj.tech_stack ?? bj.tech_stack_arr ?? data.tech_stack ?? [],
            status: bj.status ?? data.status,
            description: bj.description ?? data.description ?? "",
            files: bj.files ?? data.files ?? [],
            acceptance_criteria: bj.acceptance_criteria ?? data.acceptance_criteria ?? [],
            dependencies: bj.dependencies ?? data.dependencies ?? [],
            estimated_lines: bj.estimated_lines ?? data.estimated_lines ?? 0,
            type: bj.originalType ?? block.blockType ?? data.type ?? "",
            endpoints: bj.endpoints ?? data.endpoints ?? [],
            implementation_notes: bj.implementation_notes ?? "",
          });
        }
      } catch { /* use canvas data as fallback */ }
      setLoading(false);
    };
    fetchMeta();
  }, [data?.id, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = richMeta ?? data;
  if (!meta && isOpen) return null;

  const statusCfg = STATUS_COLOR[meta?.status ?? "idle"] ?? STATUS_COLOR.idle;
  const files = meta?.files ?? [];
  const criteria = meta?.acceptance_criteria ?? [];
  const dependencies = meta?.dependencies ?? [];
  const techStack = meta?.tech_stack ?? (meta?.stack ? meta.stack.split(/[+,]/).map(s => s.trim()).filter(Boolean) : []);
  const endpoints = meta?.endpoints ?? [];
  const lineCount = meta?.estimated_lines ?? 0;

  const typeLabel = (() => {
    const t = (meta?.type ?? "").toLowerCase();
    if (t.includes("ui") || t.includes("frontend") || t.includes("web")) return "UI · COMPONENT";
    if (t.includes("api") || t.includes("server") || t.includes("backend")) return "API · SERVICE";
    if (t.includes("data") || t.includes("db") || t.includes("database")) return "DATA · STORAGE";
    if (t.includes("auth")) return "AUTH · SECURITY";
    if (t.includes("job") || t.includes("worker")) return "JOB · WORKER";
    if (t.includes("service")) return "SERVICE · MODULE";
    return (meta?.stack ?? "SERVICE · MODULE").toUpperCase().slice(0, 20);
  })();

  const hasContent = files.length > 0 || criteria.length > 0 || dependencies.length > 0 || techStack.length > 0 || endpoints.length > 0;

  return (
    <div className={cn(
      "fixed top-0 right-0 h-full w-[380px] border-l border-slate-200 dark:border-[#1e1e38] bg-white dark:bg-[#0d0d1a] z-[100] flex flex-col shadow-2xl transition-all duration-300 ease-in-out font-sans",
      isOpen ? "translate-x-0 opacity-100 visible" : "translate-x-full opacity-0 invisible"
    )}>
      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-200 dark:border-[#1e1e38] shrink-0">
        {(["details", "architecture", "chat"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3.5 px-2 text-[11px] font-semibold border-b-2 -mb-[1px] transition-colors flex items-center justify-center gap-1",
              activeTab === tab
                ? "text-slate-850 dark:text-[#f0effe] border-[#7c6fee]"
                : "text-slate-400 dark:text-[#5c5a7a] border-transparent hover:text-slate-700 dark:hover:text-[#9896b8]"
            )}
          >
            {tab === "chat" && <MessageSquare className="w-3 h-3" />}
            {tab === "details" ? "Details" : tab === "architecture" ? "Arch" : "Chat"}
          </button>
        ))}
        <button onClick={onClose} className="px-3 text-slate-400 dark:text-[#5c5a7a] hover:text-slate-800 dark:hover:text-white transition-colors shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Chat tab (full-height, no scroll wrapper) ── */}
      {activeTab === "chat" && meta && (
        <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-4">
          <BlockChatPanel
            blockId={meta.id}
            blockTitle={meta.title ?? "Block"}
            blockContext={{ title: meta.title, stack: meta.stack, description: meta.description, type: meta.type }}
            projectId={projectId}
            onBlockUpdated={onBlockUpdated}
          />
        </div>
      )}

      {/* ── Scrollable content (details + architecture) ── */}
      <div className={cn("flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1e1e38]", activeTab === "chat" && "hidden")}>
        <div className="p-5 pb-4 flex flex-col gap-0">

          {/* Type label */}
          <div className="text-[10px] font-bold text-[#7c6fee] dark:text-[#9d8ff5] uppercase tracking-[0.18em] mb-2">
            {typeLabel}
          </div>

          {/* Block title */}
          <div className="text-[22px] font-bold text-slate-800 dark:text-white tracking-tight leading-tight mb-2">
            {meta?.title ?? "Untitled Block"}
          </div>

          {/* Description */}
          {meta?.description && (
            <p className="text-[13px] text-slate-650 dark:text-[#9896b8] leading-relaxed mb-3">
              {meta.description}
            </p>
          )}

          {/* Status + Lines */}
          <div className="flex items-center gap-2 mt-1 mb-6 flex-wrap">
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
              statusCfg.text, statusCfg.bg, statusCfg.border
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {(meta?.status || "idle").toUpperCase()}
            </span>
            {lineCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider text-[#7c6fee] dark:text-[#9d8ff5] bg-[#7c6fee]/5 dark:bg-[#7c6fee]/10 border border-slate-200 dark:border-[#7c6fee]/20">
                ~ {lineCount} LINES
              </span>
            )}
            {(meta?.status === "done" || meta?.status === "success") && onViewCode && (
              <button
                onClick={onViewCode}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 transition-all ml-auto cursor-pointer"
              >
                <Code2 className="w-3 h-3" />
                View Code
              </button>
            )}
          </div>

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <div className="flex flex-col gap-6">

              {/* TECH STACK */}
              {techStack.length > 0 && (
                <div>
                  <SectionHeader label="Tech Stack" />
                  <div className="flex flex-wrap gap-1.5">
                    {techStack.map((t) => (
                      <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#7c6fee] dark:text-[#9d8ff5] bg-[#7c6fee]/5 dark:bg-[#7c6fee]/10 border border-slate-200 dark:border-[#7c6fee]/20">
                        <Layers className="w-3 h-3" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* FILES TO GENERATE */}
              {files.length > 0 && (
                <div>
                  <SectionHeader label="Files to Generate" />
                  <div className="flex flex-col gap-0.5 bg-slate-50 dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-2">
                    {files.map((f, i) => (
                      <div key={`${f}-${i}`} className="flex items-center gap-2.5 px-3 py-1.5 font-mono text-[11px] text-slate-650 dark:text-[#9896b8] hover:bg-slate-100 dark:hover:bg-[#16162a] rounded-lg transition-colors">
                        <FileText className="w-3 h-3 text-slate-400 dark:text-[#5c5a7a] shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACCEPTANCE CRITERIA */}
              {criteria.length > 0 && (
                <div>
                  <SectionHeader label="Implementation Steps" />
                  <div className="flex flex-col gap-2.5">
                    {criteria.map((c, i) => (
                      <div key={i} className="flex gap-2.5 text-[12px] text-slate-650 dark:text-[#9896b8] leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-[#7c6fee] dark:text-[#9d8ff5] shrink-0 mt-0.5" strokeWidth={3} />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DEPENDS ON */}
              {dependencies.length > 0 && (
                <div>
                  <SectionHeader label="Depends On" />
                  <div className="flex flex-wrap gap-1.5">
                    {dependencies.map((dep, i) => {
                      const col = DEP_COLORS[i % DEP_COLORS.length];
                      return (
                        <span key={dep} className={cn(
                          "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
                          col.text, col.bg, col.border
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {dep}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hasContent && !loading && (
                <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-slate-200 dark:border-[#1e1e38] bg-slate-50 dark:bg-[#111120] text-center">
                  <Code2 className="w-6 h-6 text-[#3a3858]" />
                  <p className="text-[12px] text-slate-500 dark:text-[#5c5a7a]">Metadata loading…</p>
                  <p className="text-[11px] text-slate-400 dark:text-[#3a3858] max-w-[200px]">Rich details appear after plan generation.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ARCHITECTURE TAB ── */}
          {activeTab === "architecture" && (
            <div className="flex flex-col gap-6">

              {/* API ENDPOINTS */}
              {endpoints.length > 0 && (
                <div>
                  <button
                    onClick={() => setEndpointsOpen(v => !v)}
                    className="w-full flex items-center justify-between mb-2.5 group font-sans cursor-pointer"
                  >
                    <SectionHeader label={`API Endpoints (${endpoints.length})`} />
                    {endpointsOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-[#5c5a7a]" />
                      : <ChevronRight className="w-3.5 h-3.5 text-[#5c5a7a]" />
                    }
                  </button>
                  {endpointsOpen && (
                    <div className="flex flex-col gap-2">
                      {endpoints.map((ep, i) => {
                        const mc = METHOD_COLOR[ep.method?.toUpperCase()] ?? METHOD_COLOR.GET;
                        return (
                          <div key={i} className="bg-slate-50 dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono",
                                mc
                              )}>
                                {ep.method}
                              </span>
                              <span className="text-[11px] font-mono text-slate-700 dark:text-[#9896b8] truncate">{ep.route}</span>
                            </div>
                            {ep.request && Object.keys(ep.request).length > 0 && (
                              <div className="text-[10px] font-mono text-slate-500 dark:text-[#5c5a7a] pl-1">
                                → {JSON.stringify(ep.request).slice(0, 80)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Implementation notes */}
              {meta?.implementation_notes && (
                <div>
                  <SectionHeader label="Implementation Notes" />
                  <div className="bg-slate-50 dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 text-[11px] text-slate-650 dark:text-[#9896b8] leading-relaxed whitespace-pre-wrap">
                    {meta.implementation_notes}
                  </div>
                </div>
              )}

              {/* Tech stack detail */}
              {techStack.length > 0 && (
                <div>
                  <SectionHeader label="Stack Rationale" />
                  <div className="flex flex-col gap-1.5">
                    {techStack.map((t) => (
                      <div key={t} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38]">
                        <Globe className="w-3 h-3 text-[#7c6fee] shrink-0" />
                        <span className="text-[12px] text-slate-700 dark:text-[#9896b8]">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {endpoints.length === 0 && !meta?.implementation_notes && (
                <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-slate-200 dark:border-[#1e1e38] bg-slate-50 dark:bg-[#111120] text-center">
                  <Globe className="w-6 h-6 text-[#3a3858]" />
                  <p className="text-[12px] text-slate-500 dark:text-[#5c5a7a]">No API endpoints for this block type.</p>
                </div>
              )}
            </div>
          )}
          {/* ── AI Intelligence & Implementation Action ── */}
          {activeTab !== "chat" && (
            <div className="flex flex-col">
              {meta?.id && <HealthIntelligencePanel blockId={meta.id} blockName={meta.title ?? "Block"} />}

              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#1e1e38]">
                {(() => {
                  const isRunning = isImplementing || meta?.status === "running" || meta?.status === "awaiting_confirm";
                  const isDone = meta?.status === "done" || meta?.status === "success";
                  
                  if (isDone) {
                    return (
                      <div className="flex gap-2">
                        <button
                          onClick={onImplement}
                          disabled={isImplementing}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#1e1e38] dark:hover:bg-[#2a2a4a] border border-slate-200 dark:border-[#7c6fee]/40 hover:border-slate-300 dark:hover:border-[#7c6fee]/70 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 dark:text-[#a89ef5] hover:text-slate-900 dark:hover:text-white rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                          {isImplementing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          {isImplementing ? "Regenerating…" : "Regenerate"}
                        </button>
                        {onViewCode && (
                          <button
                            onClick={onViewCode}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-[#1e1e38] border border-slate-200 dark:border-[#7c6fee]/40 hover:border-slate-300 dark:hover:border-[#7c6fee]/70 text-slate-800 dark:text-[#a89ef5] hover:text-slate-900 dark:hover:text-white rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                          >
                            <Code2 className="w-4 h-4" />
                            View Code
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={isRunning ? undefined : onImplement}
                      disabled={isRunning}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3 text-white rounded-xl font-bold text-sm transition-all cursor-pointer",
                        isRunning
                          ? "bg-amber-500/80 cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                          : "bg-[#7c6fee] hover:bg-[#6355d4] shadow-[0_0_20px_rgba(124,111,238,0.3)] hover:shadow-[0_0_30px_rgba(124,111,238,0.5)] hover:-translate-y-0.5"
                      )}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating code...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 fill-white" />
                          Implement this block
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
