"use client";

import {
  Play, LayoutGrid, Code, Settings, PanelRightClose, PanelRightOpen,
  FileText, Plus, Loader2, X, Zap, Sun, Moon,
} from "lucide-react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";

interface TopNavProps {
  activeTab: "canvas" | "code" | "preview";
  setActiveTab: (tab: "canvas" | "code" | "preview") => void;
  isPlanDocOpen: boolean;
  setIsPlanDocOpen: (open: boolean) => void;
  isPlanMode: boolean;
  isPlanGenerated: boolean;
  onSettingsClick?: () => void;
  isChatSidebarOpen?: boolean;
  setIsChatSidebarOpen?: (open: boolean) => void;
  onProjectsClick?: () => void;
  onHistoryClick?: () => void;
}

export function TopNav({
  activeTab,
  setActiveTab,
  isPlanDocOpen,
  setIsPlanDocOpen,
  isPlanMode,
  isPlanGenerated,
  onSettingsClick,
  isChatSidebarOpen,
  setIsChatSidebarOpen,
  onProjectsClick,
  onHistoryClick,
}: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // New Project modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => setMounted(true), []);

  const handleNewProject = async () => {
    if (!projectName.trim() || isCreating) return;
    setCreateError("");
    setIsCreating(true);
    try {
      const token = await getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

      const wsRes = await fetch(`${API_BASE}/api/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!wsRes.ok) throw new Error("Failed to load workspace");
      const wsData = await wsRes.json();
      const teamId = wsData.teams?.[0]?.id;
      if (!teamId) throw new Error("No team found in workspace");

      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: projectName.trim(), teamId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ? JSON.stringify(err.error) : `Error ${res.status}`);
      }

      const newProject = await res.json();
      if (newProject?.id) {
        localStorage.setItem("craftastudio-projectId", newProject.id);
        localStorage.setItem("craftastudio-projectName", newProject.name || projectName.trim());
      }

      setModalOpen(false);
      setProjectName("");
      window.location.reload();
    } catch (e: any) {
      setCreateError(e.message);
      setIsCreating(false);
    }
  };

  const handlePanelToggle = useCallback(() => {
    setIsChatSidebarOpen?.(!isChatSidebarOpen);
  }, [isChatSidebarOpen, setIsChatSidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        handlePanelToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePanelToggle]);

  const tabs = [
    { id: "canvas" as const, label: "Canvas", Icon: LayoutGrid },
    { id: "code" as const, label: "Code", Icon: Code },
    { id: "preview" as const, label: "Preview", Icon: Play },
  ];

  const PanelIcon = isChatSidebarOpen ? PanelRightClose : PanelRightOpen;

  return (
    <>
      <header className="h-14 flex items-center justify-between px-5 shrink-0 z-50 relative bg-white dark:bg-[#08080f] border-b border-slate-200 dark:border-[#1e1e38]">

        {/* ── Left spacer ── */}
        <div className="min-w-[150px]" />

        {/* ── Center: Premium Tab Navigator ── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-slate-50/50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] p-1 rounded-2xl gap-0.5"
          style={{ boxShadow: "0 0 0 1px rgba(124,111,238,0.02), 0 8px 40px rgba(0,0,0,0.06)" }}>
          {tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="relative flex items-center gap-2 px-5 py-2 rounded-xl transition-colors duration-100 z-10 group"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-xl bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#7c6fee]/20"
                    style={{ boxShadow: "0 0 20px rgba(124,111,238,0.03), inset 0 1px 0 rgba(124,111,238,0.03)" }}
                    transition={{ type: "spring", bounce: 0.12, duration: 0.3 }}
                  />
                )}
                <Icon
                  className={cn(
                    "size-[14px] relative z-10 transition-colors duration-150",
                    isActive ? "text-[#7c6fee] dark:text-[#9d8ff5]" : "text-slate-400 dark:text-[#2a2a48] group-hover:text-slate-600 dark:group-hover:text-[#5c5a7a]"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={cn(
                  "text-[13px] font-semibold relative z-10 tracking-tight transition-colors duration-150",
                  isActive ? "text-slate-900 dark:text-[#f0effe]" : "text-slate-400 dark:text-[#3a3858] group-hover:text-slate-600 dark:group-hover:text-[#9896b8]"
                )}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Right: Controls ── */}
        <div className="flex items-center gap-1.5">

          {/* Canvas panel controls */}
          {activeTab === "canvas" && setIsChatSidebarOpen && (
            <div className="flex items-center gap-1 border-r border-slate-200 dark:border-[#1e1e38] pr-2.5 mr-1">
              <button
                onClick={() => setIsPlanDocOpen(!isPlanDocOpen)}
                title="Architecture Plan"
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 border",
                  isPlanDocOpen
                    ? "text-[#7c6fee] dark:text-[#9d8ff5] bg-[#7c6fee]/10 border-[#7c6fee]/20"
                    : "textslate-400 dark:text-[#3a3858] border-transparent hover:text-[#7c6fee]/70 hover:bg-[#7c6fee]/6 hover:border-[#7c6fee]/10"
                )}
              >
                <FileText className="size-3.5" />
              </button>
            </div>
          )}

          {/* New Project */}
          <button
            onClick={() => { setModalOpen(true); setProjectName(""); setCreateError(""); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-bold text-white transition-all"
            style={{
              background: "#7c6fee",
              boxShadow: "0 0 0 1px rgba(124,111,238,0.4), 0 4px 16px rgba(124,111,238,0.2)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#6a5de0";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 1px rgba(124,111,238,0.6), 0 4px 24px rgba(124,111,238,0.35)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#7c6fee";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 1px rgba(124,111,238,0.4), 0 4px 16px rgba(124,111,238,0.2)";
            }}
          >
            <Plus className="size-3.5" strokeWidth={3} />
            New Project
          </button>

          {/* Theme toggle — premium pill */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="relative flex items-center w-[52px] h-7 rounded-full border border-slate-200 dark:border-[#1e1e38] bg-slate-100 dark:bg-[#0d0d1a] px-0.5 transition-colors duration-300 hover:border-slate-300 dark:hover:border-[#2a2a48] shrink-0"
              style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}
            >
              {/* Sliding pill indicator */}
              <motion.div
                className="absolute size-6 rounded-full shadow-md"
                animate={{ x: theme === "dark" ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                style={{
                  background: theme === "dark"
                    ? "linear-gradient(135deg, #7c6fee, #5a4fd4)"
                    : "linear-gradient(135deg, #fbbf24, #f59e0b)",
                  boxShadow: theme === "dark"
                    ? "0 0 10px rgba(124,111,238,0.4)"
                    : "0 0 10px rgba(251,191,36,0.4)",
                }}
              />
              {/* Sun (left) */}
              <Sun className={cn(
                "size-3 relative z-10 ml-[5px] transition-colors duration-300",
                theme === "light" ? "text-white" : "text-slate-400 dark:text-[#3a3858]"
              )} />
              {/* Moon (right) */}
              <Moon className={cn(
                "size-3 relative z-10 ml-auto mr-[5px] transition-colors duration-300",
                theme === "dark" ? "text-white" : "text-slate-400 dark:text-[#3a3858]"
              )} />
            </button>
          )}

          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label="Settings"
                labelIcon={<Settings className="size-4" />}
                onClick={() => onSettingsClick?.()}
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </header>

      {/* ── New Project Modal ── */}
      <Dialog.Root
        open={modalOpen}
        onOpenChange={(open) => { if (!isCreating) setModalOpen(open); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200]" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-[400px] bg-zinc-50 dark:bg-[#0d0d1a] border border-slate-200 dark:border-[#1e1e38] rounded-2xl p-6 outline-none"
            style={{ boxShadow: "0 0 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,111,238,0.08)" }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Top glow accent */}
            <div className="absolute top-0 inset-x-8 h-px bg-[#7c6fee]/20 rounded-full" />

            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#7c6fee]/10 border border-[#7c6fee]/20 flex items-center justify-center">
                  <Zap className="size-4 text-[#9d8ff5]" />
                </div>
                <div>
                  <Dialog.Title className="text-[15px] font-bold text-zinc-900 dark:text-[#f0effe] tracking-tight">
                    New Project
                  </Dialog.Title>
                  <Dialog.Description className="text-[11px] text-zinc-500 dark:text-[#5c5a7a]">
                    Name your architecture
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-[#3a3858] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a] transition-colors">
                  <X className="size-3.5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-[#3a3858] uppercase tracking-widest mb-1.5 block">
                  Project name
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. auth-service, dashboard-v2..."
                  value={projectName}
                  onChange={(e) => { setProjectName(e.target.value); setCreateError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewProject(); }}
                  className="w-full px-4 py-2.5 rounded-xl text-[13px] font-mono bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] text-zinc-900 dark:text-[#f0effe] placeholder:text-zinc-400 dark:placeholder:text-[#2a2a48] focus:outline-none focus:border-[#7c6fee]/30 focus:bg-[#13132a] transition-all"
                />
              </div>

              {createError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/6 border border-red-500/20">
                  <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  <p className="text-[11px] text-red-400">{createError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleNewProject}
                  disabled={!projectName.trim() || isCreating}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: "#7c6fee", boxShadow: "0 0 20px rgba(124,111,238,0.2)" }}
                >
                  {isCreating ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Creating…</>
                  ) : (
                    <><Plus className="size-3.5" strokeWidth={3} /> Create Project</>
                  )}
                </button>
                <Dialog.Close asChild>
                  <button
                    disabled={isCreating}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#1e1e38] text-zinc-500 dark:text-[#5c5a7a] hover:border-slate-200 dark:hover:border-[#2a2a48] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-white dark:hover:bg-[#111120] text-[13px] font-medium transition-all disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
