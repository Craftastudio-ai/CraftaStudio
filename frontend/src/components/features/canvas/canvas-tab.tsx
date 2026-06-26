"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ReactFlow, Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, useReactFlow,
  ReactFlowProvider, Node, Edge,
} from "@xyflow/react";
import { useUser, useAuth } from "@clerk/nextjs";
import "@xyflow/react/dist/style.css";
import { apiCall } from "@/lib/apiClient";

import { PlannerNode } from "@/components/features/canvas/planner-node";
import { BlockNode } from "@/components/features/canvas/block-node";
import { UnknownBlockNode } from "@/components/features/canvas/unknown-block";
import { FlowingEdge } from "@/components/features/canvas/flowing-edge";
import { PlanDocPanel, type PlanBlock as PlanDocBlock } from "@/components/features/canvas/plan-doc-panel";
import { BlockInfoPanel } from "@/components/features/canvas/block-info-panel";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { BlockFocusOverlay } from "@/components/features/canvas/block-focus-overlay";
import { CodeViewerModal } from "@/components/features/canvas/code-viewer-modal";
import { EdgeHighlightProvider, useEdgeHighlight } from "@/components/features/canvas/edge-highlight-context";
import { calculateDagreLayout } from "@/utils/layout";
import { CanvasJSONPayload, CanvasBlock, CanvasConnection } from "@/types/canvas";
import { Zap, Download } from "lucide-react";

interface CanvasTabProps {
  isPlanDocOpen: boolean;
  setIsPlanDocOpen: (open: boolean) => void;
  isPlanMode: boolean;
  setActiveTab: (tab: "canvas" | "code" | "preview") => void;
  isPlanGenerated: boolean;
  setIsPlanGenerated: (gen: boolean) => void;
  isChatSidebarOpen?: boolean;
  setIsChatSidebarOpen?: (open: boolean) => void;
  projectId?: string | null;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  onProjectIdChange?: (id: string | null) => void;
  onGenerationComplete?: () => void;
  onRunIdChange?: (runId: string | null) => void;
}

type BlockStatus = "done" | "failed" | "pending" | "running" | "awaiting_confirm" | "idle" | "error";

interface BlockOutput {
  id: string;
  blockId: string;
  blockType: string;
  outputCode: string;
  status: BlockStatus;
  tokensUsed: number;
  errorMsg?: string | null;
}

interface WorkflowRun {
  id: string;
  prompt: string;
  status: "pending" | "running" | "done" | "failed";
  blockOutputs: BlockOutput[];
}

// PlanDocBlock is now imported from plan-doc-panel — re-export the type here for local use
type PlanDoc = {
  title: string;
  summary: string;
  markdown: string;
  blocks: PlanDocBlock[];
  is_chat?: boolean;
  projectId?: string;
  provider?: string;
  llm_model?: string;
  input_tokens?: number;
  output_tokens?: number;
};

function extractPlanErrorMessage(raw: string): string {
  if (!raw.trim()) return "Plan generation failed with an empty response.";

  try {
    const parsed = JSON.parse(raw) as {
      error?: string;
      message?: string;
      detail?: string;
      details?: string;
    };
    return parsed.details || parsed.detail || parsed.message || parsed.error || raw;
  } catch {
    return raw;
  }
}

// Matches exactly what BlockInfoPanel expects
interface BlockInfoData {
  id: string;
  title: string;
  stack: string;
  status: string;
  description?: string;
  files: string[];
  acceptance_criteria?: string[];
  dependencies?: string[];
  estimated_lines?: number;
  type?: string;
  tech_stack?: string[];
  endpoints?: { method: string; route: string; request?: Record<string, unknown>; response?: Record<string, unknown> }[];
  implementation_notes?: string;
}

interface RawBlock {
  id: string;
  blockType: string;
  blockJson: Record<string, unknown>;
}

const MOCK_PAYLOAD: CanvasJSONPayload = {
  blocks: [
    { id: "blk-auth", type: "block", title: "Authentication Module", stack: "Next.js + Clerk", status: "done", subBlocks: [{ id: "sub-auth-1", type: "auth", title: "User Login Flow", status: "done" }, { id: "sub-auth-2", type: "auth", title: "Session Guard", status: "done" }] },
    { id: "blk-db", type: "block", title: "Data Persistence", stack: "PostgreSQL + Prisma", status: "running", subBlocks: [{ id: "sub-db-1", type: "db", title: "Prisma Schema Creation", status: "running" }, { id: "sub-db-2", type: "db", title: "Migration Pipeline", status: "idle" }] },
    { id: "blk-ui", type: "block", title: "Frontend Dashboard", stack: "React + Tailwind", status: "idle", subBlocks: [{ id: "sub-ui-1", type: "ui", title: "Shell Layout", status: "idle" }, { id: "sub-ui-2", type: "ui", title: "Navigation Sidebar", status: "idle" }] },
    { id: "blk-api", type: "block", title: "Inventory API", stack: "Node.js + tRPC", status: "idle", subBlocks: [{ id: "sub-api-1", type: "api", title: "Product Endpoints", status: "idle" }] },
    { id: "blk-legacy", type: "legacy-system", title: "Legacy Gateway", status: "idle" },
  ],
};

