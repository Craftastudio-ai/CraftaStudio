"use client";

import {
  LayoutGrid, FolderOpen, Clock, Settings,
  Plus, X, Check, ChevronRight, Loader2, Search,
  Sparkles, Activity, Zap, ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type SettingsTabId = "account" | "agent" | "projects" | "notifications" | "models" | "customizations" | "tab" | "editor" | "mcp" | "audit";

interface Project {
  id: string;
  name: string;
  teamId: string;
  createdAt: string;
  description?: string | null;
  status?: string;
  totalBlocks?: number;
  completedBlocks?: number;
}

interface Team {
  id: string;
  name: string;
  projects: Project[];
}

interface Session {
  id: string;
  type: string;
  prompt: string;
  model?: string;
  tokensUsed?: number;
  createdAt: string;
}

interface MainSidebarProps {
  activeProjectId?: string | null;
  onProjectSwitch?: (id: string, name: string) => void;
  onOpenSettings: (tab: SettingsTabId) => void;
  onHistoryClick?: () => void;
  isProjectPanelOpen?: boolean;
  setIsProjectPanelOpen?: (open: boolean) => void;
  onSelectRun?: (runId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  planning:   "bg-amber-400",
  generating: "bg-[#9d8ff5] animate-pulse",
  complete:   "bg-[#22c55e]",
  error:      "bg-red-400",
  idle:       "bg-zinc-200 dark:bg-[#2a2a48]",
};

const STATUS_LABEL: Record<string, { text: string; bg: string; dot: string }> = {
  planning:   { text: "text-amber-400",   bg: "bg-amber-500/8 border-amber-500/20",      dot: "bg-amber-400" },
  generating: { text: "text-[#9d8ff5]",   bg: "bg-[#7c6fee]/8 border-[#7c6fee]/20",      dot: "bg-[#9d8ff5] animate-pulse" },
  complete:   { text: "text-[#22c55e]",   bg: "bg-[#22c55e]/8 border-[#22c55e]/20",      dot: "bg-[#22c55e]" },
  error:      { text: "text-red-400",     bg: "bg-red-500/8 border-red-500/20",           dot: "bg-red-400" },
  idle:       { text: "text-zinc-400 dark:text-[#3a3858]",   bg: "bg-zinc-100 dark:bg-[#16162a] border-slate-200 dark:border-[#1e1e38]",           dot: "bg-zinc-200 dark:bg-[#2a2a48]" },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PLAN: { label: "Plan",    color: "text-[#60a5fa]", bg: "bg-[#3b82f6]/8",  border: "border-[#3b82f6]/20" },
  GEN:  { label: "Generate",color: "text-amber-400", bg: "bg-amber-500/8",  border: "border-amber-500/20" },
  EDIT: { label: "Edit",    color: "text-[#9d8ff5]", bg: "bg-[#7c6fee]/8",  border: "border-[#7c6fee]/20" },
};

const NAV_ITEMS = [
  { id: "canvas",   Icon: LayoutGrid, label: "Canvas",   shortcut: null },
  { id: "projects", Icon: FolderOpen,  label: "Projects",  shortcut: null },
  { id: "history",  Icon: Clock,       label: "History",   shortcut: null },
  { id: "settings", Icon: Settings,    label: "Settings",  shortcut: "⌘," },
] as const;

type NavId = typeof NAV_ITEMS[number]["id"];

function NavTooltip({ label, shortcut, children }: { label: string; shortcut: string | null; children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={400}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] text-[11px] font-medium text-zinc-900 dark:text-[#f0effe] shadow-xl select-none animate-in fade-in slide-in-from-left-1 duration-150 z-[999]"
        >
          {label}
          {shortcut && (
            <span className="text-[10px] text-zinc-400 dark:text-[#3a3858] font-mono">{shortcut}</span>
          )}
          <Tooltip.Arrow className="fill-[#1e1e38]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MainSidebar({
  activeProjectId,
  onProjectSwitch,
  onOpenSettings,
  onHistoryClick,
  isProjectPanelOpen: externalIsOpen,
  setIsProjectPanelOpen: externalSetIsOpen,
  onSelectRun,
}: MainSidebarProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const isAdmin = user?.emailAddresses?.[0]?.emailAddress === "pranavgawai1518@gmail.com";
  const [activeNav, setActiveNav] = useState<NavId>("canvas");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"projects" | "history">("projects");
  const [searchQuery, setSearchQuery] = useState("");

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : panelOpen;
  const setIsOpen = (v: boolean) => {
    setPanelOpen(v);
    externalSetIsOpen?.(v);
  };

  const [teams, setTeams] = useState<Team[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { teams: Team[] };
      const fetchedTeams = data.teams ?? [];
      setTeams(fetchedTeams);
      if (fetchedTeams.length > 0) {
        setSelectedTeamId(prev => prev || fetchedTeams[0].id);
      }
    } catch {}
    finally { setLoading(false); }
  }, [getToken]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/history?limit=30&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const rawRuns: any[] = Array.isArray(data) ? data : (data.runs ?? []);
      setSessions(rawRuns.map((r: any) => ({
        id: r.id,
        type: "plan",
        prompt: r.prompt ?? r.project?.name ?? "Untitled session",
        model: undefined,
        tokensUsed: undefined,
        createdAt: r.createdAt,
      })));
    } catch {}
    finally { setLoadingSessions(false); }
  }, [getToken]);

  // Fetch workspace on mount and whenever the panel opens on the projects tab
  useEffect(() => { void fetchWorkspace(); }, [fetchWorkspace]);

  useEffect(() => {
    if (!isOpen) return;
    if (panelTab === "projects") void fetchWorkspace();
    if (panelTab === "history")  void fetchSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, panelTab]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreateError("");
    setCreateLoading(true);
    let teamId = selectedTeamId;
    try {
      if (!teamId) {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/api/workspace`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json() as { teams: Team[] };
          if (data.teams && data.teams.length > 0) {
            teamId = data.teams[0].id;
            setSelectedTeamId(teamId);
          }
        }
      }
      if (!teamId) {
        setCreateError("No workspace found. Please refresh.");
        setCreateLoading(false);
        return;
      }
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newProjectName.trim(), teamId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const errMsg = typeof err.error === "object" ? JSON.stringify(err.error) : (err.error || `Error ${res.status}`);
        setCreateError(errMsg);
        return;
      }
      const proj = await res.json() as Project;
      setNewProjectName("");
      setCreatingProject(false);
      await fetchWorkspace();
      onProjectSwitch?.(proj.id, proj.name);
      setIsOpen(false);
    } catch (e: any) {
      setCreateError(e.message);
    } finally { setCreateLoading(false); }
  };

  const allProjects = teams.flatMap(t => t.projects.map(p => ({ ...p, teamName: t.name })));

  const filteredProjects = allProjects.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSessions = sessions.filter(s =>
    !searchQuery || s.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNavClick = (id: NavId) => {
    if (id === "projects") {
      setActiveNav("projects");
      setPanelTab("projects");
      setSearchQuery("");
      setIsOpen(!isOpen || panelTab !== "projects" ? true : !isOpen);
    } else if (id === "history") {
      setActiveNav("history");
      setPanelTab("history");
      setSearchQuery("");
      setIsOpen(!isOpen || panelTab !== "history" ? true : !isOpen);
      onHistoryClick?.();
    } else if (id === "settings") {
      setIsOpen(false);
      onOpenSettings("account");
    } else {
      setActiveNav(id);
      setIsOpen(false);
    }
  };

  return (
    <Tooltip.Provider>
      <>
        {/* ── Icon Sidebar ── */}
        <nav className="relative h-full w-14 shrink-0 flex flex-col items-center bg-white dark:bg-[#08080f] border-r border-slate-200 dark:border-[#1e1e38] z-50">

          {/* Logo mark */}
          <div className="h-14 flex items-center justify-center w-full border-b border-slate-200 dark:border-[#1e1e38] shrink-0">
            <Image src="/logocrafta.png" alt="CraftaStudio" width={36} height={36} className="rounded-xl transition-transform duration-200 hover:scale-105" />
          </div>

          {/* Nav icons */}
          <div className="flex-1 flex flex-col items-center gap-0.5 py-3 w-full px-2">
            {NAV_ITEMS.map(({ id, Icon, label, shortcut }) => {
              const isActive =
                activeNav === id ||
                (id === "projects" && isOpen && panelTab === "projects") ||
                (id === "history" && isOpen && panelTab === "history");

              return (
                <NavTooltip key={id} label={label} shortcut={shortcut}>
                  <button
                    onClick={() => handleNavClick(id)}
                    className={cn(
                      "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group",
                      isActive
                        ? "bg-[#7c6fee]/12 text-[#9d8ff5]"
                        : "text-zinc-400 dark:text-[#2a2a48] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-white dark:hover:bg-[#111120]"
                    )}
                    style={isActive ? { boxShadow: "0 0 12px rgba(124,111,238,0.12)" } : {}}
                  >
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scaleY: 0, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          exit={{ scaleY: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#7c6fee]"
                          style={{ boxShadow: "0 0 8px #7c6fee, 0 0 16px rgba(124,111,238,0.4)" }}
                        />
                      )}
                    </AnimatePresence>
                    <Icon className="size-4" strokeWidth={isActive ? 2.5 : 1.75} />
                  </button>
                </NavTooltip>
              );
            })}
          </div>

          {/* Active project indicator */}
          {activeProjectId && (
            <div className="w-full px-2 pb-2">
              <NavTooltip label="Active project" shortcut={null}>
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] flex items-center justify-center">
                  <Activity className="size-3.5 text-[#22c55e]" />
                </div>
              </NavTooltip>
            </div>
          )}

          {/* Admin panel icon — only shown for admin user */}
          {isAdmin && (
            <div className="w-full px-2 pb-1">
              <NavTooltip label="Admin Panel" shortcut={null}>
                <button
                  onClick={() => router.push("/admin")}
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 text-[#7c6fee]/60 hover:text-[#9d8ff5] hover:bg-[#7c6fee]/8 group"
                  style={{ boxShadow: "0 0 0 1px rgba(124,111,238,0.1)" }}
                >
                  <ShieldCheck className="size-4" strokeWidth={1.75} />
                </button>
              </NavTooltip>
            </div>
          )}

          {/* User avatar */}
          <div className="h-14 flex items-center justify-center w-full border-t border-slate-200 dark:border-[#1e1e38] shrink-0">
            <div
              className="size-7 rounded-full bg-zinc-100 dark:bg-[#16162a] border border-slate-200 dark:border-[#2a2a48] flex items-center justify-center"
              style={{ boxShadow: "0 0 0 2px rgba(124,111,238,0.08)" }}
            >
              <span className="text-[9px] font-bold text-zinc-600 dark:text-[#9896b8] tracking-tight">ME</span>
            </div>
          </div>
        </nav>

        {/* ── Workspace slide-in panel ── */}
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                key="panel"
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -16, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.08, duration: 0.22 }}
                className="absolute left-14 top-0 h-full w-[320px] z-[49] bg-white dark:bg-[#08080f] border-r border-slate-200 dark:border-[#1e1e38] flex flex-col"
                style={{ boxShadow: "4px 0 48px rgba(0,0,0,0.6)" }}
              >
                {/* Panel header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-[#1e1e38] shrink-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #9d8ff5, #6355d4)" }}
                    >
                      <Sparkles className="size-2.5 text-white" />
                    </div>
                    <span className="text-[12px] font-bold text-zinc-900 dark:text-[#f0effe] tracking-tight">Workspace</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {panelTab === "projects" && (
                      <button
                        onClick={() => { setCreatingProject(true); setNewProjectName(""); setCreateError(""); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#9d8ff5] bg-[#7c6fee]/8 border border-[#7c6fee]/15 hover:bg-[#7c6fee]/15 transition-all"
                      >
                        <Plus className="size-3" strokeWidth={3} /> New
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-[#2a2a48] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-white dark:hover:bg-[#111120] transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tab switcher */}
                <div className="flex items-center gap-1 px-3 py-2.5 border-b border-slate-200 dark:border-[#1e1e38] shrink-0">
                  {(["projects", "history"] as const).map((tab) => {
                    const count = tab === "projects" ? allProjects.length : sessions.length;
                    const isActive = panelTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => { setPanelTab(tab); setSearchQuery(""); }}
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150",
                          isActive
                            ? "text-zinc-900 dark:text-[#f0effe] bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38]"
                            : "text-zinc-400 dark:text-[#3a3858] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-white dark:hover:bg-[#111120]/60"
                        )}
                      >
                        {tab === "projects" ? "Projects" : "History"}
                        {count > 0 && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md text-[9px] font-bold tabular-nums",
                            isActive ? "bg-zinc-200 dark:bg-[#1e1e38] text-zinc-500 dark:text-[#5c5a7a]" : "bg-zinc-100 dark:bg-[#16162a] text-zinc-400 dark:text-[#3a3858]"
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-[#1e1e38] shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-400 dark:text-[#2a2a48]" />
                    <input
                      type="text"
                      placeholder={panelTab === "projects" ? "Search projects…" : "Search history…"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] bg-zinc-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] text-zinc-600 dark:text-[#9896b8] placeholder:text-zinc-400 dark:placeholder:text-[#2a2a48] focus:outline-none focus:border-[#7c6fee]/30 transition-colors"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1e1e38] scrollbar-track-transparent">

                  {/* ── Projects ── */}
                  {panelTab === "projects" && (
                    <>
                      <AnimatePresence>
                        {creatingProject && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 border-b border-slate-200 dark:border-[#1e1e38] space-y-3 bg-zinc-50 dark:bg-[#0d0d1a]">
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-[#3a3858] uppercase tracking-widest">New project</p>
                              <input
                                autoFocus
                                type="text"
                                placeholder="e.g. auth-service..."
                                value={newProjectName}
                                onChange={(e) => { setNewProjectName(e.target.value); setCreateError(""); }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleCreateProject();
                                  if (e.key === "Escape") { setCreatingProject(false); setNewProjectName(""); }
                                }}
                                className="w-full px-3 py-2 rounded-lg text-[12px] font-mono bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] text-zinc-900 dark:text-[#f0effe] placeholder:text-zinc-400 dark:placeholder:text-[#2a2a48] focus:outline-none focus:border-[#7c6fee]/30 transition-colors"
                              />
                              {createError && (
                                <p className="text-[10px] text-red-400 px-1">{createError}</p>
                              )}
                              {teams.length > 1 && (
                                <select
                                  value={selectedTeamId}
                                  onChange={(e) => setSelectedTeamId(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg text-[12px] bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] text-zinc-600 dark:text-[#9896b8] focus:outline-none"
                                >
                                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={handleCreateProject}
                                  disabled={!newProjectName.trim() || createLoading}
                                  className="flex-1 py-2 text-[12px] font-bold rounded-lg bg-[#7c6fee] text-white disabled:opacity-40 hover:bg-[#6355d4] transition-colors flex items-center justify-center gap-1.5"
                                >
                                  {createLoading
                                    ? <><Loader2 className="size-3.5 animate-spin" /> Creating…</>
                                    : "Create project"}
                                </button>
                                <button
                                  onClick={() => { setCreatingProject(false); setNewProjectName(""); }}
                                  className="px-3 py-2 text-[12px] rounded-lg border border-slate-200 dark:border-[#1e1e38] text-zinc-500 dark:text-[#5c5a7a] hover:border-slate-200 dark:hover:border-[#2a2a48] hover:text-zinc-600 dark:hover:text-[#9896b8] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {loading ? (
                        <div className="flex items-center justify-center py-16 gap-2 text-zinc-400 dark:text-[#2a2a48]">
                          <Loader2 className="size-4 animate-spin" />
                          <span className="text-[11px]">Loading projects…</span>
                        </div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] flex items-center justify-center">
                            <FolderOpen className="size-4 text-zinc-400 dark:text-[#2a2a48]" />
                          </div>
                          <p className="text-[11px] text-zinc-400 dark:text-[#3a3858] leading-relaxed">
                            {searchQuery ? "No projects match your search." : "No projects yet.\nCreate one to get started."}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredProjects.map((project) => {
                            const isActive = project.id === activeProjectId;
                            const status = project.status ?? "idle";
                            const total = project.totalBlocks ?? 0;
                            const done = project.completedBlocks ?? 0;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                            const statusMeta = STATUS_LABEL[status] ?? STATUS_LABEL.idle;

                            return (
                              <button
                                key={project.id}
                                onClick={() => { onProjectSwitch?.(project.id, project.name); setIsOpen(false); }}
                                className={cn(
                                  "w-full flex flex-col gap-2 px-3.5 py-3 text-left rounded-xl border transition-all duration-150 group relative overflow-hidden",
                                  isActive
                                    ? "bg-[#7c6fee]/6 border-[#7c6fee]/20"
                                    : "bg-zinc-50 dark:bg-[#0d0d1a] border-slate-200 dark:border-[#1e1e38] hover:border-slate-200 dark:hover:border-[#2a2a48] hover:bg-white dark:hover:bg-[#111120]"
                                )}
                              >
                                {/* Active left rail */}
                                {isActive && (
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full bg-[#7c6fee]"
                                    style={{ boxShadow: "0 0 8px rgba(124,111,238,0.5)" }}
                                  />
                                )}

                                {/* Row 1: name + status badge */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusMeta.dot)} />
                                    <span className={cn(
                                      "text-[12px] font-semibold truncate",
                                      isActive ? "text-zinc-900 dark:text-[#f0effe]" : "text-zinc-700 dark:text-[#c8c6e0] group-hover:text-zinc-900 dark:group-hover:text-[#f0effe] transition-colors"
                                    )}>
                                      {project.name}
                                    </span>
                                    {isActive && <Check className="size-3 text-[#7c6fee] shrink-0" />}
                                  </div>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider shrink-0",
                                    statusMeta.text, statusMeta.bg
                                  )}>
                                    {status}
                                  </span>
                                </div>

                                {/* Progress bar */}
                                {total > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-[2px] rounded-full bg-zinc-200 dark:bg-[#1e1e38] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[#7c6fee] transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-400 dark:text-[#3a3858] shrink-0">{done}/{total}</span>
                                  </div>
                                )}

                                {/* Row 3: meta */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono text-zinc-400 dark:text-[#3a3858]">
                                      {formatRelativeTime(project.createdAt)}
                                    </span>
                                    <span className="text-[9px] text-[#1e1e38]">·</span>
                                    <span className="text-[9px] font-mono text-zinc-400 dark:text-[#2a2a48] truncate max-w-[80px]">{project.teamName}</span>
                                  </div>
                                  <span className="text-[10px] text-[#7c6fee] opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                                    Open <ChevronRight className="size-2.5" />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── History ── */}
                  {panelTab === "history" && (
                    loadingSessions ? (
                      <div className="flex items-center justify-center py-16 gap-2 text-zinc-400 dark:text-[#2a2a48]">
                        <Loader2 className="size-4 animate-spin" />
                        <span className="text-[11px]">Loading history…</span>
                      </div>
                    ) : filteredSessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] flex items-center justify-center">
                          <Clock className="size-4 text-zinc-400 dark:text-[#2a2a48]" />
                        </div>
                        <p className="text-[11px] text-zinc-400 dark:text-[#3a3858]">
                          {searchQuery ? "No sessions match your search." : "No sessions yet."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredSessions.map((s) => {
                          const typeKey = s.type === "plan" ? "PLAN" : s.type === "codegen" ? "GEN" : "EDIT";
                          const meta = TYPE_META[typeKey] ?? TYPE_META.PLAN;
                          return (
                            <button
                              key={s.id}
                              onClick={() => { if (onSelectRun) onSelectRun(s.id); setIsOpen(false); }}
                              className="w-full text-left flex items-start gap-3 px-3.5 py-3 rounded-xl bg-zinc-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] hover:border-slate-200 dark:hover:border-[#2a2a48] hover:bg-white dark:hover:bg-[#111120] transition-all group"
                            >
                              {/* Type badge */}
                              <span className={cn(
                                "mt-0.5 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider shrink-0",
                                meta.color, meta.bg, meta.border
                              )}>
                                {meta.label}
                              </span>

                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-zinc-600 dark:text-[#9896b8] group-hover:text-zinc-700 dark:group-hover:text-[#c8c6e0] line-clamp-2 leading-relaxed transition-colors">
                                  {s.prompt}
                                </p>
                                <div className="flex items-center gap-2.5 mt-2">
                                  <span className="text-[9px] text-zinc-400 dark:text-[#2a2a48] font-mono">
                                    {formatRelativeTime(s.createdAt)}
                                  </span>
                                  {s.tokensUsed && (
                                    <>
                                      <span className="text-[9px] text-[#1e1e38]">·</span>
                                      <span className="flex items-center gap-0.5 text-[9px] text-zinc-400 dark:text-[#2a2a48] font-mono">
                                        <Zap className="size-2.5 text-zinc-400 dark:text-[#3a3858]" />
                                        {s.tokensUsed.toLocaleString()}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </motion.div>

              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[48]"
                onClick={() => setIsOpen(false)}
              />
            </>
          )}
        </AnimatePresence>
      </>
    </Tooltip.Provider>
  );
}
