"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, FolderOpen, Zap, Activity,
  TrendingUp, Clock, BarChart3, Cpu,
  Target, UserCheck, XCircle, CheckCircle2,
  Loader2, Circle, Shield, StopCircle,
  ChevronUp, ChevronDown, ChevronsUpDown,
  RefreshCw, AlertTriangle, Hash, Layers,
  ArrowUpRight, SquareX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AdminOverview {
  stats: {
    totalUsers: number; totalProjects: number; totalTeams: number;
    totalRuns: number; totalTokens: number; avgTokensPerRun: number;
    errorCount: number; errorRate: string; activeUsersToday: number;
  };
  runsByStatus: { status: string; count: number; tokens: number }[];
  tokensByBlockType: { blockType: string; tokensUsed: number; outputCount: number }[];
  topProjects: { projectId: string; name: string; totalTokens: number; runCount: number }[];
  recentUsers: {
    id: string; email: string | null; name: string | null;
    createdAt: string; lastRunAt: string | null;
    totalTokensUsed: number; runCount: number; projectCount: number;
  }[];
  recentRuns: {
    id: string; prompt: string; status: string;
    totalTokens: number; blockCount: number; createdAt: string;
    user: { email: string | null; name: string | null } | null;
    project: { name: string } | null;
  }[];
}