function CanvasTabInner({
  isPlanDocOpen, setIsPlanDocOpen, setActiveTab,
  isChatSidebarOpen, setIsChatSidebarOpen, projectId,
  projectName: projectNameProp, onProjectNameChange, onProjectIdChange, onGenerationComplete, onRunIdChange,
}: CanvasTabProps) {
  const { fitView } = useReactFlow();
  const { startNode, finishNode } = useEdgeHighlight();
  const { user } = useUser();
  const { getToken } = useAuth();
  const isDemoMode = user?.primaryEmailAddress?.emailAddress === "demo@craftastudio.com";
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodeTypes = useMemo(() => ({ planner: PlannerNode, block: BlockNode, "legacy-system": UnknownBlockNode }), []);
  const edgeTypes = useMemo(() => ({ flowing: FlowingEdge }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [payload, setPayload] = useState<CanvasJSONPayload>(isDemoMode ? MOCK_PAYLOAD : { blocks: [] });
  const [selectedBlockInfo, setSelectedBlockInfo] = useState<BlockInfoData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [focusedBlock, setFocusedBlock] = useState<Node | null>(null);
  const [isChatMoved, setIsChatMoved] = useState(false);
  // projectName comes from parent (dashboard) so it stays in sync with the active project
  const projectName = projectNameProp ?? "Untitled Project";
  const setProjectName = useCallback((name: string) => {
    onProjectNameChange?.(name);
    // Also persist to backend
    if (!projectId) return;
    getToken().then((token) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ name }),
      }).catch(() => {/* ignore */});
    }).catch(() => {/* ignore */});
  }, [onProjectNameChange, projectId, getToken]);
  const lastPromptRef = useRef<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  const [planDoc, setPlanDoc] = useState<PlanDoc | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isImplementing, setIsImplementing] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [codeViewerBlock, setCodeViewerBlock] = useState<{ id: string; title: string; stack?: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // Pending block to confirm before generation starts
  const [pendingGenerateBlockId, setPendingGenerateBlockId] = useState<string | null>(null);
  const [pendingGenerateBlockTitle, setPendingGenerateBlockTitle] = useState<string>("");

  const [questions, setQuestions] = useState<{ id: string; question: string; options: string[] }[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);

  // ── Conversational discovery state ─────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);



  // WebSocket for live block updates
  useEffect(() => {
    if (!projectId || isDemoMode) return;
    const wsUrl = `${(process.env.NEXT_PUBLIC_API_URL || "").replace("http", "ws")}/api/ws/${projectId}`;
    let ws: WebSocket;
    let shouldReconnect = true;
    const connect = () => {
      if (!shouldReconnect) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => console.log("[WS] Connected to project", projectId);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as { event: string; blockId?: string; status?: BlockStatus; output?: string };
          if (msg.event === "block:status_update" && msg.blockId && msg.status) {
            const { blockId, status, output } = msg;
            setPayload((prev) => {
              const updated = prev.blocks.map((b) => b.id === blockId ? { ...b, status, outputCode: output } : b);
              const allDone = updated.every((b) => b.status === "done" || b.status === "failed");
              if (allDone) { setIsImplementing(false); setTimeout(() => onGenerationComplete?.(), 0); }
              // Note: connections are preserved by spreading prev
              return { ...prev, blocks: updated };
            });
          }
          if (msg.event === "workflow:completed" || msg.event === "workflow:failed") {
            setIsImplementing(false);
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => console.warn("[WS] Connection error — will retry");
      ws.onclose = () => { if (shouldReconnect) setTimeout(connect, 1000); };
    };
    connect();
    return () => { shouldReconnect = false; ws?.close(); wsRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isDemoMode, onGenerationComplete]);

  // Polling fallback when implementing — uses lightweight /status endpoint (no outputCode)
  useEffect(() => {
    if (!isImplementing || !currentRunId || !projectId) return;
    const poll = async () => {
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${apiUrl}/api/workflow/runs/${currentRunId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const run = await res.json() as { id: string; status: string; blockOutputs: { blockId: string; status: string }[] };
        if (run.blockOutputs?.length > 0) {
          setPayload((prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) => {
              const output = run.blockOutputs.find((o) => o.blockId === b.id);
              if (!output) return b;
              return { ...b, status: output.status === "pending" ? "awaiting_confirm" : output.status as any };
            }),
          }));
        }
        if (run.status === "done" || run.status === "failed") {
          setIsImplementing(false);
          setTimeout(() => onGenerationComplete?.(), 0);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [isImplementing, currentRunId, projectId, getToken, onGenerationComplete]);

  // Fetch existing blocks — clear canvas first so old project blocks don't persist
useEffect(() => {
  if (!projectId || isDemoMode) return;

  // Immediately clear canvas when switching projects
  setPayload({ blocks: [] });
  setPlanDoc(null);
  setCurrentRunId(null);
  setIsImplementing(false);

  // Abort controller — cancels stale fetches when projectId changes
  const controller = new AbortController();
  const { signal } = controller;

  const fetchBlocks = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

    // Guard: if apiUrl is empty, bail early with a clear error
    if (!apiUrl) {
      console.error("[fetchBlocks] NEXT_PUBLIC_API_URL is not set");
      return;
    }

    let token: string | null = null;
    try {
      token = await getToken();
    } catch (err) {
      console.error("[fetchBlocks] getToken failed:", err);
      return;
    }

    if (signal.aborted) return;

    // Fetch all 4 independently — a failure on one doesn't kill the others
    const [blocksRes, connectionsRes, runsRes, projectRes] = await Promise.allSettled([
      fetch(`${apiUrl}/api/blocks?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }),
      fetch(`${apiUrl}/api/connections?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }),
      fetch(`${apiUrl}/api/workflow/runs?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }),
      fetch(`${apiUrl}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }),
    ]);

    if (signal.aborted) return;

    // ── Project / planDoc ────────────────────────────────────────────────
    let loadedProject: any = null;
    if (projectRes.status === "fulfilled" && projectRes.value.ok) {
      try { loadedProject = await projectRes.value.json(); } catch { /* ignore */ }
    }

    // ── Blocks (required) ────────────────────────────────────────────────
    if (blocksRes.status === "rejected") {
      // Ignore AbortError (project switched), log everything else
      if ((blocksRes.reason as any)?.name !== "AbortError") {
        console.error("[fetchBlocks] blocks fetch failed:", blocksRes.reason);
      }
      return;
    }
    if (!blocksRes.value.ok) {
      console.error("[fetchBlocks] blocks returned", blocksRes.value.status);
      return;
    }

    let blocks: RawBlock[] = [];
    try { blocks = await blocksRes.value.json(); } catch (e) {
      console.error("[fetchBlocks] failed to parse blocks JSON:", e);
      return;
    }

    if (signal.aborted) return;

    if (loadedProject?.planDoc) {
      setPlanDoc({
        title: loadedProject.name ?? "Product Planner",
        summary: loadedProject.planDoc.slice(0, 200),
        markdown: loadedProject.planDoc,
        blocks: blocks.map((b) => ({ id: b.id, ...(b.blockJson as any) })) as PlanDocBlock[],
      });
    }

    if (blocks.length === 0) {
      setPayload({ blocks: [], connections: [] });
      return;
    }

    // ── Workflow runs (optional) ─────────────────────────────────────────
    const outputStatusMap: Record<string, BlockStatus> = {};
    let latestRunId: string | null = null;
    let latestRunStatus: string | null = null;

    if (runsRes.status === "fulfilled" && runsRes.value.ok) {
      try {
        const runs = await runsRes.value.json() as WorkflowRun[];
        const latestRun = runs[0];
        if (latestRun) {
          latestRunId = latestRun.id;
          latestRunStatus = latestRun.status;
          latestRun.blockOutputs?.forEach((o) => {
            outputStatusMap[o.blockId] = o.status === "pending" ? "awaiting_confirm" : o.status;
          });
        }
      } catch { /* non-fatal */ }
    }

    if (latestRunId) { setCurrentRunId(latestRunId); onRunIdChange?.(latestRunId); }

    // ── Connections (optional) ───────────────────────────────────────────
    let loadedConnections: CanvasConnection[] = [];
    if (connectionsRes.status === "fulfilled" && connectionsRes.value.ok) {
      try {
        const rawConns = await connectionsRes.value.json() as {
          id: string; fromBlockId: string; toBlockId: string; connectionType?: string
        }[];
        loadedConnections = rawConns.map((c) => ({
          id: c.id,
          fromBlockId: c.fromBlockId,
          toBlockId: c.toBlockId,
          connectionType: c.connectionType,
        }));
      } catch { /* non-fatal */ }
    }

    if (signal.aborted) return;

    setPayload({
      blocks: blocks.map((b) => ({
        id: b.id,
        type: b.blockType,
        title: (b.blockJson?.title as string) || "Untitled Block",
        stack: (b.blockJson?.stack as string) || "Default Stack",
        description: (b.blockJson?.description as string) || "",
        files: (b.blockJson?.files as string[]) || [],
        acceptance_criteria: (b.blockJson?.acceptance_criteria as string[]) || [],
        dependencies: (b.blockJson?.dependencies as string[]) || [],
        estimated_lines: (b.blockJson?.estimated_lines as number) || 0,
        status: outputStatusMap[b.id] ?? ((b.blockJson?.status as CanvasBlock["status"]) || "idle"),
        subBlocks: (b.blockJson?.subBlocks as CanvasBlock["subBlocks"]) || [],
      })),
      connections: loadedConnections,
    });

    if (latestRunStatus === "running" || latestRunStatus === "pending") {
      setIsImplementing(true);
    }
  };

  fetchBlocks();

  // Cleanup: abort any in-flight fetches when projectId changes or component unmounts
  return () => controller.abort();
}, [projectId, isDemoMode, getToken, onRunIdChange]);

  const handlePromptSubmit = useCallback(async (msg: string) => {
    lastPromptRef.current = msg;
    setPayload({ blocks: [] });
    if (isDemoMode) {
      // existing demo mode code
      setIsChatMoved(true);
      setIsChatSidebarOpen?.(false);
      setIsPlanDocOpen(true);
      setPlanDoc(null);
      setIsPlanning(true);
      const prompt = msg.toLowerCase();
      let newBlocks: CanvasBlock[] = [];
      if (prompt.includes("auth") || prompt.includes("login")) {
        newBlocks = [
          { id: "blk-clerk", type: "block", title: "Clerk Integration", stack: "Next.js", status: "idle", subBlocks: [{ id: "s1", type: "feat", title: "OAuth Providers" }] },
          { id: "blk-db-users", type: "block", title: "User Schema", stack: "Prisma", status: "idle", subBlocks: [{ id: "s2", type: "feat", title: "Profile Logic" }] },
        ];
      } else {
        newBlocks = MOCK_PAYLOAD.blocks.slice(0, 4).map((b) => ({ ...b, status: "idle" as const }));
      }
      setTimeout(() => {
        const planBlocks: PlanDocBlock[] = newBlocks.map((b) => ({
          id: b.id,
          type: b.type,
          title: b.title ?? b.id,
          stack: b.stack ?? "",
          status: b.status,
          subBlocks: (b.subBlocks ?? []) as { id: string; type: string; title: string; status: string }[],
        }));
        setPlanDoc({ title: msg.slice(0, 40), summary: "Demo plan. Click Implement This to start.", markdown: `## Overview\n${msg}`, blocks: planBlocks });
        setPayload({ blocks: newBlocks });
        setIsPlanning(false);
      }, 1200);
      return;
    }

    // ── ALL PROMPTS → QUESTIONS FIRST (UI enforces 500 char min before submit) ──
    // Every prompt that reaches this function is guaranteed to be ≥500 chars.
    // Skip the orchestrator entirely — go straight to questions every time.
    const triggerQuestionsFlow = async () => {
      setIsChatLoading(false);
      setChatMessages([]);
      setIsQuestionsLoading(true);
      try {
        const qRes = await apiCall("/api/plan/questions", {
          method: "POST",
          body: JSON.stringify({ prompt: msg }),
          getToken,
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          const fetchedQs = qData.questions || [];
          if (fetchedQs.length > 0) {
            setQuestions(fetchedQs);
            return; // ← Questions shown. Plan generation blocked until user answers.
          }
        }
        // API failed or returned empty — fallback questions ensure user is NEVER skipped past
        setQuestions([
          {
            id: "q-scope",
            question: "What is the primary scope and scale of this project? (e.g., MVP, full product, internal tool)",
            options: ["MVP / Prototype", "Full Production Product", "Internal Tool", "Open Source Project"],
          },
          {
            id: "q-stack",
            question: "Do you have a preferred tech stack or should the AI choose the best one?",
            options: ["AI should choose the best stack", "I have specific stack preferences", "Stick to what's described in the prompt", "Open to suggestions"],
          },
          {
            id: "q-priority",
            question: "What is most important to you in this project?",
            options: ["Clean architecture & scalability", "Speed of delivery", "Security & compliance", "Cost efficiency"],
          },
        ]);
      } catch (err) {
        console.error("[CanvasTab] Failed to fetch questions:", err);
        // Even on network error, show fallback — planning is NEVER skipped
        setQuestions([
          {
            id: "q-scope",
            question: "What is the primary scope and scale of this project?",
            options: ["MVP / Prototype", "Full Production Product", "Internal Tool", "Open Source Project"],
          },
          {
            id: "q-stack",
            question: "Do you have a preferred tech stack or should the AI choose?",
            options: ["AI should choose the best stack", "I have specific stack preferences", "Stick to what's described", "Open to suggestions"],
          },
          {
            id: "q-priority",
            question: "What is most important to you in this project?",
            options: ["Clean architecture & scalability", "Speed of delivery", "Security & compliance", "Cost efficiency"],
          },
        ]);
      } finally {
        setIsQuestionsLoading(false);
      }
    };

    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    await triggerQuestionsFlow();
  }, [setIsChatSidebarOpen, setIsPlanDocOpen, isDemoMode, projectId, projectName, getToken]);


  const handleGeneratePlan = useCallback(async (promptMsg: string, currentAnswers: Record<string, string>) => {
    setIsChatMoved(true);
    setIsChatSidebarOpen?.(false);
    setIsPlanDocOpen(true);
    setPlanDoc(null);
    setIsPlanning(true);
    setQuestions(null);

    try {
      // Step 1: Submit job — backend returns { jobId } instantly (no timeout risk)
      const res = await apiCall("/api/plan/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: promptMsg, project_name: projectName, projectId, answers: currentAnswers }),
        getToken,
      });

      if (!res.ok) {
        const rawError = await res.text();
        const errorMessage = extractPlanErrorMessage(rawError);
        setPlanDoc({ title: "Plan generation failed", summary: errorMessage, markdown: `## Plan generation failed\n\n${errorMessage}`, blocks: [], is_chat: true });
        setIsPlanning(false);
        return;
      }

      const jobData = await res.json() as { jobId?: string; status?: string };

      // Legacy: if backend returns a full plan directly (no jobId), handle it
      if (!jobData.jobId) {
        const plan = jobData as any;
        _applyPlanToState(plan);
        setIsPlanning(false);
        return;
      }

      const { jobId } = jobData;
      const lsKey = `crafta_plan_job_${projectId || 'new'}`;
      localStorage.setItem(lsKey, jobId);

      // Step 2: Poll /api/plan/status/:jobId every 3 seconds until done
      let attempts = 0;
      const maxAttempts = 100; // 5 minutes (3s * 100)
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await apiCall(`/api/plan/status/${jobId}`, {
            cache: "no-store",
            getToken,
          });

          if (statusRes.status === 401 || statusRes.status === 403) {
            clearInterval(pollInterval);
            localStorage.removeItem(lsKey);
            setPlanDoc({ title: "Authentication error", summary: "Please sign in again.", markdown: "## Session Expired\n\nYour session has expired or is invalid. Please sign in again.", blocks: [], is_chat: true });
            setIsPlanning(false);
            return;
          }

          if (statusRes.status === 404) {
            // Job expired or not found
            clearInterval(pollInterval);
            localStorage.removeItem(lsKey);
            setPlanDoc({ title: "Plan expired", summary: "Please try again.", markdown: "## Session Expired\n\nPlease try generating your plan again.", blocks: [], is_chat: true });
            setIsPlanning(false);
            return;
          }

          if (statusRes.status === 500) {
            clearInterval(pollInterval);
            localStorage.removeItem(lsKey);
            const errData = await statusRes.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
            const errMsg = errData.error ?? "Unknown internal error";
            setPlanDoc({ title: "Plan generation failed", summary: errMsg, markdown: `## Generation Failed\n\n${errMsg}`, blocks: [], is_chat: true });
            setIsPlanning(false);
            return;
          }

          if (!statusRes.ok) return; // transient errors (502, 503, 504), keep polling

          const statusData = await statusRes.json() as { status: string; result?: any; error?: string };

          if (statusData.status === "error") {
            clearInterval(pollInterval);
            localStorage.removeItem(lsKey);
            setPlanDoc({ title: "Plan generation failed", summary: statusData.error ?? "Unknown error", markdown: `## Generation Failed\n\n${statusData.error ?? "Unknown error"}`, blocks: [], is_chat: true });
            setIsPlanning(false);
            return;
          }

          if (statusData.status === "done" && statusData.result) {
            clearInterval(pollInterval);
            localStorage.removeItem(lsKey);
            _applyPlanToState(statusData.result);
            setIsPlanning(false);
          }
        } catch (e) {
          console.error("[CanvasTab] Poll error:", e);
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          localStorage.removeItem(lsKey);
          setPlanDoc({ title: "Plan generation timed out", summary: "Please try again.", markdown: "## Timed Out\n\nPlease try again or simplify your prompt.", blocks: [], is_chat: true });
          setIsPlanning(false);
        }
      }, 3000);

    } catch (err) {
      console.error("[CanvasTab] Failed to generate plan:", err);
      setPlanDoc({ title: "Plan generation failed", summary: String(err), markdown: `## Error\n\n${String(err)}`, blocks: [], is_chat: true });
      setIsPlanning(false);
    }
  }, [setIsChatSidebarOpen, setIsPlanDocOpen, projectId, projectName, onProjectIdChange, getToken]);

  // Helper: apply a completed plan result to React state
  const _applyPlanToState = useCallback((plan: any) => {
    setPlanDoc(plan);
    if (plan.projectId && plan.projectId !== projectId) {
      onProjectIdChange?.(plan.projectId);
    }
    if (plan.blocks?.length > 0) {
      const planConns: CanvasConnection[] = (plan as any).graph?.edges
        ?.map((e: any, i: number) => ({
          id: `plan-edge-${i}`,
          fromBlockId: e.source ?? e.from ?? "",
          toBlockId: e.target ?? e.to ?? "",
          connectionType: e.type ?? "dependency",
        }))
        .filter((c: CanvasConnection) => c.fromBlockId && c.toBlockId) ?? [];

      setPayload({
        blocks: plan.blocks.map((b: any) => ({
          id: b.id ?? b.block_id,
          type: b.type ?? b.block_type,
          title: b.title ?? b.block_name,
          stack: b.stack ?? (Array.isArray(b.tech_stack) ? b.tech_stack.join(" + ") : ""),
          layer: b.layer,
          description: b.description ?? b.purpose,
          tech_stack: Array.isArray(b.tech_stack) ? b.tech_stack : (b.stack ? [b.stack] : []),
          files: Array.isArray(b.files) ? b.files : [],
          api_endpoints: Array.isArray(b.api_endpoints) ? b.api_endpoints : [],
          env_vars: Array.isArray(b.env_vars) ? b.env_vars : [],
          acceptance_criteria: Array.isArray(b.acceptance_criteria) ? b.acceptance_criteria : [],
          dependencies: Array.isArray(b.dependencies) ? b.dependencies : [],
          estimated_lines: b.estimated_lines ?? 0,
          status: "idle" as const,
          subBlocks: b.subBlocks as CanvasBlock["subBlocks"],
        })),
        connections: planConns,
      });

      setPlanDoc((prev) => prev ? {
        ...prev,
        blocks: plan.blocks.map((b: any) => ({
          id: b.id ?? b.block_id,
          title: b.title ?? b.block_name,
          type: b.type ?? b.block_type,
          stack: b.stack ?? (Array.isArray(b.tech_stack) ? b.tech_stack.join(" + ") : ""),
          layer: b.layer,
          description: b.description ?? b.purpose,
          tech_stack: Array.isArray(b.tech_stack) ? b.tech_stack : (b.stack ? [b.stack] : []),
          files: Array.isArray(b.files) ? b.files : [],
          api_endpoints: Array.isArray(b.api_endpoints) ? b.api_endpoints : [],
          env_vars: Array.isArray(b.env_vars) ? b.env_vars : [],
          acceptance_criteria: Array.isArray(b.acceptance_criteria) ? b.acceptance_criteria : [],
          dependencies: Array.isArray(b.dependencies) ? b.dependencies : [],
          status: "idle",
          subBlocks: b.subBlocks,
        })),
      } : prev);
    }
  }, [projectId, onProjectIdChange]);

  // Rehydrate plan polling on mount/refresh
  useEffect(() => {
    if (!mounted) return;
    const lsKey = `crafta_plan_job_${projectId || 'new'}`;
    const savedJobId = localStorage.getItem(lsKey);
    if (!savedJobId) return;

    setIsPlanning(true);
    setIsPlanDocOpen(true);
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const statusRes = await apiCall(`/api/plan/status/${savedJobId}`, {
          cache: "no-store",
          getToken,
        });

        if (statusRes.status === 401 || statusRes.status === 403 || statusRes.status === 404 || statusRes.status === 500) {
          clearInterval(pollInterval);
          localStorage.removeItem(lsKey);
          setIsPlanning(false);
          return;
        }

        if (!statusRes.ok) return;

        const statusData = await statusRes.json() as { status: string; result?: any; error?: string };

        if (statusData.status === "error") {
          clearInterval(pollInterval);
          localStorage.removeItem(lsKey);
          setIsPlanning(false);
          return;
        }

        if (statusData.status === "done" && statusData.result) {
          clearInterval(pollInterval);
          localStorage.removeItem(lsKey);
          _applyPlanToState(statusData.result);
          setIsPlanning(false);
        }
      } catch (e) {
        console.error("[CanvasTab] Rehydration poll error:", e);
      }
      if (attempts >= 100) {
        clearInterval(pollInterval);
        localStorage.removeItem(lsKey);
        setIsPlanning(false);
      }
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [mounted, projectId, getToken, _applyPlanToState, setIsPlanDocOpen]);



  const handleImplement = useCallback(() => {
    setIsPlanDocOpen(false);
    setPendingGenerateBlockId("__start__");
  }, []);

  /**
   * Actually start the workflow after user confirmation.
   */
  const handleConfirmStartGeneration = useCallback(async () => {
    setPendingGenerateBlockId(null);
    setIsImplementing(true);
    if (!projectId) { setIsImplementing(false); return; }
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const prompt = lastPromptRef.current || planDoc?.summary || planDoc?.title || "Build this project";

      // Always send canvas blocks as fallbackBlocks so the workflow endpoint
      // can persist them on the fly if the DB is empty for this projectId.
      // This eliminates the race where /api/plan was called before projectId
      // was set, or where blocks failed to persist silently.
      const fallbackBlocks = payload.blocks.map((b) => ({
        blockType: b.type,
        blockJson: {
          id: b.id,
          title: b.title, stack: b.stack, description: b.description,
          status: "idle", subBlocks: b.subBlocks ?? [],
          files: b.files ?? [], acceptance_criteria: b.acceptance_criteria ?? [],
          dependencies: b.dependencies ?? [], estimated_lines: b.estimated_lines ?? 0,
          type: b.type,
        },
      }));

      const res = await fetch(`${apiUrl}/api/workflow/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, prompt, fallbackBlocks }),
      });
      if (res.ok) {
        const data = await res.json() as {
          executionId: string;
          blocks?: { id: string; title: string; type: string }[];
        };

        // executionId is the correct field (not runId)
        const runIdToUse = data.executionId;
        setCurrentRunId(runIdToUse);
        setIsPlanDocOpen(false);
        onRunIdChange?.(runIdToUse);
        setGenerationError(null);

        // Remap canvas block IDs → real DB UUIDs so WS events match correctly.
        // Without this, block:status_update events are silently dropped because
        // the backend broadcasts DB UUIDs but canvas still has canvas IDs.
        if (data.blocks && data.blocks.length > 0) {
          const remappedBlocks = payload.blocks.map(b => {
            const matched = data.blocks!.find(dbB => dbB.title === b.title && dbB.type === b.type);
            return matched ? { ...b, id: matched.id } : b;
          });
          setPayload(prev => ({ ...prev, blocks: remappedBlocks }));
        }

        // Approve all blocks — get a fresh token each time to avoid Clerk expiry mid-loop
        if (data.blocks && data.blocks.length > 0) {
          let approvedCount = 0;
          for (const dbBlock of data.blocks) {
            try {
              const approveToken = await getToken();
              if (!approveToken) throw new Error("Session expired — please sign out and sign back in");
              const approveRes = await fetch(`${apiUrl}/api/workflow/approve/${dbBlock.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${approveToken}` },
                body: JSON.stringify({ projectId, runId: runIdToUse }),
              });
              if (approveRes.ok) approvedCount++;
            } catch (approveErr: any) {
              console.error("[CanvasTab] Approval failed for block", dbBlock.id, approveErr?.message);
              setGenerationError(approveErr?.message ?? "Session expired — please sign out and sign back in to generate code.");
              setIsImplementing(false);
              return;
            }
          }
          console.log(`[CanvasTab] Workflow started: runId=${runIdToUse}, approved=${approvedCount}/${data.blocks.length}`);
        } else {
          console.log(`[CanvasTab] Workflow started: runId=${runIdToUse}, blocks=${data.blocks?.length}`);
        }
      } else {
        const errData = await res.json().catch(() => ({ error: "Failed to start workflow" })) as { error: string };
        setGenerationError(errData.error || "Failed to start workflow");
        setIsImplementing(false);
      }
    } catch (err) {
      console.error("[CanvasTab] Implement failed:", err);
      setGenerationError(err instanceof Error ? err.message : String(err));
      setIsImplementing(false);
    }
  }, [planDoc, projectId, getToken, onGenerationComplete, onRunIdChange, payload.blocks, setIsPlanDocOpen]);

  const handleProceed = async (blockId: string) => {
    if (!currentRunId || !projectId) return;
    setIsConfirming(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/workflow/confirm/${blockId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, runId: currentRunId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("[CanvasTab] Proceed failed:", err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleGenerateBlock = useCallback(async (blockId: string) => {
    if (!projectId) return;
    setPayload((prev) => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, status: "running" as const } : b)
    }));
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      let runIdToUse = currentRunId;
      let blockIdToUse = blockId;

      if (!runIdToUse) {
        // No existing run — need to create one first
        const prompt = lastPromptRef.current || planDoc?.summary || planDoc?.title || "Build this module";
        const fallbackBlocks = payload.blocks.map((b) => ({
          blockType: b.type,
          blockJson: {
            title: b.title, stack: b.stack, description: b.description,
            status: "idle", subBlocks: b.subBlocks ?? [],
            files: b.files ?? [], acceptance_criteria: b.acceptance_criteria ?? [],
            dependencies: b.dependencies ?? [], estimated_lines: b.estimated_lines ?? 0,
            type: b.type,
          },
        }));

        const runToken = await getToken();
        const runRes = await fetch(`${apiUrl}/api/workflow/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${runToken}` },
          body: JSON.stringify({ projectId, prompt, fallbackBlocks }),
        });
        if (!runRes.ok) {
          const errText = await runRes.text();
          throw new Error(`Failed to initialize workflow: ${errText}`);
        }

        const runData = await runRes.json() as {
          executionId: string;
          blocks?: { id: string; title: string; type: string }[];
        };
        runIdToUse = runData.executionId;
        setCurrentRunId(runIdToUse);
        onRunIdChange?.(runIdToUse);

        // Map block ID to real DB UUID
        if (runData.blocks && runData.blocks.length > 0) {
          const currentBlock = payload.blocks.find(b => b.id === blockId);
          if (currentBlock) {
            const matched = runData.blocks.find(dbB => dbB.title === currentBlock.title && dbB.type === currentBlock.type);
            if (matched) blockIdToUse = matched.id;
          }
          const remappedBlocks = payload.blocks.map(b => {
            const matched = runData.blocks!.find(dbB => dbB.title === b.title && dbB.type === b.type);
            return matched ? { ...b, id: matched.id } : b;
          });
          setPayload(prev => ({ ...prev, blocks: remappedBlocks }));
        }
      }

      // Approve the specific block to trigger generation
      const approveToken = await getToken();
      if (!approveToken) throw new Error("Session expired — please sign out and sign back in");
      const approveRes = await fetch(`${apiUrl}/api/workflow/approve/${blockIdToUse}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${approveToken}` },
        body: JSON.stringify({ projectId, runId: runIdToUse }),
      });

      if (!approveRes.ok) {
        const errText = await approveRes.text();
        throw new Error(`Failed to start block generation: ${errText}`);
      }

      setIsImplementing(true);
    } catch (err) {
      console.error("[CanvasTab] Generate block failed:", err);
      setPayload((prev) => ({
        ...prev,
        blocks: prev.blocks.map(b => b.id === blockId ? { ...b, status: "error" as const } : b)
      }));
    }
  }, [projectId, getToken, planDoc, currentRunId, onRunIdChange, payload.blocks]);

  const refreshLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = calculateDagreLayout(payload, { x: -210, y: -80 });
    // Build index map so block nodes get a stable serial number (1, 2, 3…)
    const blockOrder = payload.blocks.map((b) => b.id);

    const hydratedNodes = newNodes.map((node) => {
      if (node.id === "planner") {
        return { ...node, data: { ...node.data, projectName, onProjectNameChange: setProjectName, onPromptSubmit: handlePromptSubmit } };
      }
      const blockIndex = blockOrder.indexOf(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          blockIndex: blockIndex >= 0 ? blockIndex : undefined,
          onInfoClick: (info: any) => setSelectedBlockInfo({
            id: info.id,
            title: info.title ?? "Untitled Block",
            stack: info.stack ?? "",
            status: info.status ?? "idle",
            description: info.description ?? "",
            files: info.files ?? [],
            acceptance_criteria: info.acceptance_criteria ?? [],
            dependencies: info.dependencies ?? [],
            estimated_lines: info.estimated_lines ?? 0,
            type: info.type ?? "",
          }),
          onViewCode: (block: { id: string; title?: string; stack?: string }) =>
            setCodeViewerBlock({ id: block.id, title: block.title ?? "", stack: block.stack }),
          onGenerateCode: () => handleGenerateBlock(node.id),
          onSubblockClick: () => setActiveTab("code"),
        },
      };
    });
    setNodes(hydratedNodes);
    setEdges(newEdges);
  }, [payload, projectName, setActiveTab, setEdges, setNodes, handlePromptSubmit, handleGenerateBlock]);

  useEffect(() => {
    refreshLayout();
    setTimeout(() => fitView({ duration: 800, padding: 0.3 }), 100);
  }, [payload, refreshLayout, fitView]);

  useEffect(() => {
    if (cycleTimerRef.current) { clearTimeout(cycleTimerRef.current); cycleTimerRef.current = null; }
    const runningBlock = payload.blocks.find((b) => b.status === "running");
    if (runningBlock) {
      startNode(runningBlock.id);
    } else {
      const blockIds = payload.blocks.map((b) => b.id);
      if (blockIds.length === 0) { finishNode(); return; }
      let idx = 0;
      const cycle = () => {
        startNode(blockIds[idx]);
        idx = (idx + 1) % blockIds.length;
        cycleTimerRef.current = setTimeout(() => { finishNode(); cycleTimerRef.current = setTimeout(cycle, 400); }, 1800);
      };
      cycle();
    }
    return () => { if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current); };
  }, [payload, startNode, finishNode]);

  const onNodeClick = (_evt: React.MouseEvent, node: Node) => {
    if (node.type === "block") {
      const blockData = payload.blocks.find(b => b.id === node.id);
      if (blockData) {
        setSelectedBlockInfo({
          id: blockData.id,
          title: blockData.title ?? "Untitled Block",
          stack: blockData.stack ?? "Default Stack",
          status: blockData.status,
          description: blockData.description,
          files: blockData.files ?? [],
          acceptance_criteria: blockData.acceptance_criteria ?? [],
          dependencies: blockData.dependencies ?? [],
          estimated_lines: blockData.estimated_lines ?? 0,
          type: blockData.type
        });
      }
    }
  };

  if (!mounted) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[var(--background)]">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary-accent)] border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  const blockAwaitingConfirm = payload.blocks.find((b) => b.status === "awaiting_confirm");

  const TEMPLATES = [
    { label: "SaaS Boilerplate",       prompt: "Build a SaaS boilerplate with Next.js, Clerk Auth, Stripe subscriptions, and a dashboard." },
    { label: "Real-time Chat",         prompt: "Build a real-time chat application with WebSockets, Redis pub/sub, and message history." },
    { label: "Admin Dashboard",        prompt: "Build an admin dashboard with data tables, charts, user management, and role-based access." },
    { label: "Auth + Billing",         prompt: "Build an authentication and billing system with Clerk, Stripe, and subscription tiers." },
    { label: "E-commerce Storefront",  prompt: "Build a full e-commerce storefront with product catalog, cart, checkout, and Stripe payments." },
    { label: "AI Agent Workflow",      prompt: "Build an AI agent workflow system with LangChain, task queues, and a visual pipeline editor." },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50 dark:bg-[#08080f]">
      {payload.blocks.length === 0 ? (
        <div className={cn(
          "absolute inset-0 flex flex-col z-10 p-6",
          questions ? "items-center justify-start overflow-y-auto pt-10" : "items-center justify-center"
        )}>
          {/* Dot-grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(124,111,238,0.12) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          {/* Purple radial glow */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 800,
              height: 800,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -60%)",
              background: "radial-gradient(ellipse at center, rgba(124,111,238,0.18) 0%, rgba(99,85,212,0.07) 40%, transparent 70%)",
              borderRadius: "50%",
            }}
          />

          <div className="relative max-w-[720px] w-full flex flex-col items-center text-center gap-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-[#2a2a48] bg-white/80 dark:bg-[#111120]/80 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-[#7c6fee] shadow-[0_0_6px_#7c6fee] animate-pulse" />
              <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-[#9896b8] tracking-[0.15em] uppercase">
                AI Architect · Now in Beta
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <h2 className="text-[52px] leading-[1.1] font-bold tracking-tight">
                <span className="text-slate-800 dark:text-[#f0effe]">Describe it. </span>
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #9d8ff5 0%, #7c6fee 50%, #6355d4 100%)" }}
                >
                  We build it.
                </span>
              </h2>
              <p className="text-slate-500 dark:text-[#5c5a7a] text-base max-w-lg mx-auto leading-relaxed">
                Describe your app and our AI architect will plan the full stack, then generate every component block-by-block.
              </p>
            </div>

            {/* Prompt box OR Questions UI */}
            <div className="w-full">
              {isQuestionsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-6 bg-white/60 dark:bg-[#0a0a14]/60 backdrop-blur-2xl border border-slate-200 dark:border-[#ffffff0a] rounded-[24px] shadow-[0_0_80px_rgba(124,111,238,0.05)]">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute size-16 rounded-full bg-[#7c6fee]/20 blur-xl animate-pulse" />
                    <div className="size-8 rounded-full border-[3px] border-[#7c6fee]/30 border-t-[#7c6fee] animate-spin relative z-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-[15px] font-semibold text-slate-800 dark:text-[#f0effe] tracking-tight">Analyzing constraints...</p>
                    <p className="text-[13px] text-slate-500 dark:text-[#9896b8] font-mono tracking-wide">Preparing architect questionnaire</p>
                  </div>
                </div>
              ) : questions && questions.length > 0 ? (
                <div className="flex flex-col gap-4 text-left animate-in fade-in slide-in-from-bottom-6 duration-500 w-full max-w-[720px] mx-auto font-sans">
                  <div className="relative bg-white/70 dark:bg-[#08081a]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-[#ffffff0d] rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.06)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden">
                    {/* Top glow accent */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7c6fee]/60 to-transparent" />
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full bg-[#7c6fee]/10 blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className="relative px-7 pt-6 pb-5 border-b border-slate-100 dark:border-[#ffffff08]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1">
                            {questions.map((_, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "h-1.5 rounded-full transition-all duration-300",
                                  idx < Object.keys(answers).length
                                    ? "bg-[#7c6fee] w-5 shadow-[0_0_8px_rgba(124,111,238,0.6)]"
                                    : idx === Object.keys(answers).length
                                    ? "bg-[#7c6fee]/40 w-3"
                                    : "bg-zinc-700/40 dark:bg-[#1e1e38] w-2"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-mono font-bold text-[#7c6fee] dark:text-[#9d8ff5] uppercase tracking-widest">
                            Architect Questions
                          </span>
                        </div>
                        <span className="text-[12px] font-mono tabular-nums">
                          <span className={cn(
                            "font-bold transition-colors",
                            Object.keys(answers).length === questions.length ? "text-[#7c6fee]" : "text-slate-800 dark:text-[#f0effe]"
                          )}>{Object.keys(answers).length}</span>
                          <span className="text-slate-400 dark:text-[#3a3858]">/{questions.length}</span>
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] text-slate-400 dark:text-[#5c5a7a] leading-relaxed">
                        A few quick questions to craft the most accurate architecture plan for your project.
                      </p>
                    </div>

                    {/* Questions — scrollable */}
                    <div className="overflow-y-auto max-h-[44vh] px-7 py-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#1e1e38] scrollbar-track-transparent">
                      {questions.map((q, i) => (
                        <div key={q.id} className="space-y-3">
                          <p className="text-slate-800 dark:text-[#e8e6ff] font-semibold text-[13.5px] leading-snug flex items-start gap-2">
                            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold bg-[#7c6fee]/15 text-[#7c6fee] dark:text-[#9d8ff5]">
                              {i + 1}
                            </span>
                            {q.question}
                          </p>
                          <div className="flex flex-wrap gap-2 pl-7">
                            {q.options.map((opt) => {
                              const isSelected = answers[q.id] === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-200 border cursor-pointer",
                                    isSelected
                                      ? "bg-[#7c6fee]/12 dark:bg-[#7c6fee]/15 text-[#7c6fee] dark:text-[#c4b9ff] border-[#7c6fee]/50 shadow-[0_0_20px_rgba(124,111,238,0.2)] ring-1 ring-[#7c6fee]/20"
                                      : "bg-white/80 dark:bg-[#0f0f22]/80 text-slate-600 dark:text-[#7a788e] border-slate-200/80 dark:border-[#1a1a2e] hover:border-[#7c6fee]/40 hover:text-slate-900 dark:hover:text-[#e8e6ff] hover:bg-slate-50 dark:hover:bg-[#12122a]"
                                  )}
                                >
                                  <AnimatePresence mode="wait">
                                    {isSelected && (
                                      <motion.span
                                        key="check"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="inline-block mr-1.5 text-[#7c6fee]"
                                      >✓</motion.span>
                                    )}
                                  </AnimatePresence>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer CTA */}
                    <div className="relative px-7 py-5 border-t border-slate-100 dark:border-[#ffffff08] flex items-center justify-between gap-4 bg-gradient-to-r from-transparent via-[#7c6fee]/3 to-transparent dark:via-[#7c6fee]/5">
                      <div className="flex items-center gap-2">
                        {Object.keys(answers).length < questions.length ? (
                          <p className="text-[12px] text-slate-400 dark:text-[#4a4868]">
                            <span className="text-slate-600 dark:text-[#7a788e] font-semibold">{questions.length - Object.keys(answers).length}</span>
                            {" "}question{questions.length - Object.keys(answers).length !== 1 ? "s" : ""} remaining
                          </p>
                        ) : (
                          <p className="text-[12px] text-[#7c6fee] font-semibold flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-[#7c6fee] animate-pulse shadow-[0_0_6px_#7c6fee]" />
                            All answered — ready to generate!
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const prompt = lastPromptRef.current.trim();
                          if (!prompt) return;
                          handleGeneratePlan(prompt, answers);
                        }}
                        disabled={Object.keys(answers).length !== questions.length || isPlanning || !lastPromptRef.current.trim()}
                        className={cn(
                          "flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-[13px] transition-all duration-300 cursor-pointer",
                          Object.keys(answers).length === questions.length && !isPlanning && lastPromptRef.current.trim()
                            ? "bg-[#7c6fee] text-white shadow-[0_4px_24px_rgba(124,111,238,0.5)] hover:shadow-[0_4px_40px_rgba(124,111,238,0.75)] hover:-translate-y-0.5 hover:bg-[#6d5ee0]"
                            : "bg-slate-100 dark:bg-[#12122a] text-slate-400 dark:text-[#3a3858] border border-slate-200 dark:border-[#1a1a2e] cursor-not-allowed"
                        )}
                      >
                        {isPlanning ? (
                          <>
                            <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="size-3.5" />
                            <span>Generate Plan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Conversational Discovery + Prompt Input ─────────── */
                <>
                  {/* Chat messages from conversational discovery */}
                  {chatMessages.length > 0 && (
                    <div className="w-full max-w-[620px] mb-5 space-y-3 animate-in fade-in duration-300 font-sans">
                      {chatMessages.map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            "px-4 py-3 rounded-2xl text-[14px] leading-relaxed max-w-[85%]",
                            m.role === "user"
                              ? "ml-auto bg-[#7c6fee]/10 dark:bg-[#7c6fee]/15 text-slate-800 dark:text-[#f0effe] border border-[#7c6fee]/20"
                              : "mr-auto bg-slate-50 dark:bg-[#111120] text-slate-700 dark:text-[#c8c6e0] border border-slate-200 dark:border-[#1e1e38]"
                          )}
                        >
                          {m.text}
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="mr-auto flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38]">
                          <div className="flex gap-1">
                            <span className="size-1.5 rounded-full bg-[#7c6fee] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="size-1.5 rounded-full bg-[#7c6fee] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="size-1.5 rounded-full bg-[#7c6fee] animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <span className="text-[12px] text-slate-400 dark:text-[#5c5a7a]">Thinking...</span>
                        </div>
                      )}
                    </div>
                  )}
                  <PromptInputBox
                    className="bg-white/80 dark:bg-[#111120]/80 backdrop-blur-xl border border-slate-200 dark:border-[#2a2a48] shadow-[0_0_40px_rgba(124,111,238,0.05)] dark:shadow-[0_0_40px_rgba(124,111,238,0.12)] focus-within:border-[#7c6fee]/50 focus-within:shadow-[0_0_60px_rgba(124,111,238,0.2)]"
                    onSend={handlePromptSubmit}
                  />
                </>
              )}
            </div>

            {/* Tagline */}
            {!questions && !isQuestionsLoading && chatMessages.length === 0 && (
              <>
                <p className="text-[10px] font-mono tracking-[0.2em] text-slate-400 dark:text-[#3a3858] uppercase">
                  No credit card · Groq powered · Deploy in minutes
                </p>

                {/* Template chips */}
                <div className="flex flex-wrap justify-center gap-2 font-sans">
                  {TEMPLATES.map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => handlePromptSubmit(prompt)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium text-slate-500 dark:text-[#9896b8] bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#1e1e38] hover:border-[#7c6fee]/40 dark:hover:border-[#7c6fee]/40 hover:text-slate-800 dark:hover:text-[#f0effe] hover:bg-slate-50 dark:hover:bg-[#16162a] transition-all duration-200 cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2} maxZoom={2}
          className="[&_.react-flow__attribution]:hidden"
          style={{ background: "transparent" }}
        >
          {mounted && (
            <Background
              color="#7c6fee"
              gap={36}
              size={0.7}
              variant={BackgroundVariant.Dots}
              className="opacity-[0.18]"
            />
          )}
          <Controls className="!border-0 !rounded-2xl !shadow-xl !overflow-hidden [&_button]:!border-0 [&_button]:!w-8 [&_button]:!h-8 [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center [&_button]:!transition-colors [&_button]:!duration-150 [&_button_svg]:!w-4 [&_button_svg]:!h-4 [&_button_svg]:!fill-[var(--foreground)] [&_button]:!bg-[var(--surface)] [&_button]:!text-[var(--foreground)] [&_button:hover]:!bg-[var(--primary-accent)]/15 [&_button:hover_svg]:!fill-[var(--primary-accent)]" showInteractive={false} />
          
          <div className="absolute top-4 left-4 z-10 font-sans">
            <button
              onClick={() => { refreshLayout(); setTimeout(() => fitView({ duration: 800 }), 50); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-[#f0effe] bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#2a2a48] hover:border-[#7c6fee]/50 hover:bg-slate-50 dark:hover:bg-[#16162a] shadow-lg transition-all cursor-pointer"
            >
              <Zap className="size-3 text-[#7c6fee]" />
              Auto-Layout
            </button>
          </div>
        </ReactFlow>
      )}

      <PlanDocPanel
        isOpen={isPlanDocOpen}
        onClose={() => setIsPlanDocOpen(false)}
        planDoc={planDoc}
        isLoading={isPlanning}
        onImplement={handleImplement}
        isImplementing={isImplementing}
        onRegenerate={async (promptOrMarkdown) => {
          lastPromptRef.current = promptOrMarkdown;
          setQuestions(null);
          setAnswers({});
          handleGeneratePlan(promptOrMarkdown, {});
        }}
        onSavePlanDoc={async (editedMarkdown) => {
          setPlanDoc(prev => prev ? { ...prev, markdown: editedMarkdown } : null);
          try {
             const token = await getToken();
             const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
             await fetch(`${API_BASE}/api/projects/${projectId}`, {
               method: "PATCH",
               headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
               body: JSON.stringify({ planDoc: editedMarkdown }),
             });
          } catch (e) {
             console.error("Failed to persist plan edit", e);
          }
        }}
      />
      <BlockInfoPanel
        isOpen={!!selectedBlockInfo}
        onClose={() => setSelectedBlockInfo(null)}
        data={selectedBlockInfo ? {
          ...selectedBlockInfo,
          status: payload.blocks.find(b => b.id === selectedBlockInfo.id)?.status ?? selectedBlockInfo.status,
        } : null}
        projectId={projectId}
        isImplementing={!!(selectedBlockInfo && payload.blocks.find(b => b.id === selectedBlockInfo.id)?.status === "running")}
        onImplement={() => { if (selectedBlockInfo) handleGenerateBlock(selectedBlockInfo.id); }}
        onViewCode={() => { if (selectedBlockInfo) { setSelectedBlockInfo(null); setCodeViewerBlock({ id: selectedBlockInfo.id, title: selectedBlockInfo.title ?? "", stack: selectedBlockInfo.stack }); } }}
        onBlockUpdated={(blockId, updatedBlock, action) => {
          // Merge the AI-updated fields back into the canvas payload
          setPayload((prev) => ({
            blocks: prev.blocks.map((b) =>
              b.id === blockId
                ? { ...b, title: (updatedBlock.title as string) ?? b.title, stack: (updatedBlock.stack as string) ?? b.stack }
                : b
            ),
          }));
          // Also refresh the selected block info if it's the same block
          setSelectedBlockInfo((prev) =>
            prev && prev.id === blockId
              ? { ...prev, title: (updatedBlock.title as string) ?? prev.title, stack: (updatedBlock.stack as string) ?? prev.stack }
              : prev
          );
          if (action === "regenerate_block") {
            handleGenerateBlock(blockId);
          }
        }}
      />


      <BlockFocusOverlay block={focusedBlock} onClose={() => setFocusedBlock(null)} onSubblockClick={() => { setFocusedBlock(null); setActiveTab("code"); }} />

      {generationError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-xs backdrop-blur-xl animate-in slide-in-from-top-4 fade-in">
            {generationError}
            <button onClick={() => setGenerationError(null)} className="ml-4 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {blockAwaitingConfirm ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[480px] font-sans">
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#2a2a48] shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 rounded-2xl flex flex-col gap-3 backdrop-blur-xl animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-slate-800 dark:text-white">Code Generated</span>
                <span className="text-[11px] text-slate-500 dark:text-[#9896b8]">Should start with the next block or edit like stuff? Click Proceed to generate next module.</span>
              </div>
              <div className="px-2 py-1 rounded bg-[#7c6fee]/10 text-[#7c6fee] text-[10px] font-bold uppercase tracking-wider border border-[#7c6fee]/20">Review</div>
            </div>
            <button
              onClick={() => handleProceed(blockAwaitingConfirm.id)}
              disabled={isConfirming}
              className="w-full py-2.5 rounded-xl bg-[var(--primary-accent)] text-white font-semibold text-[13px] shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:-translate-y-0.5 cursor-pointer"
            >
              {isConfirming ? (
                <><div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Proceeding...</>
              ) : "Proceed to Next Block"}
            </button>
          </div>
        </div>
      ) : isImplementing && !blockAwaitingConfirm ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[420px] font-sans">
          <div className="bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#2a2a48] shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 rounded-2xl flex items-center justify-between backdrop-blur-xl animate-in slide-in-from-bottom-10 fade-in duration-300">
             <div className="flex items-center gap-3">
               <div className="size-8 rounded-full bg-[#7c6fee]/10 border border-[#7c6fee]/20 flex items-center justify-center">
                 <div className="size-3.5 rounded-full border-[2px] border-[#7c6fee]/30 border-t-[#7c6fee] animate-spin" />
               </div>
               <div className="flex flex-col gap-0.5">
                 <span className="text-sm font-bold text-slate-800 dark:text-white">Generating Architecture...</span>
                 <span className="text-[11px] text-slate-500 dark:text-[#9896b8]">AI is writing code block-by-block.</span>
               </div>
             </div>
             <div className="text-[11px] font-mono text-[#7c6fee] bg-[#7c6fee]/10 px-2 py-1 rounded-md border border-[#7c6fee]/20">
                {payload.blocks.filter(b => b.status === "done").length} / {payload.blocks.length}
             </div>
          </div>
        </div>
      ) : null}

      {/* Download ZIP button — appears when a run has completed blocks */}
      {currentRunId && !isImplementing && payload.blocks.some(b => b.status === "done") && (
        <div className="absolute bottom-6 right-6 z-50">
          <button
            id="download-zip-btn"
            disabled={isDownloading}
            onClick={async () => {
              if (!currentRunId || !projectId) return;
              setIsDownloading(true);
              try {
                const token = await getToken();
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
                const res = await fetch(`${apiUrl}/api/export/${currentRunId}/zip`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: "Download failed" }));
                  setGenerationError((err as any).error ?? "Download failed");
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `craftastudio-${currentRunId.slice(0, 8)}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) {
                setGenerationError(e.message ?? "Download failed");
              } finally {
                setIsDownloading(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#111120] border border-slate-200 dark:border-[#2a2a48] text-slate-550 dark:text-[#9896b8] hover:text-slate-800 dark:hover:text-[#f0effe] hover:border-[#7c6fee]/50 shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(124,111,238,0.2)] transition-all duration-200 text-sm font-medium backdrop-blur-xl disabled:opacity-50 hover:-translate-y-0.5 cursor-pointer"
          >
            {isDownloading ? (
              <div className="size-4 rounded-full border-2 border-[#7c6fee]/30 border-t-[#7c6fee] animate-spin" />
            ) : (
              <Download className="size-4 text-[#7c6fee]" />
            )}
            {isDownloading ? "Preparing ZIP..." : "Download Project"}
          </button>
        </div>
      )}

      {/* Pre-Generation Confirmation Modal removed per user request to strictly enforce one-by-one generation via the side panel */}

      <CodeViewerModal isOpen={!!codeViewerBlock} onClose={() => setCodeViewerBlock(null)} blockId={codeViewerBlock?.id ?? null} blockTitle={codeViewerBlock?.title ?? ""} blockStack={codeViewerBlock?.stack} projectId={projectId ?? null} runId={currentRunId} />
    </div>
  );
}

export function CanvasTab(props: CanvasTabProps) {
  return (
    <EdgeHighlightProvider>
      <ReactFlowProvider>
        <CanvasTabInner {...props} />
      </ReactFlowProvider>
    </EdgeHighlightProvider>
  );
}
