"use client";

import { LayoutGrid } from "lucide-react";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { StatusBar } from "@/components/layout/status-bar";
import { CanvasTab } from "@/components/features/canvas/canvas-tab";
import { CodeTab } from "@/components/features/editor/code-tab";
import { PreviewTab } from "@/components/features/editor/preview-tab";
import { SettingsPanel } from "@/components/features/settings/settings-panel";
import { MainSidebar } from "@/components/layout/main-sidebar";

export function DashboardClient() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"canvas" | "code" | "preview">("canvas");
  const [isPlanDocOpen, setIsPlanDocOpen] = useState(false);
  const [isPlanMode, setIsPlanMode] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  // Restore last active project from localStorage for persistence across refreshes
  const [projectId, setProjectId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("craftastudio-projectId") ?? null;
  });
  const [projectName, setProjectName] = useState<string>(() => {
    if (typeof window === "undefined") return "Untitled Project";
    return localStorage.getItem("craftastudio-projectName") ?? "Untitled Project";
  });
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isProjectPanelOpen, setIsProjectPanelOpen] = useState(false);

  // Track whether any code has been generated
  const [hasGeneratedOutput, setHasGeneratedOutput] = useState(false);

  // Increments each time a generation run completes — passed to PreviewTab
  // so it can reprovision with the latest code without relying on WebSocket.
  const [generationVersion, setGenerationVersion] = useState(0);

  // Track selected run from history — passed to CodeTab
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Persist active project to localStorage whenever it changes
  useEffect(() => {
    if (projectId) localStorage.setItem("craftastudio-projectId", projectId);
    if (projectName) localStorage.setItem("craftastudio-projectName", projectName);
  }, [projectId, projectName]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Restore last project from localStorage immediately on mount
  useEffect(() => {
    const savedId = localStorage.getItem("craftastudio-projectId");
    const savedName = localStorage.getItem("craftastudio-projectName");
    if (savedId && !projectId) {
      setProjectId(savedId);
      if (savedName) setProjectName(savedName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const syncUser = async () => {
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          console.warn("[Dashboard] Sync timed out — proceeding without projectId");
        }, 30000);

        const res = await fetch(`${apiUrl}/api/auth/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!res.ok) return;

        const wsRes = await fetch(`${apiUrl}/api/workspace`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!wsRes.ok) return;
        const ws = await wsRes.json() as { teams?: { projects?: { id: string; name: string }[] }[] };
        const firstProject = ws?.teams?.[0]?.projects?.[0];
        // Only fall back to first project if nothing is already saved in localStorage
        const existingId = localStorage.getItem("craftastudio-projectId");
        if (firstProject && !existingId) {
          setProjectId(firstProject.id);
          setProjectName(firstProject.name);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[Dashboard] Failed to sync user:", err);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, getToken]);

  const handleProjectSwitch = useCallback((id: string, name: string) => {
    setProjectId(id);
    setProjectName(name);
    localStorage.setItem("craftastudio-projectId", id);
    localStorage.setItem("craftastudio-projectName", name);
    setHasGeneratedOutput(false);
    setSelectedRunId(null);
    setIsPlanDocOpen(false);
    setActiveTab("canvas");
  }, []);

  const handleGenerationComplete = useCallback(() => {
    setHasGeneratedOutput(true);
    setGenerationVersion(v => v + 1);
  }, []);

  const handleSelectRun = useCallback((runId: string) => {
    setCurrentRunId(runId);
    setHasGeneratedOutput(true);
    setActiveTab("code");
  }, []);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MainSidebar
        activeProjectId={projectId}
        onProjectSwitch={handleProjectSwitch}
        onOpenSettings={(tab) => {
          localStorage.setItem("craftastudio-settings-tab", tab);
          setIsSettingsOpen(true);
        }}
        onHistoryClick={() => {}}
        isProjectPanelOpen={isProjectPanelOpen}
        setIsProjectPanelOpen={setIsProjectPanelOpen}
        onSelectRun={handleSelectRun}
      />

      <div className="flex flex-col flex-1 relative overflow-hidden">
        <TopNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isPlanDocOpen={isPlanDocOpen}
          setIsPlanDocOpen={setIsPlanDocOpen}
          isPlanMode={isPlanMode}
          isPlanGenerated={isPlanGenerated}
          onSettingsClick={() => setIsSettingsOpen(true)}
          isChatSidebarOpen={isChatSidebarOpen}
          setIsChatSidebarOpen={setIsChatSidebarOpen}
          onProjectsClick={() => setIsProjectPanelOpen(!isProjectPanelOpen)}
          onHistoryClick={() => {}}
        />

        <main className="flex-1 relative overflow-hidden">
          {/* CanvasTab always mounted — CSS hide/show to preserve state */}
          <div className={activeTab === "canvas" ? "block w-full h-full" : "hidden"}>
            <CanvasTab
              isPlanDocOpen={isPlanDocOpen}
              setIsPlanDocOpen={setIsPlanDocOpen}
              isPlanMode={isPlanMode}
              setActiveTab={setActiveTab}
              isPlanGenerated={isPlanGenerated}
              setIsPlanGenerated={setIsPlanGenerated}
              isChatSidebarOpen={isChatSidebarOpen}
              setIsChatSidebarOpen={setIsChatSidebarOpen}
              projectId={projectId}
              projectName={projectName}
              onProjectNameChange={setProjectName}
              onProjectIdChange={setProjectId}
              onGenerationComplete={handleGenerationComplete}
              onRunIdChange={setCurrentRunId}
            />
          </div>
          <div className={activeTab === "code" ? "block w-full h-full" : "hidden"}>
            <CodeTab projectId={projectId} runId={currentRunId} />
          </div>
          <div className={activeTab === "preview" ? "block w-full h-full" : "hidden"}>
            <PreviewTab projectId={projectId} runId={currentRunId} generationVersion={generationVersion} />
          </div>
        </main>

        <StatusBar hasGeneratedOutput={hasGeneratedOutput} />
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