type SortKey = "name" | "projects" | "runs" | "tokens" | "lastRun" | "joined";
type SortDir = "asc" | "desc";

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_CFG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  done:             { icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.1)",   label: "Done" },
  running:          { icon: Loader2,      color: "#9d8ff5", bg: "rgba(157,143,245,0.1)", label: "Running" },
  failed:           { icon: XCircle,      color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Failed" },
  pending:          { icon: Circle,       color: "#3a3858", bg: "rgba(58,56,88,0.3)",    label: "Pending" },
  pending_approval: { icon: AlertTriangle,color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Approval" },
  approved:         { icon: CheckCircle2, color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  label: "Approved" },
  awaiting_confirm: { icon: Clock,        color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Confirming" },
  skipped:          { icon: Circle,       color: "#5c5a7a", bg: "rgba(92,90,122,0.2)",   label: "Skipped" },
};

const BLOCK_COLORS: Record<string, string> = {
  frontend: "#38bdf8", backend: "#7c6fee", planner: "#f59e0b",
  merge: "#f472b6", database: "#22c55e", api: "#a78bfa",
};

/* ── Section label ──────────────────────────────────────────────────────── */
function SectionLabel({ icon: Icon, label, count, color = "#7c6fee" }: {
  icon: typeof Shield; label: string; count?: string; color?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-5 rounded-full" style={{ background: color }} />
        <Icon className="size-4" style={{ color }} />
        <span className="text-[13px] font-semibold text-[#e8e6ff] tracking-tight">{label}</span>
      </div>
      {count && (
        <span className="text-[11px] text-[#3a3858] font-mono bg-[#0f0f1e] border border-[#1a1a30] px-2.5 py-1 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

/* ── Sort header cell ───────────────────────────────────────────────────── */
function SortTh({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-5 py-3 text-left cursor-pointer select-none whitespace-nowrap group"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-widest transition-colors",
          active ? "text-[#9d8ff5]" : "text-[#3a3858] group-hover:text-[#5c5a7a]"
        )}>
          {label}
        </span>
        {active
          ? dir === "asc"
            ? <ChevronUp className="size-3 text-[#7c6fee]" />
            : <ChevronDown className="size-3 text-[#7c6fee]" />
          : <ChevronsUpDown className="size-3 text-[#2a2a48] group-hover:text-[#3a3858]" />
        }
      </div>
    </th>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function AdminDashboard() {
  const { getToken, isLoaded } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [stoppingRun, setStoppingRun] = useState<string | null>(null);
  const [stoppedRuns, setStoppedRuns] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!isLoaded) return;
    if (showRefresh) setRefreshing(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/overview", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isLoaded]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleStopRun = async (runId: string) => {
    setStoppingRun(runId);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ runId }),
      });
      if (res.ok) {
        setStoppedRuns(prev => new Set([...prev, runId]));
        setData(prev => prev ? {
          ...prev,
          recentRuns: prev.recentRuns.map(r =>
            r.id === runId ? { ...r, status: "failed" } : r
          ),
        } : prev);
      }
    } catch { /* ignore */ } finally {
      setStoppingRun(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-[#7c6fee]/20 blur-xl" />
          <div className="relative w-14 h-14 rounded-2xl bg-[#0d0d1a] border border-[#1e1e38] flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#7c6fee]" />
          </div>
        </div>
        <p className="text-[13px] text-[#5c5a7a] font-medium">Loading admin data…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-48 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0d0d1a] border border-[#1e1e38] flex items-center justify-center">
          <XCircle className="size-6 text-[#2a2a48]" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#9896b8]">Could not load admin data</p>
          <p className="text-[12px] text-[#3a3858] mt-1">Check that the backend server is running</p>
        </div>
      </div>
    );
  }

  const totalBlockTokens = data.tokensByBlockType.reduce((s, b) => s + b.tokensUsed, 0) || 1;
  const totalStatusCount = data.runsByStatus.reduce((s, r) => s + r.count, 0) || 1;

  /* ── Sort users ── */
  const sortedUsers = [...data.recentUsers].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0;
    switch (sortKey) {
      case "name":    av = (a.name ?? a.email ?? ""); bv = (b.name ?? b.email ?? ""); break;
      case "projects":av = a.projectCount; bv = b.projectCount; break;
      case "runs":    av = a.runCount; bv = b.runCount; break;
      case "tokens":  av = a.totalTokensUsed; bv = b.totalTokensUsed; break;
      case "lastRun": av = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
                      bv = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0; break;
      case "joined":  av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
    }
    if (typeof av === "string") {
      return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  return (
    <div className="space-y-10">

      {/* ── Page title bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-none">
            Command Center
          </h1>
          <p className="text-[12px] text-[#4a4870] mt-1.5 font-mono">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Detailed toggle */}
          <button
            onClick={() => setDetailed(d => !d)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-semibold transition-all duration-200",
              detailed
                ? "bg-[#7c6fee]/12 border-[#7c6fee]/30 text-[#9d8ff5]"
                : "bg-transparent border-[#1a1a30] text-[#4a4870] hover:border-[#2a2a48] hover:text-[#7c6fee]"
            )}
          >
            <div className={cn(
              "w-7 h-3.5 rounded-full relative transition-colors duration-200 shrink-0",
              detailed ? "bg-[#7c6fee]" : "bg-[#1a1a30]"
            )}>
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 700, damping: 40 }}
                className={cn("absolute top-0.5 w-2.5 h-2.5 rounded-full shadow",
                  detailed ? "left-[15px] bg-white" : "left-0.5 bg-[#3a3858]"
                )}
              />
            </div>
            Full Detail
          </button>
          {/* Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#1a1a30] text-[11px] font-semibold text-[#4a4870] hover:border-[#7c6fee]/40 hover:text-[#7c6fee] transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Core stats ── */}
      <section>
        <SectionLabel icon={Activity} label="Platform Overview" color="#7c6fee" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Users",   value: fmt(data.stats.totalUsers),         icon: Users,     color: "#9d8ff5", glow: "rgba(157,143,245,0.2)" },
            { label: "Projects",      value: fmt(data.stats.totalProjects),       icon: FolderOpen,color: "#22c55e", glow: "rgba(34,197,94,0.2)"   },
            { label: "Teams",         value: fmt(data.stats.totalTeams),          icon: TrendingUp,color: "#38bdf8", glow: "rgba(56,189,248,0.2)"  },
            { label: "Total Runs",    value: fmt(data.stats.totalRuns),           icon: Activity,  color: "#f59e0b", glow: "rgba(245,158,11,0.2)"  },
            { label: "Total Tokens",  value: fmt(data.stats.totalTokens),         icon: Zap,       color: "#f472b6", glow: "rgba(244,114,182,0.2)" },
            { label: "Active Today",  value: String(data.stats.activeUsersToday), icon: UserCheck, color: "#a78bfa", glow: "rgba(167,139,250,0.2)" },
          ].map(({ label, value, icon: Icon, color, glow }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="relative rounded-2xl overflow-hidden cursor-default group"
              style={{
                background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }} />
              <div className="relative p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#3a3858] font-bold uppercase tracking-[0.12em]">{label}</span>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                    <Icon className="size-3.5" style={{ color }} />
                  </div>
                </div>
                <span className="text-[26px] font-bold text-white tabular-nums leading-none block" style={{ letterSpacing: "-0.02em" }}>
                  {value}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Health metrics ── */}
      <section>
        <SectionLabel icon={Target} label="Health Metrics" color="#22c55e" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Error Rate",
              value: `${data.stats.errorRate}%`,
              sub: `${data.stats.errorCount} failed runs`,
              icon: XCircle,
              color: data.stats.errorCount > 0 ? "#ef4444" : "#22c55e",
            },
            {
              label: "Avg Tokens / Run",
              value: fmt(data.stats.avgTokensPerRun),
              sub: "across all workflow runs",
              icon: BarChart3,
              color: "#7c6fee",
            },
            {
              label: "Success Rate",
              value: data.stats.totalRuns > 0
                ? `${(100 - parseFloat(data.stats.errorRate)).toFixed(1)}%`
                : "—",
              sub: `${(data.stats.totalRuns - data.stats.errorCount).toLocaleString()} completed`,
              icon: Target,
              color: "#22c55e",
            },
            {
              label: "Avg Projects / User",
              value: data.stats.totalUsers > 0
                ? (data.stats.totalProjects / data.stats.totalUsers).toFixed(1)
                : "—",
              sub: `across ${data.stats.totalUsers} users`,
              icon: Cpu,
              color: "#f59e0b",
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label}
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0" style={{ color }} />
                <span className="text-[11px] text-[#5c5a7a] font-medium">{label}</span>
              </div>
              <p className="text-[26px] font-bold tabular-nums leading-none" style={{ color, letterSpacing: "-0.02em" }}>
                {value}
              </p>
              <p className="text-[10px] text-[#2a2a48] font-mono">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Token breakdown + Run status ── */}
      <section>
        <SectionLabel icon={Layers} label="Usage Analytics" color="#38bdf8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Token by block type */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.05]">
              <div className="w-8 h-8 rounded-xl bg-[#f472b6]/10 border border-[#f472b6]/20 flex items-center justify-center">
                <Zap className="size-3.5 text-[#f472b6]" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#e8e6ff]">Token Usage by Agent</p>
                <p className="text-[10px] text-[#3a3858] mt-0.5 font-mono">
                  {fmt(totalBlockTokens)} tokens total
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {data.tokensByBlockType.length === 0 ? (
                <p className="text-[12px] text-[#3a3858] text-center py-10">No block output data yet.</p>
              ) : data.tokensByBlockType.map((b) => {
                const pct = (b.tokensUsed / totalBlockTokens) * 100;
                const color = BLOCK_COLORS[b.blockType.toLowerCase()] ?? "#5c5a7a";
                return (
                  <div key={b.blockType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                        <span className="text-[12px] font-medium text-[#9896b8] capitalize">{b.blockType}</span>
                        <span className="text-[10px] text-[#2a2a48] font-mono">{b.outputCount} outputs</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-[#5c5a7a]">{fmt(b.tokensUsed)}</span>
                        <span className="text-[10px] text-[#3a3858] w-8 text-right font-mono">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[#12122a] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${color}aa, ${color})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Run status + top projects */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.05]">
              <div className="w-8 h-8 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center">
                <BarChart3 className="size-3.5 text-[#f59e0b]" />
              </div>
              <p className="text-[12px] font-semibold text-[#e8e6ff]">Run Status Distribution</p>
            </div>
            <div className="p-6 space-y-4">
              {data.runsByStatus
                .sort((a, b) => b.count - a.count)
                .map((r) => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
                  const StatusIcon = cfg.icon;
                  const pct = (r.count / totalStatusCount) * 100;
                  return (
                    <div key={r.status} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: cfg.bg }}>
                            <StatusIcon className="size-3" style={{ color: cfg.color }} />
                          </div>
                          <span className="text-[12px] font-medium text-[#9896b8]">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[#2a2a48] font-mono">{fmt(r.tokens)} tok</span>
                          <span className="text-[12px] font-bold font-mono text-white w-8 text-right tabular-nums">{r.count}</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-[#12122a] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {data.topProjects.length > 0 && (
              <>
                <div className="px-6 py-4 border-t border-white/[0.05] flex items-center gap-2">
                  <FolderOpen className="size-3.5 text-[#22c55e]" />
                  <span className="text-[11px] font-semibold text-[#e8e6ff]">Top Projects by Tokens</span>
                </div>
                <div className="px-6 pb-6 space-y-3">
                  {data.topProjects.map((p, i) => {
                    const maxT = data.topProjects[0].totalTokens || 1;
                    return (
                      <div key={p.projectId} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#2a2a48] w-4 text-right tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-[#9896b8] truncate">{p.name}</span>
                            <span className="text-[10px] font-mono text-[#5c5a7a] shrink-0 ml-2">{fmt(p.totalTokens)}</span>
                          </div>
                          <div className="h-[3px] rounded-full bg-[#12122a]">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e]/60 to-[#22c55e]"
                              style={{ width: `${(p.totalTokens / maxT) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-[#2a2a48] font-mono w-6 text-right">{p.runCount}r</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Users table ── */}
      <section>
        <SectionLabel icon={Users} label="All Users" count={`${data.recentUsers.length} total`} color="#9d8ff5" />
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-6 py-3.5 text-[10px] font-bold text-[#3a3858] uppercase tracking-widest whitespace-nowrap">
                    #
                  </th>
                  <SortTh label="User" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Projects" sortKey="projects" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Runs" sortKey="runs" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Tokens" sortKey="tokens" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Last Run" sortKey="lastRun" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Joined" sortKey="joined" current={sortKey} dir={sortDir} onSort={handleSort} />
                  {detailed && (
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#5c5a7a] uppercase tracking-widest whitespace-nowrap">
                      Full Email
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, i) => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">

                    {/* Index */}
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-mono text-[#2a2a48]">{i + 1}</span>
                    </td>

                    {/* User */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold"
                          style={{
                            background: `hsl(${(i * 47) % 360} 30% 18%)`,
                            color: `hsl(${(i * 47) % 360} 65% 70%)`,
                            border: `1px solid hsl(${(i * 47) % 360} 30% 28%)`,
                          }}
                        >
                          {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {u.name && (
                            <p className="text-[12px] font-semibold text-[#c8c6e0] group-hover:text-white transition-colors truncate max-w-[160px]">
                              {u.name}
                            </p>
                          )}
                          <p className={cn("text-[10px] text-[#4a4870]", !detailed && "truncate max-w-[160px]")}>
                            {u.email ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Projects */}
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-[13px] font-bold font-mono tabular-nums",
                        u.projectCount > 0 ? "text-[#22c55e]" : "text-[#2a2a48]"
                      )}>
                        {u.projectCount}
                      </span>
                    </td>

                    {/* Runs */}
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-[13px] font-bold font-mono tabular-nums",
                        u.runCount > 0 ? "text-[#9d8ff5]" : "text-[#2a2a48]"
                      )}>
                        {u.runCount}
                      </span>
                    </td>

                    {/* Tokens */}
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-[12px] font-mono tabular-nums",
                        u.totalTokensUsed > 0 ? "text-[#f472b6]" : "text-[#2a2a48]"
                      )}>
                        {u.totalTokensUsed > 0 ? fmt(u.totalTokensUsed) : "—"}
                      </span>
                    </td>

                    {/* Last Run */}
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-[11px] text-[#9896b8] font-mono whitespace-nowrap">{relTime(u.lastRunAt)}</span>
                        {u.lastRunAt && detailed && (
                          <p className="text-[9px] text-[#2a2a48] font-mono mt-0.5 whitespace-nowrap">{fullDate(u.lastRunAt)}</p>
                        )}
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-[11px] text-[#4a4870] font-mono whitespace-nowrap">{relTime(u.createdAt)}</span>
                        {detailed && (
                          <p className="text-[9px] text-[#2a2a48] font-mono mt-0.5 whitespace-nowrap">{fullDate(u.createdAt)}</p>
                        )}
                      </div>
                    </td>

                    {/* Full email (detailed) */}
                    {detailed && (
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-mono text-[#9896b8] select-all whitespace-nowrap">{u.email ?? "—"}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Recent Runs ── */}
      <section>
        <SectionLabel icon={Clock} label="Recent Runs" count={`${data.recentRuns.length} runs`} color="#f59e0b" />
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0c0c1a 0%, #0a0a16 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="divide-y divide-white/[0.04]">
            {data.recentRuns.map((run) => {
              const cfg = STATUS_CFG[run.status] ?? STATUS_CFG.pending;
              const StatusIcon = cfg.icon;
              const isRunning = run.status === "running";
              const isStopping = stoppingRun === run.id;
              const wasStopped = stoppedRuns.has(run.id);

              return (
                <div key={run.id} className="px-6 py-5 hover:bg-white/[0.015] transition-colors group">
                  <div className="flex items-start gap-4">

                    {/* Status icon */}
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: cfg.bg }}>
                      <StatusIcon
                        className={cn("size-3.5", isRunning && !wasStopped && "animate-spin")}
                        style={{ color: cfg.color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                      <div className="min-w-0">
                        {/* Prompt */}
                        <p className="text-[13px] text-[#9896b8] leading-relaxed line-clamp-2 font-medium">
                          {run.prompt}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                          {run.user?.email && (
                            <span className="flex items-center gap-1 text-[10px] text-[#4a4870] font-mono">
                              <Users className="size-2.5" />
                              {run.user.email}
                            </span>
                          )}
                          {run.project && (
                            <span className="flex items-center gap-1 text-[10px] text-[#3a3858] font-mono">
                              <FolderOpen className="size-2.5" />
                              {run.project.name}
                            </span>
                          )}
                          {detailed && (
                            <span className="text-[10px] text-[#2a2a48] font-mono">
                              {run.id.slice(0, 12)}…
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: time + tokens + stop button */}
                      <div className="flex lg:flex-col items-start lg:items-end gap-x-4 gap-y-1 shrink-0">
                        <span className="text-[11px] text-[#4a4870] font-mono whitespace-nowrap">{relTime(run.createdAt)}</span>
                        {detailed && (
                          <span className="text-[9px] text-[#2a2a48] font-mono whitespace-nowrap">{fullDate(run.createdAt)}</span>
                        )}
                        <div className="flex items-center gap-2.5">
                          {run.totalTokens > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-[#3a3858] font-mono">
                              <Zap className="size-2.5" />
                              {fmt(run.totalTokens)}
                            </span>
                          )}
                          {run.blockCount > 0 && (
                            <span className="text-[10px] text-[#2a2a48] font-mono">{run.blockCount}b</span>
                          )}

                          {/* Stop button — only for running runs */}
                          {isRunning && !wasStopped && (
                            <button
                              onClick={() => handleStopRun(run.id)}
                              disabled={!!stoppingRun}
                              title="Force stop this run"
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200",
                                "bg-red-500/10 border border-red-500/25 text-red-400",
                                "hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300",
                                "disabled:opacity-40 disabled:cursor-not-allowed"
                              )}
                            >
                              {isStopping
                                ? <Loader2 className="size-3 animate-spin" />
                                : <SquareX className="size-3" />
                              }
                              {isStopping ? "Stopping…" : "Stop"}
                            </button>
                          )}

                          {wasStopped && (
                            <span className="flex items-center gap-1 text-[10px] text-[#4a4870] font-mono">
                              <CheckCircle2 className="size-3" />
                              Stopped
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
