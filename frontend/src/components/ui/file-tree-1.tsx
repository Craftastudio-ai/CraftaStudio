"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, Folder, File, FileCode, FileJson, FileText, Layout } from "lucide-react";

// -------- Types --------
export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export type FileTreeProps = {
  data: FileNode[];
  defaultExpanded?: Record<string, boolean>;
  onSelect?: (node: FileNode) => void;
  selectedId?: string | null;
};

// Helper for specialized icons
const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'tsx' || ext === 'ts' || ext === 'js' || ext === 'jsx') return <FileCode size={14} className="text-[var(--primary-accent)]/80" />;
  if (ext === 'json') return <FileJson size={14} className="text-orange-400/80" />;
  if (ext === 'md') return <FileText size={14} className="text-blue-400/80" />;
  if (ext === 'css') return <Layout size={14} className="text-blue-300/80" />;
  return <File size={14} className="text-gray-400" />;
};

// -------- Component --------
export default function FileTree({ data, defaultExpanded = {}, onSelect, selectedId }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const activeSelected = selectedId !== undefined ? selectedId : internalSelected;

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNodes = (nodes: FileNode[], level = 0) => {
    return nodes.map((n) => (
      <div key={n.id} className="relative">
        <div
          role="treeitem"
          tabIndex={0}
          aria-expanded={n.type === "folder" ? !!expanded[n.id] : undefined}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-all select-none outline-none group",
            activeSelected === n.id
              ? "bg-[var(--primary-accent)]/10 text-[var(--primary-accent)] border-l-2 border-[var(--primary-accent)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
          )}
          style={{ paddingLeft: level * 12 + 8 }}
          onClick={() => {
            if (n.type === "folder") toggle(n.id);
            if (selectedId === undefined) setInternalSelected(n.id);
            onSelect?.(n);
          }}
          onKeyDown={(e) => {
            if (n.type === "folder" && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              toggle(n.id);
            }
          }}
        >
          {n.type === "folder" ? (
            <div className="flex items-center gap-1.5">
              <span className="size-4 flex items-center justify-center">
                {expanded[n.id] ? <ChevronDown size={12} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={12} className="text-[var(--muted-foreground)]" />}
              </span>
              <Folder size={15} className={cn("transition-colors", expanded[n.id] ? "text-[var(--primary-accent)] fill-[var(--primary-accent)]/10" : "text-[var(--muted-foreground)]")} />
            </div>
          ) : (
            <div className="size-4 flex items-center justify-center">
               {getFileIcon(n.name)}
            </div>
          )}
          <span className="text-[12px] font-medium truncate tracking-tight">{n.name}</span>
        </div>

        {/* Children with smooth animation */}
        <AnimatePresence initial={false}>
          {n.children && n.children.length > 0 && expanded[n.id] && (
            <motion.div
              key="children"
              role="group"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              {renderNodes(n.children, level + 1)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ));
  };

  return (
    <div role="tree" className="space-y-0.5">
      {renderNodes(data)}
    </div>
  );
}
