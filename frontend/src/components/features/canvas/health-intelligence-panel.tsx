"use client";

import React, { useEffect, useState } from "react";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  History, 
  Zap, 
  ShieldAlert, 
  RefreshCcw,
  BrainCircuit,
  Info,
  DollarSign,
  ShieldCheck,
  Database,
  Network,
  Server,
  Clock,
  Lock,
  Unlock,
  GitCommit,
  ArrowRight,
  User,
  Shield,
  BarChart,
  Target,
  Play,
  Cpu,
  HardDrive,
  Flame,
  ShieldQuestion,
  AlertOctagon,
  Eye
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHealthStore } from "@/lib/store/useHealthStore";

interface HealthIntelligencePanelProps {
  blockId: string;
  blockName: string;
}

export function HealthIntelligencePanel({ blockId, blockName }: HealthIntelligencePanelProps) {
  const { healthData, fetchHealth, setActiveBlock } = useHealthStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    if (blockId) {
      setActiveBlock(blockId);
      fetchHealth(blockId);
      
      const interval = setInterval(() => {
        fetchHealth(blockId);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [blockId, fetchHealth, setActiveBlock]);

  const data = healthData[blockId];

  if (!data) return null;

  const healthScore = data.healthScore;
  const statusColor = 
    healthScore >= 90 ? "text-[#22c55e]" : 
    healthScore >= 70 ? "text-amber-500" : 
    "text-red-500";

  const handleRollback = async () => {
    setIsRollingBack(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004";
    await fetch(`${apiUrl}/api/health/blocks/${blockId}/rollback`, { method: "POST" });
    setTimeout(() => setIsRollingBack(false), 3000);
  };

  const handleSimulate = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004";
    await fetch(`${apiUrl}/api/health/blocks/${blockId}/simulate`, { method: "POST" });
    fetchHealth(blockId);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Pipeline Logic
  const pipelineStates = [
    { id: "IDLE", label: "IDLE" },
    { id: "PENDING", label: "PENDING" },
    { id: "STAGING", label: "STAGING" },
    { id: "CANARY", label: "CANARY" },
    { id: "PROMOTED", label: "LIVE" },
  ];
  
  // Map internal complex states to simpler UI states
  const mappedStatus = 
    data.deploymentStatus === "SMOKE_TESTING" ? "STAGING" : 
    data.deploymentStatus === "MONITORING" ? "CANARY" : 
    data.deploymentStatus;

  const currentStateIndex = pipelineStates.findIndex(s => s.id === mappedStatus);

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-[#1e1e38]/50 space-y-4 pb-8">
      {/* ── TIER 1: ALWAYS VISIBLE ── */}
      
      {/* Header Section */}
      <div className="flex flex-col gap-2 px-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-5 bg-[#7c6fee]/10 rounded flex items-center justify-center border border-[#7c6fee]/20">
              <BrainCircuit className="size-3 text-[#7c6fee]" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-[#f0effe] tracking-[0.1em] uppercase">Deployment Intelligence</span>
          </div>
          <button onClick={handleSimulate} className="p-1 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded text-[#7c6fee] transition-colors">
            <RefreshCcw className="size-3" />
          </button>
        </div>
      </div>

      {/* Deployment Pipeline State Machine */}
      <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[9px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase tracking-widest">Pipeline State</h3>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", 
                mappedStatus === "IDLE" ? "bg-gray-500" : "bg-[#7c6fee]"
              )}></span>
              <span className={cn("relative inline-flex rounded-full h-2 w-2", 
                mappedStatus === "IDLE" ? "bg-gray-500" : "bg-[#7c6fee]"
              )}></span>
            </span>
            <span className="text-[9px] font-mono text-[#7c6fee]">
              {mappedStatus === "IDLE" ? "Inactive" : "Running"}
            </span>
          </div>
        </div>
        
        {/* Progress Line */}
        <div className="flex items-center justify-between relative px-2 mb-3">
          <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-slate-200 dark:bg-[#1e1e38] -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-4 h-[1px] bg-[#7c6fee] -translate-y-1/2 z-0 transition-all duration-1000"
            style={{ width: `calc(${(Math.max(0, currentStateIndex) / (pipelineStates.length - 1)) * 100}% - 32px)` }}
          />
          {pipelineStates.map((state, index) => {
            const isActive = state.id === mappedStatus;
            const isPast = index <= currentStateIndex;
            return (
              <div key={state.id} className="relative z-10 flex flex-col items-center group">
                <div className={cn(
                  "size-2.5 rounded-full border-2 transition-all duration-500",
                  isActive ? "bg-[#7c6fee] border-[#7c6fee] shadow-[0_0_10px_rgba(124,111,238,0.5)]" : 
                  isPast ? "bg-[#7c6fee] border-[#7c6fee]" : 
                  "bg-white dark:bg-[#111120] border-slate-200 dark:border-[#1e1e38]"
                )} />
                <span className={cn(
                  "absolute -bottom-4 text-[7px] font-bold uppercase tracking-widest transition-colors",
                  isActive ? "text-[#7c6fee]" : 
                  isPast ? "text-slate-800 dark:text-white" : 
                  "text-slate-400 dark:text-[#5c5a7a]"
                )}>
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="mt-5 flex items-center justify-between text-[8px] text-slate-500 dark:text-[#5c5a7a] font-mono uppercase px-1">
          <span>Started: {data.stateStartTime ? new Date(data.stateStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Awaiting deployment"}</span>
          {data.deploymentStatus === "PROMOTED" && <span className="text-[#22c55e]">SUCCESS</span>}
        </div>
      </div>

      {/* AI Decision Engine */}
      {data.aiDecision && (
        <div className={cn(
          "bg-slate-50 dark:bg-[#111120] border rounded-xl p-3 shadow-sm relative overflow-hidden",
          data.aiDecision.action === "PROMOTE" ? "border-[#22c55e]/30 bg-[#22c55e]/5 dark:bg-[#22c55e]/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]" :
          data.aiDecision.action === "ROLLBACK" ? "border-red-500/30 bg-red-500/5 dark:bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]" :
          data.aiDecision.action === "HOLD" ? "border-amber-400/30 bg-amber-400/5 dark:bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.1)]" :
          "border-[#7c6fee]/30 bg-[#7c6fee]/5 dark:bg-[#7c6fee]/5 shadow-[0_0_15px_rgba(124,111,238,0.1)]"
        )}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5">
              <BrainCircuit className={cn("size-3", 
                data.aiDecision.action === "PROMOTE" ? "text-[#22c55e]" :
                data.aiDecision.action === "ROLLBACK" ? "text-red-500" :
                data.aiDecision.action === "HOLD" ? "text-amber-500" :
                "text-[#7c6fee]"
              )} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#f0effe]">AI DEPLOYMENT DECISION</span>
            </div>
            <div className="text-[9px] font-mono flex gap-2">
              <span className="text-slate-500 dark:text-[#5c5a7a]">CONF:</span>
              <span className="text-slate-800 dark:text-white">{data.aiDecision.confidence}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-sm font-black uppercase tracking-wider",
              data.aiDecision.action === "PROMOTE" ? "text-[#22c55e]" :
              data.aiDecision.action === "ROLLBACK" ? "text-red-500 dark:text-red-400" :
              data.aiDecision.action === "HOLD" ? "text-amber-500 dark:text-amber-400" :
              "text-[#7c6fee]"
            )}>{data.aiDecision.action}</span>
          </div>
          <div className="space-y-1 mt-1.5">
            <div className="text-[10px] text-slate-700 dark:text-[#9896b8] leading-tight font-medium">
              <span className="text-slate-500 dark:text-[#5c5a7a] font-bold block mb-0.5">REASON:</span>
              "{data.aiDecision.reason}"
            </div>
            {data.aiDecision.recommendation && (
              <div className="text-[10px] text-slate-800 dark:text-white leading-tight font-medium mt-1">
                <span className="text-slate-500 dark:text-[#5c5a7a] font-bold block mb-0.5">RECOMMENDATION:</span>
                {data.aiDecision.recommendation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deployment Reasoning Depth (AI Observation) */}
      {data.explainability && (
        <section className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 relative shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="size-3 text-[#7c6fee]" />
            <h3 className="text-[9px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase tracking-widest">Diagnostic Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded p-2">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-0.5">Root Cause</span>
              <p className="text-[9px] text-slate-800 dark:text-white leading-tight">{data.explainability.cause || "Normal operation"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded p-2">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-0.5">Impact</span>
              <p className="text-[9px] text-slate-800 dark:text-white leading-tight">{data.explainability.impact || "No negative impact"}</p>
            </div>
            <div className="col-span-2 bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded p-2 flex justify-between items-center">
              <div>
                <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-0.5">Recommendation</span>
                <p className="text-[9px] text-[#7c6fee] font-medium leading-tight">{data.explainability.recommendation}</p>
              </div>
              <div className="text-right">
                <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-0.5">Conf</span>
                <span className="text-[10px] font-mono text-slate-800 dark:text-white">{data.explainability.confidence}%</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Real Telemetry Visuals */}
      <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="size-3 text-[#7c6fee]" />
            <h3 className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Telemetry</h3>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[8px] font-mono text-slate-400 dark:text-[#5c5a7a] uppercase">Streaming</span>
          </div>
        </div>
        
        {/* Sparklines */}
        <div className="grid grid-cols-2 gap-2">
          {/* Latency Chart */}
          <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded-lg p-2 h-[60px] flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Latency</span>
              <span className="text-[10px] font-mono text-slate-800 dark:text-white">{data.latencyP95.toFixed(0)}ms</span>
            </div>
            <div className="h-6 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history.slice(-10)}>
                  <Area type="monotone" dataKey="latency" stroke="#7c6fee" fill="#7c6fee" fillOpacity={0.2} strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Error Rate Chart */}
          <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded-lg p-2 h-[60px] flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Error Rate</span>
              <span className={cn("text-[10px] font-mono", data.errorRate > 0 ? "text-amber-500" : "text-[#22c55e]")}>{data.errorRate.toFixed(1)}%</span>
            </div>
            <div className="h-6 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history.slice(-10)}>
                  <Area type="step" dataKey="errorRate" stroke={data.errorRate > 0 ? "#fbbf24" : "#22c55e"} fill={data.errorRate > 0 ? "#fbbf24" : "#22c55e"} fillOpacity={0.2} strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CPU Chart */}
          <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded-lg p-2 h-[60px] flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">CPU Load</span>
              <span className="text-[10px] font-mono text-slate-800 dark:text-white">{data.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="h-6 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history.slice(-10)}>
                  <Line type="monotone" dataKey="cpu" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Memory Pulse Chart */}
          <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded-lg p-2 h-[60px] flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Memory</span>
              <span className="text-[10px] font-mono text-slate-800 dark:text-white">{data.memoryUsage.toFixed(0)}MB</span>
            </div>
            <div className="h-6 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={data.history.slice(-10)}>
                  <Bar dataKey="memory" fill="#c084fc" isAnimationActive={false} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Baseline Comparison Engine */}
      {data.baselineDelta && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] p-2 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[7px] font-bold text-slate-550 dark:text-[#5c5a7a] uppercase block mb-1">Latency</span>
            <span className={cn("text-[9px] font-black font-mono", data.baselineDelta.latency <= 0 ? "text-[#22c55e]" : "text-red-500")}>
              {data.baselineDelta.latency > 0 ? "+" : ""}{data.baselineDelta.latency}%
            </span>
          </div>
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] p-2 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[7px] font-bold text-slate-550 dark:text-[#5c5a7a] uppercase block mb-1">CPU</span>
            <span className={cn("text-[9px] font-black font-mono", data.baselineDelta.cpu <= 0 ? "text-[#22c55e]" : "text-amber-500")}>
              {data.baselineDelta.cpu > 0 ? "+" : ""}{data.baselineDelta.cpu}%
            </span>
          </div>
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] p-2 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[7px] font-bold text-slate-550 dark:text-[#5c5a7a] uppercase block mb-1">Errors</span>
            <span className={cn("text-[8px] font-black font-mono leading-tight", data.baselineDelta.errors <= 0 ? "text-[#22c55e]" : "text-red-500")}>
              {data.baselineDelta.errors > 0 ? `+${data.baselineDelta.errors}%` : "No regression"}
            </span>
          </div>
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] p-2 rounded-lg text-center flex flex-col justify-center">
            <span className="text-[7px] font-bold text-slate-550 dark:text-[#5c5a7a] uppercase block mb-1">Memory</span>
            <span className={cn("text-[9px] font-black font-mono", data.baselineDelta.memory <= 10 ? "text-[#22c55e]" : "text-amber-500")}>
              {data.baselineDelta.memory > 0 ? "+" : ""}{data.baselineDelta.memory}%
            </span>
          </div>
        </div>
      )}

      {/* Upgraded Canary Intelligence */}
      {data.canary && (
        <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="size-3 text-amber-500" />
              <span className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Canary Rollout</span>
            </div>
            <span className="text-[9px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded uppercase">{data.canary.recommendation}</span>
          </div>
          
          <div className="space-y-3 mt-1">
            {/* Traffic Split */}
            <div>
              <div className="flex justify-between items-center text-[8px] font-bold uppercase text-slate-500 dark:text-[#5c5a7a] mb-1">
                <span>Canary Traffic ({data.canary.trafficSplit}%)</span>
                <span>Stable ({100 - data.canary.trafficSplit}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#1e1e38] overflow-hidden flex mb-2">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${data.canary.trafficSplit}%` }} />
                <div className="h-full bg-[#7c6fee] transition-all" style={{ width: `${100 - data.canary.trafficSplit}%` }} />
              </div>
              {/* Rollout Progression Visual */}
              <div className="flex items-center justify-between text-[7px] font-bold text-slate-400 dark:text-[#5c5a7a] font-mono">
                <span className={cn(data.canary.trafficSplit >= 5 ? "text-amber-500" : "")}>5%</span>
                <span className="opacity-50">→</span>
                <span className={cn(data.canary.trafficSplit >= 15 ? "text-amber-500" : "")}>15%</span>
                <span className="opacity-50">→</span>
                <span className={cn(data.canary.trafficSplit >= 35 ? "text-amber-500" : "")}>35%</span>
                <span className="opacity-50">→</span>
                <span className={cn(data.canary.trafficSplit >= 100 ? "text-[#22c55e]" : "")}>100%</span>
              </div>
            </div>
            
            {/* Health Comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded px-2 py-1.5 flex justify-between items-center">
                <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Canary Health</span>
                <span className={cn("text-[10px] font-mono", data.canary.canaryHealth >= 90 ? "text-[#22c55e]" : "text-amber-550")}>{data.canary.canaryHealth}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded px-2 py-1.5 flex justify-between items-center">
                <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Stable Health</span>
                <span className={cn("text-[10px] font-mono", data.canary.stableHealth >= 90 ? "text-[#22c55e]" : "text-amber-555")}>{data.canary.stableHealth}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded px-2 py-1.5 flex justify-between items-center">
                <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Lat Delta</span>
                <span className={cn("text-[10px] font-mono", data.canary.latencyDelta <= 0 ? "text-[#22c55e]" : "text-amber-500")}>{data.canary.latencyDelta > 0 ? "+" : ""}{data.canary.latencyDelta}%</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-100 dark:border-[#1e1e38] rounded px-2 py-1.5 flex justify-between items-center">
                <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Err Delta</span>
                <span className={cn("text-[10px] font-mono", data.canary.errorDelta <= 0 ? "text-[#22c55e]" : "text-red-500")}>{data.canary.errorDelta > 0 ? "+" : ""}{data.canary.errorDelta}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TIER 2: COLLAPSIBLE ENTERPRISE OBSERVABILITY ── */}
      <div className="space-y-1">
        
        {/* Pre-Deploy Risk Intelligence */}
        {data.risk && (
          <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden transition-all">
            <button onClick={() => toggleSection("risk")} className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#111120] dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn("size-3", data.risk.score > 30 ? "text-amber-500" : "text-slate-400 dark:text-[#5c5a7a]")} />
                <span className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Risk Intelligence</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm", 
                  data.risk.level === "High" ? "bg-red-500/10 text-red-500 dark:text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                  data.risk.level === "Medium" ? "bg-amber-500/10 text-amber-550 dark:text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]" :
                  "bg-[#22c55e]/10 text-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                )}>{data.risk.level}</span>
                {expandedSections["risk"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
              </div>
            </button>
            <AnimatePresence>
              {expandedSections["risk"] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                  <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-[#1e1e38]">
                    <div className="grid grid-cols-4 gap-2 text-center mb-3">
                      <div className="bg-white rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] p-1.5">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.risk.schema}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Schema</div>
                      </div>
                      <div className="bg-white rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] p-1.5">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.risk.auth}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Auth</div>
                      </div>
                      <div className="bg-white rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] p-1.5">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.risk.infra}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Infra</div>
                      </div>
                      <div className="bg-white rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] p-1.5">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.risk.flow}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Flow</div>
                      </div>
                    </div>
                    <div className="bg-white rounded p-2 border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38]">
                      <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase mb-1 block">AI Analysis</span>
                      <p className="text-[9px] text-slate-600 dark:text-[#9896b8] leading-tight italic">"{data.risk.explanation}"</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Security Severity Intelligence */}
        {data.security && (
          <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden">
            <button onClick={() => toggleSection("secOps")} className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#111120] dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3 text-[#7c6fee]" />
                <span className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Security Monitoring</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm", 
                  data.security.threatLevel === "CRITICAL" ? "bg-red-500/20 text-red-500 dark:text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                  data.security.threatLevel === "HIGH" ? "bg-red-500/10 text-red-550 dark:text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                  data.security.threatLevel === "MEDIUM" ? "bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]" :
                  "bg-[#22c55e]/10 text-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                )}>{data.security.threatLevel}</span>
                {expandedSections["secOps"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
              </div>
            </button>
            <AnimatePresence>
              {expandedSections["secOps"] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                  <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-[#1e1e38]">
                    <div className="bg-white p-2 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Suspicious Req</span>
                      <span className="text-[10px] text-slate-800 dark:text-white font-mono">{data.security.suspiciousRequests}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Token Abuse</span>
                      <span className="text-[10px] text-slate-800 dark:text-white font-mono">{data.security.tokenAbuse}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">Auth Failure</span>
                      <span className="text-[10px] text-slate-800 dark:text-white font-mono">{(data.security.authFailureRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] flex justify-between items-center">
                      <span className="text-[8px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase">API Abuse</span>
                      <span className="text-[10px] text-slate-800 dark:text-white font-mono">{data.security.apiAbuse}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Staging Validation */}
        {data.stagingChecks && (
          <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden">
            <button onClick={() => toggleSection("staging")} className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#111120] dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3 text-[#22c55e]" />
                <span className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Staging Validation</span>
              </div>
              {expandedSections["staging"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
            </button>
            <AnimatePresence>
              {expandedSections["staging"] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                  <div className="px-3 pb-3 pt-2 space-y-2 border-t border-slate-100 dark:border-[#1e1e38]">
                    {Object.entries(data.stagingChecks).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-600 dark:text-[#9896b8] capitalize">{key} Tests</span>
                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", 
                          value === "PASS" ? "bg-[#22c55e]/10 text-[#22c55e]" : 
                          value === "FAIL" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                        )}>{value}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Database Safety */}
        {data.database && (
          <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden">
            <button onClick={() => toggleSection("db")} className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#111120] dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <Database className="size-3 text-[#38bdf8]" />
                <span className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Database Safety</span>
              </div>
              {expandedSections["db"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
            </button>
            <AnimatePresence>
              {expandedSections["db"] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                  <div className="px-3 pb-3 pt-2 space-y-2 border-t border-slate-100 dark:border-[#1e1e38]">
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white p-1.5 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38]">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.database.slowQueries}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Slow Qry</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38]">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.database.deadlocks}</div>
                        <div className="text-[7px] text-slate-500 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Deadlocks</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38]">
                        <div className="text-[10px] font-mono text-slate-800 dark:text-white">{data.database.lockContention}</div>
                        <div className="text-[7px] text-slate-550 dark:text-[#5c5a7a] uppercase font-bold mt-0.5">Locks</div>
                      </div>
                    </div>
                    <div className="bg-white rounded p-2 border border-slate-200 dark:bg-[#111120] dark:border-[#1e1e38] mt-2 text-center">
                      <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-1">Migration Analysis</span>
                      <p className="text-[9px] text-slate-700 dark:text-[#9896b8] leading-tight italic">"{data.database.migrationAnalysis}"</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── TIER 3: ADVANCED DIAGNOSTICS & OVERRIDES ── */}
      <div className="space-y-1 pt-2">
        
        {/* Audit Trail */}
        {data.audit && data.audit.length > 0 && (
          <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden">
            <button onClick={() => toggleSection("audit")} className="w-full flex items-center justify-between px-3 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <History className="size-3 text-slate-400 dark:text-[#5c5a7a]" />
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#5c5a7a] uppercase tracking-widest">Audit Trail</span>
              </div>
              {expandedSections["audit"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
            </button>
            <AnimatePresence>
              {expandedSections["audit"] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-100 dark:border-[#1e1e38]">
                    <div className="pl-2 border-l border-slate-200 dark:border-l-[#1e1e38] space-y-3 mt-2">
                      {data.audit.map((event, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[11px] top-1 size-1.5 rounded-full bg-slate-400 dark:bg-[#5c5a7a]" />
                          <div className="text-[8px] text-slate-500 dark:text-[#5c5a7a] uppercase font-mono">{new Date(event.timestamp).toLocaleTimeString()} • {event.actor}</div>
                          <div className="text-[10px] text-slate-800 dark:text-white mt-0.5">{event.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Human Overrides */}
        <div className="border border-slate-200 dark:border-[#1e1e38] rounded-lg overflow-hidden">
          <button onClick={() => toggleSection("overrides")} className="w-full flex items-center justify-between px-3 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <User className="size-3 text-slate-400 dark:text-[#5c5a7a]" />
              <span className="text-[9px] font-bold text-slate-400 dark:text-[#5c5a7a] uppercase tracking-widest">Human Overrides</span>
            </div>
            {expandedSections["overrides"] ? <ChevronUp className="size-3 text-slate-400 dark:text-[#5c5a7a]" /> : <ChevronDown className="size-3 text-slate-400 dark:text-[#5c5a7a]" />}
          </button>
          <AnimatePresence>
            {expandedSections["overrides"] && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50 dark:bg-[#0d0d1a]">
                <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-[#1e1e38]">
                  <button className="h-7 bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded text-[8px] font-bold text-slate-850 dark:text-white uppercase hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
                    Force Promote
                  </button>
                  <button className="h-7 bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] rounded text-[8px] font-bold text-[#7c6fee] uppercase hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
                    Extend Monitor
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Enhanced Rollback Readiness System */}
      {data.rollback && (
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-[#1e1e38]/50 bg-white dark:bg-[#111120] rounded-xl p-3 border dark:border-[#1e1e38] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <History className="size-3 text-slate-500 dark:text-[#5c5a7a]" />
              <h3 className="text-[9px] font-bold text-slate-800 dark:text-[#f0effe] uppercase tracking-widest">Rollback Readiness</h3>
            </div>
            <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", 
              data.rollback.readiness ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-red-500/10 text-red-550"
            )}>
              {data.rollback.readiness ? "YES" : "NO"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] p-1.5 rounded flex flex-col">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase mb-0.5">ETA</span>
              <span className="text-[10px] font-mono text-slate-850 dark:text-white">{data.rollback.eta}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] p-1.5 rounded flex flex-col">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase mb-0.5">Version</span>
              <span className="text-[10px] font-mono text-slate-850 dark:text-white">{data.rollback.stableVersion}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] p-1.5 rounded flex flex-col">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase mb-0.5">Conf</span>
              <span className="text-[10px] font-mono text-[#22c55e]">{data.rollback.confidence}%</span>
            </div>
          </div>

          {data.rollback.conditions.length > 0 && (
            <div className="mb-3">
              <span className="text-[7px] font-bold text-slate-500 dark:text-[#5c5a7a] uppercase block mb-1">Trigger Conditions</span>
              <div className="flex gap-1.5 flex-wrap">
                {data.rollback.conditions.map((cond, i) => (
                  <span key={i} className="text-[8px] bg-slate-100 dark:bg-[#1e1e38]/50 border border-slate-200 dark:border-[#1e1e38] text-slate-700 dark:text-[#9896b8] px-1.5 py-0.5 rounded">
                    {cond}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={handleRollback}
            disabled={isRollingBack || !data.rollback.readiness}
            className={cn(
              "w-full h-8 rounded-lg font-bold text-[9px] flex items-center justify-center gap-2 transition-all uppercase tracking-widest cursor-pointer",
              isRollingBack 
                ? "bg-slate-200 dark:bg-[#1e1e38] text-slate-400 dark:text-[#5c5a7a] cursor-not-allowed" 
                : "bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20"
            )}
          >
            {isRollingBack ? <RefreshCcw className="size-3 animate-spin" /> : <AlertOctagon className="size-3" />}
            {isRollingBack ? "Rolling Back..." : `Restore ${data.rollback.stableVersion}`}
          </button>
        </div>
      )}
    </div>
  );
}
