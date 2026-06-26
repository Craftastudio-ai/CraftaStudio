"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ChevronRight, ChevronDown, Download, RefreshCw, Copy, CheckCheck,
  AlertCircle, Loader2, FileCode2, Folder, FolderOpen, Circle,
  Terminal, Zap, Package, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockQueuePanel, type QueueBlock } from "@/components/features/canvas/block-queue-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedFile {
  name: string;
  content: string;
  language: string;
  blockTitle?: string;
  isNew?: boolean;
}

interface BlockOutput {
  id: string;
  blockId: string;
  blockType: string;
  outputCode: string;
  status: "pending" | "running" | "done" | "failed";
  errorMsg?: string | null;
  createdAt: string;
}

// ─── Language detection ────────────────────────────────────────────────────────
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", prisma: "prisma", sql: "sql", json: "json",
    css: "css", html: "html", md: "markdown", yaml: "yaml", yml: "yaml",
    sh: "bash", env: "bash",
  };
  return map[ext ?? ""] ?? "typescript";
}

function stripFences(code: string): string {
  return code
    .replace(/^```[a-zA-Z]*\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

function parseOutputIntoFiles(raw: string, blockTitle: string): GeneratedFile[] {
  if (!raw) return [];
  const files: GeneratedFile[] = [];

  // Strategy 1: Markdown fenced blocks with filename comment (// filename: path or // file: path)
  // Matches: ```lang\n// filename: path\ncontent\n```
  const fenceWithFilenameRegex = /```[\w]*\r?\n\/\/\s*(?:filename|file|filepath):\s*([A-Za-z0-9._/\\-]+)\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceWithFilenameRegex.exec(raw)) !== null) {
    const name = match[1].trim().replace(/^\//, '');
    const content = match[2].trim();
    if (content) files.push({ name, content, language: detectLanguage(name), blockTitle });
  }
  if (files.length > 0) return files;

  // Strategy 2: // FILE: headers (old format)
  if (raw.includes("// FILE:")) {
    const fileRegex = /\/\/ FILE:\s*([^\n]+)\n([\s\S]*?)(?=\/\/ FILE:|$)/g;
    while ((match = fileRegex.exec(raw)) !== null) {
      const name = match[1].trim();
      const content = stripFences(match[2].trim());
      if (content) files.push({ name, content, language: detectLanguage(name), blockTitle });
    }
    if (files.length > 0) return files;
  }

  // Strategy 3: Fenced block with no filename comment — use blockTitle as name
  const fenceMatch = raw.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/m);
  if (fenceMatch) {
    const content = fenceMatch[1];
    // Detect extension from content
    const ext = content.includes('<html') ? 'html' : content.includes('React') || content.includes('className=') ? 'tsx' : 'ts';
    const name = `${blockTitle.replace(/\s+/g, "_")}.${ext}`;
    return [{ name, content, language: detectLanguage(name), blockTitle }];
  }

  // Strategy 4: Raw code fallback
  const ext = raw.includes('<html') ? 'html' : raw.includes('React') || raw.includes('className=') ? 'tsx' : 'ts';
  const name = `${blockTitle.replace(/\s+/g, "_")}.${ext}`;
  return [{ name, content: stripFences(raw), language: detectLanguage(name), blockTitle }];
}

// ─── File Tree ─────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  fileIdx?: number;
  isNew?: boolean;
}

function buildTree(files: GeneratedFile[]): TreeNode[] {
  const root: Record<string, any> = {};
  files.forEach((file, idx) => {
    const parts = file.name.split("/");
    let current = root;
    parts.forEach((part, i) => {
      if (!current[part]) current[part] = { __files: [] };
      if (i === parts.length - 1) {
        current[part].__idx = idx;
        current[part].__new = file.isNew;
      } else {
        current = current[part];
      }
    });
  });

  function toNodes(obj: any, prefix: string): TreeNode[] {
    return Object.entries(obj)
      .filter(([k]) => k !== "__files" && k !== "__idx" && k !== "__new")
      .map(([name, val]: any) => {
        const path = prefix ? `${prefix}/${name}` : name;
        if (val.__idx !== undefined) {
          return { name, path, fileIdx: val.__idx, isNew: val.__new };
        }
        return { name, path, children: toNodes(val, path) };
      })
      .sort((a, b) => {
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toNodes(root, "");
}

const FILE_COLORS: Record<string, string> = {
  tsx: "#61afef", jsx: "#61afef",
  ts: "#9d8ff5", js: "#e5c07b",
  css: "#e06c75", py: "#98c379",
  json: "#e5c07b", md: "#abb2bf",
};

function TreeNodeRow({
  node, depth, selectedIdx, onSelect, expandedDirs, toggleDir
}: {
  node: TreeNode; depth: number; selectedIdx: number;
  onSelect: (idx: number) => void;
  expandedDirs: Set<string>; toggleDir: (path: string) => void;
}) {
  const isDir = !!node.children;
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.fileIdx === selectedIdx;

  if (isDir) {
    return (
      <>
        <button
          onClick={() => toggleDir(node.path)}
          className="w-full flex items-center gap-1.5 py-[3px] text-[12px] font-mono transition-colors text-zinc-500 dark:text-[#5c5a7a] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a]/60"
          style={{ paddingLeft: `${10 + depth * 14}px` }}
        >
          {isExpanded ? <ChevronDown size={11} className="shrink-0 text-zinc-400 dark:text-[#3a3858]" /> : <ChevronRight size={11} className="shrink-0 text-zinc-400 dark:text-[#3a3858]" />}
          {isExpanded ? <FolderOpen size={12} className="shrink-0 text-[#9d8ff5]" /> : <Folder size={12} className="shrink-0 text-[#7c6fee]/70" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children!.map(child => (
          <TreeNodeRow key={child.path} node={child} depth={depth + 1}
            selectedIdx={selectedIdx} onSelect={onSelect}
            expandedDirs={expandedDirs} toggleDir={toggleDir} />
        ))}
      </>
    );
  }

  const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
  const fileColor = FILE_COLORS[ext] ?? "#abb2bf";

  return (
    <button
      onClick={() => node.fileIdx !== undefined && onSelect(node.fileIdx)}
      className={cn(
        "w-full flex items-center gap-1.5 py-[3px] text-[12px] font-mono truncate transition-all",
        isSelected
          ? "bg-[#7c6fee]/15 text-zinc-900 dark:text-[#f0effe] border-l-2 border-[#7c6fee]"
          : "text-zinc-500 dark:text-[#5c5a7a] hover:bg-zinc-100 dark:hover:bg-[#16162a]/60 hover:text-zinc-600 dark:hover:text-[#9896b8] border-l-2 border-transparent"
      )}
      style={{ paddingLeft: `${18 + depth * 14}px` }}
    >
      <FileCode2 size={11} className="shrink-0" style={{ color: fileColor }} />
      <span className="truncate">{node.name}</span>
      {node.isNew && <Circle size={5} className="shrink-0 text-[#9d8ff5] fill-[#9d8ff5] ml-auto mr-2" />}
    </button>
  );
}

// ─── Code Display ─────────────────────────────────────────────────────────────

function CodeDisplay({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="flex flex-1 overflow-auto text-[13px] font-mono leading-[1.65]">
      {/* Line numbers */}
      <div className="w-12 shrink-0 flex flex-col items-end pr-3 py-5 select-none text-[11px] bg-zinc-50 dark:bg-[#0d0d1a] text-zinc-400 dark:text-[#2a2a48] sticky left-0 border-r border-slate-200 dark:border-[#1e1e38]">
        {lines.map((_, i) => (
          <span key={i} className="leading-[1.65]">{i + 1}</span>
        ))}
      </div>
      {/* Code */}
      <pre className="flex-1 p-5 overflow-x-auto text-[#abb2bf] whitespace-pre bg-[#0a0a16]">
        <code>{content}</code>
      </pre>
    </div>
  );
}

// ─── Main Code Tab ─────────────────────────────────────────────────────────────

export function CodeTab({ projectId, runId }: { projectId?: string | null; runId?: string | null }) {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["src", "src/components"]));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingBlock, setGeneratingBlock] = useState<string | null>(null);
  const [blockProgress, setBlockProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [tokenCount, setTokenCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Queue panel state
  const [showQueue, setShowQueue] = useState(false);
  const [queueBlocks, setQueueBlocks] = useState<QueueBlock[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(runId ?? null);
  // Use a ref to avoid activeRunId in the callback dep array (prevents infinite re-fetch)
  const activeRunIdRef = useRef<string | null>(runId ?? null);

  // Keep activeRunId in sync with prop
  useEffect(() => {
    if (runId) { setActiveRunId(runId); activeRunIdRef.current = runId; }
  }, [runId]);

  // Load queue from DB blocks on mount / when projectId changes
  const loadQueueBlocks = useCallback(async () => {
    if (!projectId) return;
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const [blocksRes, runsRes] = await Promise.all([
        fetch(`${apiUrl}/api/blocks?projectId=${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/workflow/runs?projectId=${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!blocksRes.ok) return;
      const blocks = await blocksRes.json() as any[];

      let outputMap: Record<string, { status: string; tokensUsed: number; errorMsg?: string }> = {};
      if (runsRes.ok) {
        const runs = await runsRes.json() as any[];
        const latest = runs[0];
        if (latest) {
          if (!activeRunIdRef.current) {
            setActiveRunId(latest.id);
            activeRunIdRef.current = latest.id;
          }
          latest.blockOutputs?.forEach((o: any) => {
            outputMap[o.blockId] = { status: o.status, tokensUsed: o.tokensUsed ?? 0, errorMsg: o.errorMsg };
          });
        }
      }

      setQueueBlocks(blocks.map((b: any) => {
        const out = outputMap[b.id];
        return {
          id: b.id,
          title: (b.blockJson as any)?.title ?? b.blockType,
          type: b.blockType,
          status: (out?.status === "pending_approval" ? "pending" : out?.status ?? "pending") as QueueBlock["status"],
          tokensUsed: out?.tokensUsed,
          errorMsg: out?.errorMsg,
        };
      }));
    } catch {}
  }, [projectId, getToken]); // no activeRunId dep — use ref instead

  useEffect(() => { loadQueueBlocks(); }, [loadQueueBlocks]);

  const handleApproveBlock = useCallback(async (blockId: string) => {
    if (!projectId || !activeRunId) return;
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      await fetch(`${apiUrl}/api/workflow/approve/${blockId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, runId: activeRunId }),
      });
      setQueueBlocks(prev => prev.map(b => b.id === blockId ? { ...b, status: "approved" } : b));
    } catch {}
  }, [projectId, activeRunId, getToken]);

  const handleSkipBlock = useCallback(async (blockId: string) => {
    if (!projectId || !activeRunId) return;
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      await fetch(`${apiUrl}/api/workflow/skip/${blockId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, runId: activeRunId }),
      });
      setQueueBlocks(prev => prev.map(b => b.id === blockId ? { ...b, status: "skipped" } : b));
    } catch {}
  }, [projectId, activeRunId, getToken]);

  const fetchOutputs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const blocksRes = await fetch(`${apiUrl}/api/blocks?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!blocksRes.ok) throw new Error("Failed to fetch blocks");
      const blocks = await blocksRes.json();

      const allFiles: GeneratedFile[] = [];
      let doneCount = 0;
      for (const block of blocks) {
        const outRes = await fetch(`${apiUrl}/api/blocks/${block.id}/output`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (outRes.ok) {
          const output: BlockOutput = await outRes.json();
          if (output.outputCode) {
            const blockTitle = (block.blockJson as any)?.title ?? block.blockType;
            const parsed = parseOutputIntoFiles(output.outputCode, blockTitle);
            const isNew = output.status === "done" && allFiles.length === 0;
            allFiles.push(...parsed.map(f => ({ ...f, isNew })));
            doneCount++;
          }
        }
      }
      setFiles(allFiles);
      setBlockProgress({ current: doneCount, total: blocks.length });
      if (allFiles.length > 0) setSelectedIdx(0);

      const dirs = new Set<string>(["src", "src/components"]);
      allFiles.forEach(f => {
        const parts = f.name.split("/");
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join("/"));
        }
      });
      setExpandedDirs(dirs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, getToken]);

  useEffect(() => { fetchOutputs(); }, [fetchOutputs]);

  // WebSocket live updates
  useEffect(() => {
    if (!projectId) return;
    const wsUrl = `${(process.env.NEXT_PUBLIC_API_URL || "").replace("http", "ws")}/api/ws/${projectId}`;
    let ws: WebSocket;
    let shouldReconnect = true;
    const connect = () => {
      if (!shouldReconnect) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === "block:status_update") {
            const { blockId, status } = msg;
            // Update queue block status live
            if (blockId) {
              setQueueBlocks(prev => prev.map(b =>
                b.id === blockId
                  ? { ...b, status: status === "pending_approval" ? "pending" : status }
                  : b
              ));
            }
            if (status === "running") {
              setIsGenerating(true);
              setGeneratingBlock(msg.blockTitle ?? `Block ${blockId?.slice(0, 6)}`);
              setTokenCount(0);
            }
            if (status === "done" || status === "failed") {
              setIsGenerating(false);
              setTimeout(() => { fetchOutputs(); loadQueueBlocks(); }, 1200);
            }
          }
          if (msg.event === "block:token") {
            setTokenCount(t => t + (msg.count ?? 1));
          }
          if (msg.event === "workflow:completed") {
            setIsGenerating(false);
            setTimeout(() => { fetchOutputs(); loadQueueBlocks(); }, 1200);
          }
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => { if (shouldReconnect) setTimeout(connect, 2000); };
    };
    connect();
    return () => { shouldReconnect = false; ws?.close(); };
  }, [projectId, fetchOutputs]);

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const selectedFile = files[selectedIdx] ?? null;
  const tree = buildTree(files);

  const handleCopy = useCallback(async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedFile]);

  const handleDownloadAll = useCallback(async () => {
    if (files.length === 0) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of files) zip.file(file.name, file.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "craftastudio-output.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, [files]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a16] font-mono text-sm">

      {/* Generating progress bar */}
      {isGenerating && (
        <div className="h-[2px] shrink-0 overflow-hidden bg-zinc-200 dark:bg-[#1e1e38]">
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#7c6fee] to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Top bar */}
      <div className="h-10 flex items-center bg-zinc-50 dark:bg-[#0d0d1a] border-b border-slate-200 dark:border-[#1e1e38] shrink-0 z-10 gap-1 px-2">
        {/* Active file tab */}
        {selectedFile && (
          <div className="flex items-center gap-1.5 px-3 h-full border-b-2 border-[#7c6fee] text-zinc-900 dark:text-[#f0effe] shrink-0">
            <FileCode2 size={12} className="text-[#9d8ff5]" />
            <span className="text-[12px] font-mono">{selectedFile.name.split("/").pop()}</span>
            {selectedFile.isNew && <Circle size={5} className="text-[#9d8ff5] fill-[#9d8ff5]" />}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {queueBlocks.length > 0 && (
            <button
              onClick={() => setShowQueue(v => !v)}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors border",
                showQueue
                  ? "bg-[#7c6fee]/20 text-[#9d8ff5] border-[#7c6fee]/30"
                  : "text-zinc-500 dark:text-[#5c5a7a] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a] border-transparent"
              )}
            >
              <ListChecks size={11} />
              <span>Queue</span>
              <span className="bg-[#7c6fee]/20 text-[#9d8ff5] text-[9px] px-1 rounded font-mono">
                {queueBlocks.filter(b => b.status === "done").length}/{queueBlocks.length}
              </span>
            </button>
          )}
          {selectedFile && (
            <>
              <button onClick={handleCopy}
                className="px-2.5 py-1 text-[11px] text-zinc-500 dark:text-[#5c5a7a] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a] rounded flex items-center gap-1.5 transition-colors">
                {copied ? <><CheckCheck size={11} className="text-[#9d8ff5]" /><span className="text-[#9d8ff5]">Copied</span></> : <><Copy size={11} /><span>Copy</span></>}
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-[#1e1e38]" />
            </>
          )}
          <button onClick={fetchOutputs} disabled={loading}
            className="px-2.5 py-1 text-[11px] text-zinc-500 dark:text-[#5c5a7a] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a] rounded flex items-center gap-1.5 transition-colors">
            <RefreshCw size={11} className={loading ? "animate-spin text-[#7c6fee]" : ""} />
            <span>Refresh</span>
          </button>
          {files.length > 0 && (
            <button onClick={handleDownloadAll}
              className="px-2.5 py-1 text-[11px] text-zinc-500 dark:text-[#5c5a7a] hover:text-zinc-600 dark:hover:text-[#9896b8] hover:bg-zinc-100 dark:hover:bg-[#16162a] rounded flex items-center gap-1.5 transition-colors">
              <Download size={11} /><span>Download</span>
            </button>
          )}
        </div>
      </div>

      {/* Block Queue Panel — floats above content */}
      <div className="relative">
        <BlockQueuePanel
          projectId={projectId ?? ""}
          runId={activeRunId}
          blocks={queueBlocks}
          onApprove={handleApproveBlock}
          onSkip={handleSkipBlock}
          onClose={() => setShowQueue(false)}
          isOpen={showQueue}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* File Explorer */}
        <div className="w-52 shrink-0 bg-zinc-50 dark:bg-[#0d0d1a] border-r border-slate-200 dark:border-[#1e1e38] flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-[#1e1e38]">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#3a3858]">Explorer</span>
            {blockProgress.total > 0 && (
              <span className="text-[9px] font-mono text-zinc-500 dark:text-[#5c5a7a] bg-zinc-100 dark:bg-[#16162a] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#1e1e38]">
                {blockProgress.current}/{blockProgress.total}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[#1e1e38] scrollbar-track-transparent">
            {files.length === 0 && !loading && (
              <p className="text-[11px] text-zinc-400 dark:text-[#2a2a48] px-3 py-4 font-sans">No files generated yet</p>
            )}
            {tree.map(node => (
              <TreeNodeRow key={node.path} node={node} depth={0}
                selectedIdx={selectedIdx} onSelect={setSelectedIdx}
                expandedDirs={expandedDirs} toggleDir={toggleDir} />
            ))}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a16]">

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 size={20} className="text-[#7c6fee] animate-spin" />
              <p className="text-[12px] text-zinc-400 dark:text-[#3a3858] font-sans">Loading outputs…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertCircle size={24} className="text-red-400/70" />
              <p className="text-[12px] text-zinc-500 dark:text-[#5c5a7a] font-sans">{error}</p>
              <button onClick={fetchOutputs} className="text-[11px] text-[#7c6fee] hover:text-[#9d8ff5] hover:underline font-sans transition-colors">Retry</button>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
              {/* Animated icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-[#7c6fee]/10 border border-[#7c6fee]/20 flex items-center justify-center">
                  <FileCode2 size={26} className="text-[#7c6fee]" />
                </div>
                {isGenerating && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7c6fee] border-2 border-[#0a0a16] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                )}
              </div>

              {isGenerating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 justify-center">
                    <Zap size={13} className="text-[#9d8ff5] animate-pulse" />
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-[#f0effe] font-sans">Generating Code…</p>
                  </div>
                  {generatingBlock && (
                    <p className="text-[11px] text-zinc-500 dark:text-[#5c5a7a] font-sans">{generatingBlock}</p>
                  )}
                  {tokenCount > 0 && (
                    <p className="text-[10px] text-zinc-400 dark:text-[#3a3858] font-mono">{tokenCount} tokens</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-zinc-600 dark:text-[#9896b8] font-sans">No code generated yet</p>
                  <p className="text-[11px] text-zinc-400 dark:text-[#3a3858] max-w-xs leading-relaxed font-sans">
                    Go to the <span className="text-[#7c6fee]">Canvas tab</span>, click a block, then hit{" "}
                    <span className="text-[#7c6fee]">Implement Code</span> in the side panel
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && !error && selectedFile && (
            <CodeDisplay content={selectedFile.content} />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className={cn(
        "h-7 flex items-center px-4 justify-between shrink-0 text-[11px] font-sans border-t border-slate-200 dark:border-[#1e1e38] transition-all",
        isGenerating ? "bg-[#7c6fee]/15" : "bg-zinc-50 dark:bg-[#0d0d1a]"
      )}>
        <div className="flex items-center gap-3">
          {isGenerating ? (
            <>
              <div className="flex items-center gap-1.5 text-[#9d8ff5]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
                <span className="font-semibold tracking-wide uppercase text-[9px]">Generating</span>
              </div>
              {generatingBlock && (
                <span className="text-zinc-500 dark:text-[#5c5a7a] text-[10px]">{generatingBlock}</span>
              )}
              {tokenCount > 0 && (
                <span className="text-zinc-400 dark:text-[#3a3858] font-mono">{tokenCount} tok</span>
              )}
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-zinc-400 dark:text-[#3a3858]">
                <Terminal size={10} />
                <span>{files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""}` : "Ready"}</span>
              </span>
              {blockProgress.total > 0 && (
                <span className="text-zinc-400 dark:text-[#3a3858]">
                  {blockProgress.current}/{blockProgress.total} blocks
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-zinc-400 dark:text-[#3a3858]">
          {selectedFile && (
            <>
              <span>{selectedFile.content.split("\n").length} lines</span>
              <span className="text-zinc-400 dark:text-[#2a2a48]">·</span>
              <span>{selectedFile.language}</span>
            </>
          )}
          {files.length > 0 && (
            <span className="flex items-center gap-1 text-[#7c6fee]/60">
              <Package size={9} />
              <span>craftastudio</span>
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
