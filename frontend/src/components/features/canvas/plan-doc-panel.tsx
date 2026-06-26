"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, Loader2, Edit3, Save,
  X, Brain, Cpu, GitBranch, Layers, Shield, Code2,
  RefreshCw, Sparkles, Zap, ChevronDown, ChevronRight,
  Database, Globe, Server, Layout, Terminal, Key, Plus, Trash2,
  Download, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";

/* ── Types ──────────────────────────────────────────────────────────────── */
export interface PlanBlock {
  id: string;
  title: string;
  type: string;
  stack: string;
  layer?: string;
  description?: string;
  tech_stack?: string[];
  files?: { path: string; description: string }[];
  api_endpoints?: { method: string; route: string; auth?: string; request?: Record<string, unknown>; response?: Record<string, unknown> }[];
  env_vars?: string[];
  acceptance_criteria?: string[];
  dependencies?: string[];
  status: string;
  subBlocks?: { id: string; type: string; title: string; status: string }[];
}

interface PlanDocPanelProps {
  isOpen: boolean;
  onClose: () => void;
  planDoc?: {
    title: string;
    summary: string;
    markdown: string;
    blocks: PlanBlock[];
    is_chat?: boolean;
    projectId?: string;
    provider?: string;
    llm_model?: string;
    input_tokens?: number;
    output_tokens?: number;
  } | null;
  isLoading?: boolean;
  onImplement?: () => void;
  isImplementing?: boolean;
  onRegenerate?: (editedMarkdown: string) => void;
  onSavePlanDoc?: (editedMarkdown: string) => Promise<void>;
}

/* ── Plan stages ────────────────────────────────────────────────────────── */
const PLAN_STAGES = [
  { icon: Brain,     label: "Analysing requirements",  ms: 0     },
  { icon: Layers,    label: "Designing architecture",   ms: 6000  },
  { icon: GitBranch, label: "Mapping dependencies",     ms: 14000 },
  { icon: Cpu,       label: "Generating blocks",        ms: 22000 },
  { icon: Shield,    label: "Validating constraints",   ms: 32000 },
  { icon: Code2,     label: "Writing documentation",    ms: 42000 },
];

