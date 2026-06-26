"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Copy, Check, Code2, Loader2, FileCode, AlertCircle, Package } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { LivePreview } from "./LivePreview";

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/`{3,}[\w]*\r?\n([\s\S]*?)`{3,}\s*$/);
  return match ? match[1].trim() : trimmed;
}

interface BlockOutput {
  id: string;
  blockId: string;
  blockType: string;
  outputCode: string;
  status: "done" | "failed" | "pending";
  errorMsg?: string | null;
  createdAt: string;
}

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string | null;
  blockTitle: string;
  blockStack?: string;
  projectId: string | null;
  runId?: string | null;
}

function detectLanguage(code: string, blockType: string): string {
  if (!code) return "typescript";
  if (blockType?.toLowerCase().includes("ui") || blockType?.toLowerCase().includes("frontend")) return "tsx";
  if (code.includes("import React") || code.includes("from 'react'")) return "tsx";
  if (code.includes("from 'fastify'") || code.includes("from 'express'")) return "typescript";
  if (code.includes("SELECT") || code.includes("CREATE TABLE")) return "sql";
  if (code.includes("python") || code.includes("def ") || code.includes("import os")) return "python";
  if (code.includes("schema") || code.includes("model ")) return "prisma";
  return "typescript";
}

function splitIntoFiles(code: string, blockType: string): { name: string; content: string; lang: string }[] {
  // Try to split by file markers like "// FILE: path/to/file.ts"
  const fileMarkerRegex = /\/\/\s*FILE:\s*(.+?)(?:\r?\n)([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
  const files: { name: string; content: string; lang: string }[] = [];

  let match;
  while ((match = fileMarkerRegex.exec(code)) !== null) {
    const name = match[1].trim();
    const content = match[2].trim();
    const ext = name.split(".").pop() ?? "ts";
    const langMap: Record<string, string> = {
      tsx: "tsx", ts: "typescript", js: "javascript", jsx: "jsx",
      py: "python", sql: "sql", prisma: "prisma", json: "json",
      css: "css", md: "markdown", yaml: "yaml", yml: "yaml"
    };
    files.push({ name, content, lang: langMap[ext] ?? "typescript" });
  }

  // If no file markers, treat the whole thing as one file
  if (files.length === 0) {
    const lang = detectLanguage(code, blockType);
    const extMap: Record<string, string> = {
      tsx: "component.tsx", typescript: "module.ts", javascript: "index.js",
      python: "main.py", sql: "schema.sql", prisma: "schema.prisma",
      json: "config.json", css: "styles.css", markdown: "README.md"
    };
    files.push({
      name: extMap[lang] ?? "output.ts",
      content: code,
      lang,
    });
  }

  return files;
}

export function CodeViewerModal({
  isOpen, onClose, blockId, blockTitle, blockStack, projectId, runId
}: CodeViewerModalProps) {
  const { getToken } = useAuth();
  const [blockOutput, setBlockOutput] = useState<BlockOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const files = blockOutput?.outputCode
    ? splitIntoFiles(blockOutput.outputCode, blockOutput.blockType)
    : [];

  const activeFile = files[activeFileIdx];

  const fetchOutput = useCallback(async () => {
    if (!blockId || !projectId) return;
    setIsLoading(true);
    setError(null);
    setActiveFileIdx(0);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const query = runId
        ? `?runId=${runId}`
        : "";
      const res = await fetch(`${apiUrl}/api/blocks/${blockId}/output${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) {
        setError("No code generated yet for this block. Click 'Implement This' to start generation.");
        return;
      }

      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const data: BlockOutput = await res.json();
      setBlockOutput(data);
    } catch (err: any) {
      setError(err.message || "Failed to load code output");
    } finally {
      setIsLoading(false);
    }
  }, [blockId, projectId, runId, getToken]);

  useEffect(() => {
    if (isOpen && blockId) {
      fetchOutput();
    } else {
      setBlockOutput(null);
      setError(null);
    }
  }, [isOpen, blockId, fetchOutput]);

  const handleCopy = async () => {
    if (!activeFile?.content) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = async () => {
    if (!blockOutput?.outputCode) return;
    setIsDownloading(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder(blockTitle.toLowerCase().replace(/\s+/g, "-") || "block");

      files.forEach((f) => {
        folder?.file(f.name, f.content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${blockTitle.toLowerCase().replace(/\s+/g, "-")}-code.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Zip failed:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-[5vh] bottom-[5vh] z-[101] mx-auto max-w-5xl flex flex-col rounded-2xl border border-[var(--border)] bg-[#0d0d12] shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-[var(--primary-accent)]/10 border border-[var(--primary-accent)]/20">
                  <Code2 className="size-4 text-[var(--primary-accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white leading-none">{blockTitle}</h2>
                  {blockStack && (
                    <p className="text-[10px] text-[var(--primary-accent)] font-mono mt-0.5">{blockStack}</p>
                  )}
                </div>
                {blockOutput?.status === "done" && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                    Generated
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAll}
                  disabled={isDownloading || !blockOutput?.outputCode}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                    blockOutput?.outputCode
                      ? "bg-[var(--primary-accent)] text-white hover:opacity-90 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                  )}
                >
                  {isDownloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Package className="size-3.5" />
                  )}
                  Download ZIP
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* File Tabs */}
            {files.length > 1 && (
              <div className="flex items-center gap-px px-4 py-2 bg-[#0a0a0f] border-b border-white/[0.04] overflow-x-auto scrollbar-none shrink-0">
                {files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveFileIdx(i)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all duration-200",
                      i === activeFileIdx
                        ? "bg-[var(--primary-accent)]/15 text-[var(--primary-accent)] border border-[var(--primary-accent)]/25"
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    )}
                  >
                    <FileCode className="size-3" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-hidden relative">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="size-12 rounded-full border-2 border-[var(--primary-accent)]/20 border-t-[var(--primary-accent)] animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-3 rounded-full bg-[var(--primary-accent)] animate-pulse" />
                    </div>
                  </div>
                  <p className="text-xs text-white/40 font-mono animate-pulse">Loading generated code...</p>
                </div>
              )}

              {!isLoading && error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="size-6 text-amber-400" />
                  </div>
                  <p className="text-sm text-white/60 text-center max-w-sm leading-relaxed">{error}</p>
                </div>
              )}

              {!isLoading && !error && activeFile && blockOutput && (
                <div className="h-full flex flex-col">
                  {/* Code Actions Bar */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0f]/80 border-b border-white/[0.04] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                          <div key={c} className="size-2.5 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-white/20 font-mono ml-2">{activeFile.name}</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Sandpack Live Preview or Syntax Highlighted Code */}
                  <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <LivePreview code={stripFences(activeFile.content)} blockType={blockOutput.blockType} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {blockOutput && !isLoading && !error && (
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.04] bg-white/[0.01] shrink-0">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-white/20 font-mono">
                    {files.length} {files.length === 1 ? "file" : "files"} generated
                  </span>
                  <span className="text-[10px] text-white/20 font-mono">
                    {blockOutput.outputCode.split("\n").length} lines
                  </span>
                </div>
                <span className="text-[10px] text-white/15 font-mono">
                  Generated by CraftaStudio AI
                </span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
