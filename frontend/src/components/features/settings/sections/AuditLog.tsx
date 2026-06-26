"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Zap, 
  Code, 
  Layers, 
  GitBranch, 
  RefreshCw, 
  AlertTriangle, 
  Download, 
  Filter, 
  Search, 
  ChevronRight, 
  DollarSign, 
  Cpu, 
  Activity,
  History,
  X
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  model: string;
  action: string;
  context: string;
  tokens: number;
  cost: number;
  status: "success" | "warning" | "error";
}

export interface AuditStats {
  totalSpend: number;
  totalTokens: number;
  topModel: string;
}

export interface FilterState {
  model: string;
  action: string;
  search: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_DATA: AuditEntry[] = [
  { id: "1", timestamp: "2024-04-21T14:14:00", model: "Claude 3.5 Sonnet", action: "architecture", context: "Auth module — CLERK AUTH", tokens: 12450, cost: 0.037, status: "success" },
  { id: "2", timestamp: "2024-04-21T14:10:00", model: "GPT-4o", action: "code", context: "generated middleware.ts", tokens: 5200, cost: 0.026, status: "success" },
  { id: "3", timestamp: "2024-04-21T13:55:00", model: "Claude 3.5 Sonnet", action: "architecture", context: "Database module — PRISMA + POSTGRES", tokens: 18900, cost: 0.056, status: "success" },
  { id: "4", timestamp: "2024-04-21T13:30:00", model: "Llama 3 70B", action: "deploy", context: "Vercel preview deploy analyzer", tokens: 3400, cost: 0.002, status: "success" },
  { id: "5", timestamp: "2024-04-21T13:28:00", model: "Claude 3.5 Sonnet", action: "git", context: "feat: add prisma schema analysis", tokens: 1200, cost: 0.004, status: "success" },
  { id: "6", timestamp: "2024-04-20T16:45:00", model: "GPT-4o", action: "code", context: "generated schema.prisma", tokens: 8900, cost: 0.044, status: "success" },
  { id: "7", timestamp: "2024-04-20T16:40:00", model: "Claude 3.5 Sonnet", action: "sync", context: "CraftaStudio App → US-EAST-1", tokens: 450, cost: 0.001, status: "success" },
  { id: "8", timestamp: "2024-04-20T15:22:00", model: "GPT-4o", action: "error", context: "TypeScript: cannot find module 'react' debugger", tokens: 15400, cost: 0.077, status: "warning" },
];

const CHART_DATA_MONTHLY = Array.from({ length: 30 }, (_, i) => ({
  label: `${i + 1}`,
  tokens: Math.floor(100000 + Math.random() * 500000),
  cost: Number((3 + Math.random() * 15).toFixed(2)),
}));

const CHART_DATA_QUARTERLY = [
  { label: "Jan", tokens: 4200000, cost: 125.5 },
  { label: "Feb", tokens: 3800000, cost: 112.2 },
  { label: "Mar", tokens: 5100000, cost: 151.1 },
];

const CHART_DATA_YEARLY = [
  { label: "Jan", tokens: 4200000, cost: 125.5 },
  { label: "Feb", tokens: 3800000, cost: 112.2 },
  { label: "Mar", tokens: 5100000, cost: 151.1 },
  { label: "Apr", tokens: 4800000, cost: 142.2 },
  { label: "May", tokens: 6200000, cost: 185.5 },
  { label: "Jun", tokens: 5900000, cost: 176.2 },
  { label: "Jul", tokens: 6500000, cost: 195.1 },
  { label: "Aug", tokens: 7100000, cost: 214.2 },
  { label: "Sep", tokens: 6800000, cost: 205.5 },
  { label: "Oct", tokens: 7500000, cost: 226.2 },
  { label: "Nov", tokens: 8200000, cost: 248.1 },
  { label: "Dec", tokens: 9100000, cost: 275.2 },
];

// ─── Sub-components ────────────────────────────────────────────────────────

const StatsCard = ({ title, value, subtext, icon: Icon, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[var(--surface)] border border-[var(--border)] p-5 rounded-xl hover:border-[var(--primary-accent)]/30 transition-all duration-300 group"
  >
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 bg-[var(--background)] rounded-lg group-hover:bg-[var(--primary-accent)]/10 transition-colors">
        <Icon className={cn("size-5", color || "text-[var(--primary-accent)]")} />
      </div>
    </div>
    <div>
      <p className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{value}</h3>
      {subtext && <p className="text-[10px] text-[var(--muted-foreground)] font-medium mt-1">{subtext}</p>}
    </div>
  </motion.div>
);

const InlineFilterPanel = ({ isOpen, filters, setFilters }: any) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-6 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Model Selection</label>
            <select 
              value={filters.model}
              onChange={(e) => setFilters({ ...filters, model: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary-accent)]/50 transition-colors"
            >
              <option value="all">All Models</option>
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
              <option value="GPT-4o">GPT-4o</option>
              <option value="Llama 3 70B">Llama 3 70B</option>
            </select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Action Context</label>
            <select 
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary-accent)]/50 transition-colors"
            >
              <option value="all">All Actions</option>
              <option value="architecture">Architecture</option>
              <option value="code">Code Generation</option>
              <option value="deploy">Deployment</option>
              <option value="git">Version Control</option>
            </select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
              <input 
                type="text" 
                placeholder="Query context..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary-accent)]/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button 
              variant="outline"
              className="w-full md:w-auto h-[34px] text-xs bg-[var(--background)] border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]" 
              onClick={() => {
                setFilters({ model: "all", action: "all", search: "" });
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Main Section ──────────────────────────────────────────────────────────

export function AuditLogSection() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [chartRange, setChartRange] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [filters, setFilters] = useState<FilterState>({
    model: "all",
    action: "all",
    search: ""
  });

  // Simulated data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 800));
        setLogs(MOCK_DATA);
        setError(null);
      } catch (err) {
        setError("Failed to synchronize audit logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(entry => {
      const matchModel = filters.model === "all" || entry.model === filters.model;
      const matchAction = filters.action === "all" || entry.action === filters.action;
      const matchSearch = filters.search === "" || entry.context.toLowerCase().includes(filters.search.toLowerCase());
      return matchModel && matchAction && matchSearch;
    });
  }, [logs, filters]);

  const chartData = useMemo(() => {
    switch (chartRange) {
      case "monthly": return CHART_DATA_MONTHLY;
      case "quarterly": return CHART_DATA_QUARTERLY;
      case "yearly": return CHART_DATA_YEARLY;
      default: return CHART_DATA_MONTHLY;
    }
  }, [chartRange, filters]); // Using filters here ensures it reacts, even if mock data is static.

  const handleExportCSV = () => {
    const headers = ["Date", "Model", "Action", "Context", "Tokens", "Cost"];
    const rows = filteredLogs.map(l => [
      l.timestamp, l.model, l.action, l.context, l.tokens, l.cost
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const actionIcons: Record<string, React.ReactNode> = {
    architecture: <Layers className="size-3.5" />,
    code: <Code className="size-3.5" />,
    deploy: <Zap className="size-3.5" />,
    git: <GitBranch className="size-3.5" />,
    sync: <RefreshCw className="size-3.5" />,
    error: <AlertTriangle className="size-3.5" />,
  };

  return (
    <div className="relative min-h-full bg-gradient-to-br from-[var(--background)] to-[var(--background)] p-1 md:p-1 overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-[var(--primary-accent)]/20 rounded-xl flex items-center justify-center border border-[var(--primary-accent)]/30 shadow-[0_0_15px_rgba(var(--primary-accent-rgb),0.1)]">
              <History className="size-6 text-[var(--primary-accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">Audit Log (API Credits)</h1>
              <p className="text-xs text-[var(--muted-foreground)] font-medium">Monitor real-time resource spend and credit allocation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border text-xs font-semibold rounded-lg transition-all duration-200",
                isFilterOpen 
                  ? "bg-[var(--primary-accent)]/10 border-[var(--primary-accent)]/50 text-[var(--primary-accent)]" 
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--foreground)]"
              )}
            >
              <Filter className="size-3.5" /> Filter
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-xs font-bold text-[var(--background)] rounded-lg transition-all duration-200 shadow-lg"
            >
              <Download className="size-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Inline Filter Section */}
        <InlineFilterPanel 
          isOpen={isFilterOpen} 
          filters={filters}
          setFilters={setFilters}
        />

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard 
            title="Total Spend (This Mo)" 
            value="$142.50" 
            subtext="+12.4% from last month"
            icon={DollarSign}
            color="text-[#00ffa6]"
          />
          <StatsCard 
            title="Total Tokens Sent" 
            value="4.2M" 
            subtext="Across 1,240 requests"
            icon={Cpu}
          />
          <StatsCard 
            title="Top Model Used" 
            value="Claude 3.5 Sonnet" 
            subtext="72% of total volume"
            icon={Activity}
          />
        </div>

        {/* Analytics Section */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Resource Usage Over Time</h3>
            
            <div className="flex items-center gap-6">
              {/* Range Selector */}
              <div className="flex items-center bg-[var(--background)] border border-[var(--border)] rounded-lg p-1">
                {(["monthly", "quarterly", "yearly"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                      chartRange === r 
                        ? "bg-[var(--surface)] text-[var(--primary-accent)] shadow-sm" 
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]/50"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold">
                <div className="flex items-center gap-1.5 text-[var(--primary-accent)]"><div className="size-2 rounded-full bg-[var(--primary-accent)]" /> TOKENS</div>
                <div className="flex items-center gap-1.5 text-[#00ffa6]"><div className="size-2 rounded-full bg-[#00ffa6]" /> COST ($)</div>
              </div>
            </div>
          </div>
          
          <motion.div 
            key={chartRange}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#8b5cf6' : '#7c3aed'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#8b5cf6' : '#7c3aed'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    color: 'var(--foreground)'
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke={theme === 'dark' ? '#8b5cf6' : '#7c3aed'} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTokens)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Table Section */}
        <section className="space-y-4">
          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[var(--muted)]/20 border-b border-[var(--border)]">
                    <th className="px-6 py-4 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Date / Time</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Model</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Action Context</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Tokens</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-[var(--muted)] rounded w-full" /></td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-[var(--muted-foreground)] italic">No activity entries match your current filters.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((entry) => (
                      <tr key={entry.id} className="group hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-[var(--foreground)] font-medium">
                            {new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded bg-[var(--primary-accent)]/10 text-[var(--primary-accent)] text-[10px] font-bold border border-[var(--primary-accent)]/20">
                            {entry.model}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-7 rounded-lg flex items-center justify-center shrink-0 border border-[var(--border)]",
                              entry.action === "error" ? "bg-red-500/10 text-red-400" : "bg-[var(--muted)]/50 text-[var(--primary-accent)]"
                            )}>
                              {actionIcons[entry.action] || <Activity className="size-3.5" />}
                            </div>
                            <div className="text-xs text-[var(--foreground)] font-medium truncate max-w-[200px]">{entry.context}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-[var(--muted-foreground)] font-mono">
                            {entry.tokens.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-xs font-bold text-[#00ffa6] font-mono">
                            ${entry.cost.toFixed(3)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 bg-[var(--muted)]/10 border-t border-[var(--border)] flex items-center justify-between">
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Showing {filteredLogs.length} entries</p>
              <button className="text-[11px] font-bold text-[var(--primary-accent)] hover:text-[var(--primary-accent)]/80 transition-colors flex items-center gap-1">
                View all history <ChevronRight className="size-3" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