/* ── Loading view ───────────────────────────────────────────────────────── */
function PlanLoadingView() {
  const [elapsed, setElapsed] = React.useState(0);
  const [stageIdx, setStageIdx] = React.useState(0);

  React.useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      for (let i = PLAN_STAGES.length - 1; i >= 0; i--) {
        if (ms >= PLAN_STAGES[i].ms) { setStageIdx(i); break; }
      }
    }, 200);
    return () => clearInterval(tick);
  }, []);

  const secs = Math.floor(elapsed / 1000);
  const progress = Math.min((stageIdx + 1) / PLAN_STAGES.length, 0.97);
  const CurrentIcon = PLAN_STAGES[stageIdx].icon;

  return (
    <div className="relative flex flex-col items-center justify-center gap-0 px-6 py-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute w-72 h-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #7c6fee 0%, transparent 70%)", filter: "blur(48px)" }} />
        <div className="absolute w-40 h-40 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)", filter: "blur(24px)" }} />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "rgba(13, 13, 26, 0.65)",
          backdropFilter: "blur(32px) saturate(160%)",
          WebkitBackdropFilter: "blur(32px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,111,238,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(124,111,238,0.4), transparent)" }} />

        <div className="flex flex-col items-center gap-4 pt-8 pb-6 px-6">
          <div className="relative flex items-center justify-center w-20 h-20">
            <motion.div className="absolute inset-0 rounded-full"
              style={{ border: "1px solid rgba(124,111,238,0.15)" }}
              animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute rounded-full"
              style={{ inset: "8px", border: "1px dashed rgba(124,111,238,0.25)" }}
              animate={{ rotate: -360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute rounded-full"
              style={{ inset: "14px", background: "rgba(124,111,238,0.06)", border: "1px solid rgba(124,111,238,0.3)", boxShadow: "0 0 16px rgba(124,111,238,0.2), inset 0 0 8px rgba(124,111,238,0.1)" }}
              animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} />
            <AnimatePresence mode="wait">
              <motion.div key={stageIdx}
                initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="relative z-10">
                <CurrentIcon className="size-5 text-[#9d8ff5]" />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="text-center space-y-1">
            <AnimatePresence mode="wait">
              <motion.p key={stageIdx}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[14px] font-semibold text-[#f0effe] tracking-tight">
                {PLAN_STAGES[stageIdx].label}…
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] text-[#5c5a7a] font-mono tabular-nums">{secs}s elapsed</p>
          </div>

          <div className="w-full space-y-2">
            <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(30,30,56,0.8)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #6355d4, #9d8ff5, #c4bcfa)" }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }} />
            </div>
            <div className="flex items-center justify-between px-0.5">
              {PLAN_STAGES.map((_, i) => (
                <motion.div key={i} className="size-1.5 rounded-full"
                  animate={{ backgroundColor: i < stageIdx ? "#22c55e" : i === stageIdx ? "#9d8ff5" : "rgba(30,30,56,1)", scale: i === stageIdx ? 1.4 : 1 }}
                  transition={{ duration: 0.3 }} />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-6 h-[1px]" style={{ background: "rgba(255,255,255,0.04)" }} />

        <div className="px-5 py-4 space-y-1">
          {PLAN_STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = i < stageIdx;
            const active = i === stageIdx;
            return (
              <motion.div key={s.label} animate={{ opacity: i > stageIdx ? 0.3 : 1 }} transition={{ duration: 0.4 }}
                className="flex items-center gap-3 py-1">
                <motion.div
                  animate={{ backgroundColor: done ? "rgba(34,197,94,0.12)" : active ? "rgba(124,111,238,0.15)" : "rgba(22,22,42,0.6)", borderColor: done ? "rgba(34,197,94,0.25)" : active ? "rgba(124,111,238,0.35)" : "rgba(30,30,56,0.8)" }}
                  className="size-6 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{ backdropFilter: "blur(8px)" }}>
                  {done ? <CheckCircle2 className="size-3 text-[#22c55e]" />
                    : active ? <Loader2 className="size-3 text-[#9d8ff5] animate-spin" />
                    : <Icon className="size-3 text-[#5c5a7a]" />}
                </motion.div>
                <motion.span animate={{ color: done ? "#5c5a7a" : active ? "#f0effe" : "#3a3858" }}
                  className="text-[11px] font-medium flex-1"
                  style={{ textDecoration: done ? "line-through" : "none" }}>
                  {s.label}
                </motion.span>
                <AnimatePresence>
                  {done && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                      <CheckCircle2 className="size-3 text-[#22c55e]/50" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <motion.div className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(124,111,238,0.2), transparent)" }}
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );
}

/* ── Block type / layer maps ─────────────────────────────────────────────── */
const BLOCK_TYPE_COLOR: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  database:     { dot: "bg-[#22c55e]", bg: "bg-[#22c55e]/8",  border: "border-[#22c55e]/20", text: "text-[#22c55e]" },
  api:          { dot: "bg-[#a78bfa]", bg: "bg-[#a78bfa]/8",  border: "border-[#a78bfa]/20", text: "text-[#a78bfa]" },
  service:      { dot: "bg-[#7c6fee]", bg: "bg-[#7c6fee]/8",  border: "border-[#7c6fee]/20", text: "text-[#7c6fee]" },
  ui:           { dot: "bg-[#38bdf8]", bg: "bg-[#38bdf8]/8",  border: "border-[#38bdf8]/20", text: "text-[#38bdf8]" },
  frontend:     { dot: "bg-[#38bdf8]", bg: "bg-[#38bdf8]/8",  border: "border-[#38bdf8]/20", text: "text-[#38bdf8]" },
  job:          { dot: "bg-[#f59e0b]", bg: "bg-[#f59e0b]/8",  border: "border-[#f59e0b]/20", text: "text-[#f59e0b]" },
  backend:      { dot: "bg-[#7c6fee]", bg: "bg-[#7c6fee]/8",  border: "border-[#7c6fee]/20", text: "text-[#7c6fee]" },
  infrastructure: { dot: "bg-[#5c5a7a]", bg: "bg-[#5c5a7a]/8", border: "border-[#5c5a7a]/20", text: "text-[#9896b8]" },
};
function blockMeta(type: string) {
  return BLOCK_TYPE_COLOR[type?.toLowerCase()] ?? { dot: "bg-[#5c5a7a]", bg: "bg-[#16162a]", border: "border-[#1e1e38]", text: "text-[#9896b8]" };
}

const LAYER_ICON: Record<string, React.ElementType> = {
  backend: Server, frontend: Layout, database: Database, infrastructure: Terminal,
};
const HTTP_COLOR: Record<string, string> = {
  GET: "text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20",
  POST: "text-[#7c6fee] bg-[#7c6fee]/10 border-[#7c6fee]/20",
  PUT: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  PATCH: "text-[#38bdf8] bg-[#38bdf8]/10 border-[#38bdf8]/20",
  DELETE: "text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/20",
};

/* ── Collapsible section ─────────────────────────────────────────────────── */
function Section({ label, count, icon: Icon, defaultOpen = false, children }: {
  label: string; count?: number; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border border-white/[0.04] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-[#5c5a7a]" />
          <span className="text-[11px] font-bold text-[#9896b8] uppercase tracking-widest">{label}</span>
          {count !== undefined && (
            <span className="text-[10px] font-mono bg-white/[0.06] text-[#5c5a7a] px-1.5 py-0.5 rounded-md">{count}</span>
          )}
        </div>
        {open ? <ChevronDown className="size-3 text-[#3a3858]" /> : <ChevronRight className="size-3 text-[#3a3858]" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pt-2 space-y-1.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Editable text field ─────────────────────────────────────────────────── */
function EditableField({ label, value, onChange, multiline = false }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value]);

  const commit = () => { onChange(draft); setEditing(false); };

  if (editing) {
    return (
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-[#5c5a7a] uppercase tracking-wider">{label}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            rows={3}
            className="w-full px-2.5 py-1.5 text-[12px] font-mono rounded-lg text-[#f0effe] resize-none focus:outline-none"
            style={{ background: "rgba(7,7,13,0.9)", border: "1px solid rgba(124,111,238,0.3)" }}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === "Enter" && commit()}
            className="w-full px-2.5 py-1.5 text-[12px] font-mono rounded-lg text-[#f0effe] focus:outline-none"
            style={{ background: "rgba(7,7,13,0.9)", border: "1px solid rgba(124,111,238,0.3)" }}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group w-full text-left space-y-0.5"
    >
      <span className="text-[10px] font-mono text-[#3a3858] uppercase tracking-wider">{label}</span>
      <div className="flex items-start gap-1.5 group-hover:text-[#f0effe] transition-colors">
        <span className="text-[12px] text-[#9896b8] leading-relaxed flex-1">{value || "—"}</span>
        <Edit3 className="size-2.5 text-[#3a3858] group-hover:text-[#7c6fee] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all" />
      </div>
    </button>
  );
}

/* ── Single Block Card ───────────────────────────────────────────────────── */
interface EditableBlock extends PlanBlock {
  tech_stack: string[];
  files: { path: string; description: string }[];
  api_endpoints: { method: string; route: string; auth?: string }[];
  env_vars: string[];
  acceptance_criteria: string[];
}

function BlockCard({
  block, index, onUpdate, onRegenerate,
}: {
  block: EditableBlock;
  index: number;
  onUpdate: (updated: Partial<EditableBlock>) => void;
  onRegenerate?: () => void;
}) {
  const meta = blockMeta(block.type);
  const LayerIcon = LAYER_ICON[block.layer ?? "backend"] ?? Server;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10,10,20,0.6)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.04]">
        {/* Block number */}
        <div className="size-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]"
          style={{ background: "rgba(124,111,238,0.1)", border: "1px solid rgba(124,111,238,0.2)", color: "#9d8ff5" }}>
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#f0effe] truncate leading-none">{block.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <LayerIcon className="size-2.5 text-[#5c5a7a]" />
            <span className="text-[10px] text-[#5c5a7a] font-mono">{block.layer ?? block.type}</span>
          </div>
        </div>

        {/* Type badge */}
        <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0", meta.bg, meta.border, meta.text)}>
          {block.type}
        </div>

        {/* Regenerate button */}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            title="Regenerate this block"
            className="size-6 flex items-center justify-center rounded-lg text-[#5c5a7a] hover:text-[#9d8ff5] hover:bg-[#7c6fee]/10 transition-all shrink-0"
          >
            <RefreshCw className="size-3" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Description */}
        <EditableField
          label="Description"
          value={block.description ?? block.stack ?? ""}
          multiline
          onChange={v => onUpdate({ description: v })}
        />

        {/* Tech stack — editable chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-[#3a3858] uppercase tracking-wider">Tech Stack</span>
          <div className="flex flex-wrap gap-1.5">
            {(block.tech_stack?.length ? block.tech_stack : block.stack ? [block.stack] : []).map((t, ti) => (
              <div key={ti} className="group flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-[#9896b8] border border-white/[0.06] bg-white/[0.03] hover:border-[#7c6fee]/30 transition-colors">
                {t}
                <button
                  onClick={() => onUpdate({ tech_stack: block.tech_stack.filter((_, i) => i !== ti) })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#f43f5e]"
                >
                  <X className="size-2" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const val = window.prompt("Add technology:");
                if (val?.trim()) onUpdate({ tech_stack: [...(block.tech_stack ?? []), val.trim()] });
              }}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#5c5a7a] border border-dashed border-white/[0.06] hover:border-[#7c6fee]/30 hover:text-[#9d8ff5] transition-colors"
            >
              <Plus className="size-2.5" />
            </button>
          </div>
        </div>

        {/* Files — collapsible */}
        {(block.files?.length ?? 0) > 0 && (
          <Section label="Files" count={block.files.length} icon={FileText}>
            {block.files.map((f, fi) => (
              <div key={fi} className="flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0">
                <Code2 className="size-3 text-[#5c5a7a] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-[#9d8ff5] truncate">{f.path}</p>
                  <p className="text-[10px] text-[#5c5a7a] mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* API Endpoints — collapsible */}
        {(block.api_endpoints?.length ?? 0) > 0 && (
          <Section label="Endpoints" count={block.api_endpoints.length} icon={Globe}>
            {block.api_endpoints.map((ep, ei) => (
              <div key={ei} className="flex items-center gap-2">
                <span className={cn(
                  "shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border",
                  HTTP_COLOR[ep.method?.toUpperCase()] ?? "text-[#9896b8] bg-white/[0.04] border-white/[0.08]"
                )}>
                  {ep.method}
                </span>
                <span className="font-mono text-[11px] text-[#9896b8] truncate flex-1">{ep.route}</span>
                {ep.auth && (
                  <span title={ep.auth}><Key className="size-2.5 text-[#5c5a7a] shrink-0" /></span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Env Vars — collapsible */}
        {(block.env_vars?.length ?? 0) > 0 && (
          <Section label="Env Vars" count={block.env_vars.length} icon={Key}>
            <div className="flex flex-wrap gap-1.5">
              {block.env_vars.map((v, vi) => (
                <span key={vi} className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#f59e0b] border border-[#f59e0b]/15 bg-[#f59e0b]/5">
                  {v}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Acceptance Criteria — collapsible */}
        {(block.acceptance_criteria?.length ?? 0) > 0 && (
          <Section label="Acceptance Criteria" count={block.acceptance_criteria.length} icon={CheckCircle2}>
            {block.acceptance_criteria.map((ac, ai) => (
              <div key={ai} className="flex items-start gap-2 text-[11px] text-[#9896b8] leading-relaxed">
                <div className="size-1.5 rounded-full bg-[#22c55e]/50 shrink-0 mt-1.5" />
                {ac}
              </div>
            ))}
          </Section>
        )}

        {/* Dependencies */}
        {(block.dependencies?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <GitBranch className="size-2.5 text-[#5c5a7a]" />
            <span className="text-[10px] text-[#5c5a7a] font-mono uppercase tracking-wider mr-1">deps:</span>
            {block.dependencies!.map((dep) => (
              <span key={dep} className="text-[10px] font-mono text-[#5c5a7a] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                {dep}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function PlanDocPanel({
  isOpen, onClose, planDoc, isLoading, onImplement, isImplementing, onRegenerate, onSavePlanDoc,
}: PlanDocPanelProps) {
  // local editable copy of blocks
  const [editableBlocks, setEditableBlocks] = React.useState<EditableBlock[]>([]);
  const [activeTab, setActiveTab] = React.useState<"document" | "blocks">("document");
  const [editedMarkdown, setEditedMarkdown] = React.useState("");
  const [isEditMode, setIsEditMode] = React.useState(false); // Default to preview mode

  React.useEffect(() => {
    if (planDoc?.blocks) {
      setEditableBlocks(planDoc.blocks.map(b => ({
        ...b,
        tech_stack: b.tech_stack ?? (b.stack ? [b.stack] : []),
        files: b.files ?? [],
        api_endpoints: b.api_endpoints ?? [],
        env_vars: b.env_vars ?? [],
        acceptance_criteria: b.acceptance_criteria ?? [],
        dependencies: b.dependencies ?? [],
      })));
    }
    if (planDoc?.markdown) {
      setEditedMarkdown(planDoc.markdown);
    }
  }, [planDoc]);

  // Reset on close
  React.useEffect(() => { if (!isOpen) {} }, [isOpen]);

  const handleDownload = () => {
    if (!editedMarkdown) return;
    const blob = new Blob([editedMarkdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${planDoc?.title || "project"}-prd.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseBoldText = (text: string) => {
    const parts = text.split("**");
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-[#f0effe]">{part}</strong>;
      }
      return part;
    });
  };

  const parseMarkdownToReact = (md: string) => {
    if (!md) return <p className="text-[#5c5a7a]">No content provided</p>;
    
    const lines = md.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-3" />;
      
      // Headers: # Title
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-2xl font-bold text-white tracking-tight mt-6 mb-3 border-b border-white/[0.06] pb-2 font-sans" style={{ fontFamily: "Outfit, sans-serif" }}>
            {trimmed.slice(2)}
          </h1>
        );
      }
      // Headers: ## Subtitle
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-lg font-bold text-[#a78bfa] tracking-tight mt-5 mb-2 font-sans" style={{ fontFamily: "Outfit, sans-serif" }}>
            {trimmed.slice(3)}
          </h2>
        );
      }
      // Headers: ### Sub-subtitle
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-md font-bold text-[#9d8ff5] tracking-tight mt-4 mb-2 font-sans" style={{ fontFamily: "Outfit, sans-serif" }}>
            {trimmed.slice(4)}
          </h3>
        );
      }
      // Bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <ul key={idx} className="list-disc list-inside pl-4 mb-1.5 text-[13px] text-[#9896b8] leading-relaxed">
            <li>{parseBoldText(trimmed.slice(2))}</li>
          </ul>
        );
      }
      // Paragraph
      return (
        <p key={idx} className="text-[13.5px] text-[#c4bcfa]/90 leading-relaxed mb-2 font-sans">
          {parseBoldText(trimmed)}
        </p>
      );
    });
  };

  const updateBlock = (blockId: string, updates: Partial<EditableBlock>) => {
    setEditableBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates } : b));
  };

  const blockSummary = editableBlocks;
  const doneCount = blockSummary.filter(b => b.status === "done").length;

  const handleReplan = () => {
    if (onRegenerate) {
      const summary = blockSummary.map(b => `- ${b.title} (${b.type}): ${b.description ?? b.stack}`).join("\n");
      onRegenerate(`Re-plan based on:\n${summary}`);
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[199] bg-black/60 backdrop-blur-md"
          />
        </Dialog.Overlay>

        {/* Panel — wide, tall */}
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] w-[96vw] max-w-6xl h-[90vh] flex flex-col outline-none overflow-hidden rounded-2xl"
            style={{
              background: "rgba(8,8,16,0.92)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,111,238,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] z-10"
              style={{ background: "linear-gradient(90deg, transparent 0%, rgba(124,111,238,0.6) 30%, rgba(167,139,250,0.8) 50%, rgba(124,111,238,0.6) 70%, transparent 100%)" }} />

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(124,111,238,0.2), rgba(167,139,250,0.1))", border: "1px solid rgba(124,111,238,0.25)", boxShadow: "0 0 20px rgba(124,111,238,0.1)" }}>
                  {isLoading
                    ? <Loader2 className="size-4 text-[#9d8ff5] animate-spin" />
                    : <Sparkles className="size-4 text-[#9d8ff5]" />}
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-[15px] font-bold text-[#f0effe] tracking-tight truncate">
                    {isLoading ? "Generating Plan…" : planDoc?.title || "Architecture Plan"}
                  </Dialog.Title>
                  <p className="text-[10px] text-[#5c5a7a] font-mono mt-0.5">
                    {isLoading ? "AI is designing your system architecture" : `${blockSummary.length} blocks · ${doneCount} done`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Dialog.Close asChild>
                  <button className="size-7 flex items-center justify-center rounded-lg text-[#3a3858] hover:text-[#9896b8] hover:bg-white/[0.04] transition-colors">
                    <X className="size-3.5" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* ── Tabs ── */}
            {!isLoading && planDoc && (
              <div className="flex items-center gap-2 px-6 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
                <button
                  onClick={() => setActiveTab("document")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5",
                    activeTab === "document"
                      ? "text-white bg-white/[0.06] border border-white/[0.08]"
                      : "text-[#5c5a7a] hover:text-[#9896b8] hover:bg-white/[0.02] border border-transparent"
                  )}
                >
                  <FileText className="size-3.5" />
                  Product Document (PRD)
                </button>
                <button
                  onClick={() => setActiveTab("blocks")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5",
                    activeTab === "blocks"
                      ? "text-white bg-white/[0.06] border border-white/[0.08]"
                      : "text-[#5c5a7a] hover:text-[#9896b8] hover:bg-white/[0.02] border border-transparent"
                  )}
                >
                  <Layers className="size-3.5" />
                  System Blocks
                </button>
              </div>
            )}

            {/* ── Body ── */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Loading */}
              {isLoading && (
                <div className="flex-1 overflow-y-auto">
                  <PlanLoadingView />
                </div>
              )}

              {/* Document Tab */}
              {!isLoading && planDoc && activeTab === "document" && (
                <div className="flex-1 flex flex-col min-h-0 p-5 space-y-3">
                  {/* PRD Toolbar */}
                  <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] px-4 py-2.5 rounded-xl shrink-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-[#9d8ff5] shrink-0" />
                      <span className="text-[12px] font-bold text-[#f0effe] tracking-tight">PRD Interactive Workspace</span>
                      {/* Word count + reading time */}
                      {editedMarkdown && (() => {
                        const words = editedMarkdown.trim().split(/\s+/).filter(Boolean).length;
                        const mins = Math.max(1, Math.ceil(words / 200));
                        // Completeness: check how many of the 10 sections are present
                        const sections = ["Executive Summary","Feature Spec","Database Schema","API Design","Architecture","Implementation","Security","Testing","Observability","Deployment"];
                        const filled = sections.filter(s => editedMarkdown.toLowerCase().includes(s.toLowerCase())).length;
                        const pct = Math.round((filled / sections.length) * 100);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-[#5c5a7a] bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md">
                              {words.toLocaleString()} words · ~{mins} min read
                            </span>
                            <span className={cn(
                              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border",
                              pct >= 80 ? "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]" :
                              pct >= 50 ? "bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]" :
                              "bg-[#f43f5e]/10 border-[#f43f5e]/20 text-[#f43f5e]"
                            )}>
                              {pct}% complete
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Download PRD Button */}
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#c4bcfa] border border-[#7c6fee]/30 bg-[#7c6fee]/5 hover:bg-[#7c6fee]/15 transition-all"
                      >
                        <Download className="size-3.5" />
                        Download PRD
                      </button>

                      {/* Edit / Preview Toggle */}
                      <button
                        onClick={() => setIsEditMode(prev => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                      >
                        {isEditMode ? (
                          <>
                            <Eye className="size-3.5" />
                            Preview Plan
                          </>
                        ) : (
                          <>
                            <Edit3 className="size-3.5" />
                            Edit Plan
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* PRD Content Area */}
                  <div className="flex-1 w-full overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.01] flex flex-col min-h-0">
                    {isEditMode ? (
                      <textarea
                        value={editedMarkdown}
                        onChange={(e) => setEditedMarkdown(e.target.value)}
                        className="flex-1 w-full p-4 text-[13px] font-mono leading-relaxed text-[#f0effe] bg-transparent resize-none focus:outline-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                        style={{
                          fontFamily: "Outfit, Inter, monospace",
                        }}
                        placeholder="Describe your product requirements document here..."
                      />
                    ) : (
                      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent text-left select-text">
                        {parseMarkdownToReact(editedMarkdown)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Block cards Tab */}
              {!isLoading && planDoc && activeTab === "blocks" && (
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {blockSummary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                      <div className="size-12 rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(124,111,238,0.08)", border: "1px solid rgba(124,111,238,0.15)" }}>
                        <FileText className="size-5 text-[#5c5a7a]" />
                      </div>
                      <p className="text-[13px] text-[#5c5a7a]">No blocks generated yet</p>
                    </div>
                  ) : (
                    blockSummary.map((block, i) => (
                      <BlockCard
                        key={block.id}
                        block={block}
                        index={i}
                        onUpdate={(updates) => updateBlock(block.id, updates)}
                        onRegenerate={onRegenerate ? () => {
                          const ctx = `Regenerate only the "${block.title}" block. Context:\n${JSON.stringify({ title: block.title, type: block.type, description: block.description }, null, 2)}`;
                          onRegenerate(ctx);
                        } : undefined}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !planDoc && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="size-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(124,111,238,0.08)", border: "1px solid rgba(124,111,238,0.15)" }}>
                    <FileText className="size-5 text-[#5c5a7a]" />
                  </div>
                  <p className="text-[13px] text-[#5c5a7a]">Submit a prompt to generate your architecture plan</p>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            {planDoc && !planDoc.is_chat && !isLoading && (
              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between gap-3 shrink-0">
                <p className="text-[11px] text-[#3a3858] flex items-center gap-2">
                  {activeTab === "document"
                    ? "Directly edit your product blueprint"
                    : `${blockSummary.length} block${blockSummary.length !== 1 ? "s" : ""} ready to implement`}
                  {/* LLM provider + model badge */}
                  {planDoc?.provider && (
                    <span className="text-[9px] font-mono bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded-md text-[#3a3858]">
                      {planDoc.provider} · {planDoc.llm_model ?? "AI"}
                    </span>
                  )}
                  {planDoc?.input_tokens && (
                    <span className="text-[9px] font-mono text-[#3a3858]">
                      {((planDoc.input_tokens + (planDoc.output_tokens ?? 0)) / 1000).toFixed(1)}k tokens
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {/* Save Plan Button */}
                  {activeTab === "document" && onSavePlanDoc && (
                    <button
                      onClick={async () => {
                        await onSavePlanDoc(editedMarkdown);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                    >
                      <Save className="size-3.5" />
                      Save Plan
                    </button>
                  )}

                  {/* Re-plan / Regenerate Blocks button */}
                  {onRegenerate && (
                    <button
                      onClick={() => {
                        onRegenerate(activeTab === "document" ? editedMarkdown : `Re-plan based on:\n` + blockSummary.map(b => `- ${b.title} (${b.type}): ${b.description ?? b.stack}`).join("\n"));
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-[#f59e0b] border border-[#f59e0b]/20 bg-[#f59e0b]/6 hover:bg-[#f59e0b]/12 transition-all"
                    >
                      <RefreshCw className="size-3.5" />
                      {activeTab === "document" ? "Regenerate" : "Re-plan"}
                    </button>
                  )}

                  {/* Approve & Build */}
                  {onImplement && (
                    <button
                      onClick={onImplement}
                      disabled={isImplementing}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, #7c6fee, #6355d4)",
                        boxShadow: "0 0 0 1px rgba(124,111,238,0.3), 0 4px 16px rgba(124,111,238,0.25)",
                      }}
                    >
                      {isImplementing
                        ? <><Loader2 className="size-3.5 animate-spin" /> Building…</>
                        : <><Zap className="size-3.5" /> Approve & Build</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
