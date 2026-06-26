"use client";

import React from "react";
import { Download, Copy, ChevronUp, ChevronDown, Check, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumPlanProps {
  title: string;
  summary: string;
  items: string[];
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
  className?: string;
}

export function PremiumPlan({
  title = "PlacePro Coordinator Module Plan",
  summary = "Add a new Coordinator section to the existing admin sidebar and bring over the full coordinator bundle behavior into PlacePro while keeping the current admin UI design system intact.",
  items = [
    "coordinator roster CRUD",
    "attendance letter preview/download",
    "coordinator application form builder",
    "public coordinator application form",
    "admin response review workflow"
  ],
  isOpen,
  onClose,
  onAction,
  className
}: PremiumPlanProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${summary}\n\n${items.join("\n")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm", className)}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#181818]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest uppercase text-white/40">Plan</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-1.5 text-white/40 hover:text-white transition-colors" title="Download">
              <Download className="size-4" />
            </button>
            <button 
              className="p-1.5 text-white/40 hover:text-white transition-colors" 
              onClick={handleCopy}
              title="Copy"
            >
              {copied ? <Check className="size-4 text-[var(--primary-accent)]" /> : <Copy className="size-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors" title="Collapse">
              <ChevronUp className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={cn(
          "p-8 transition-all duration-500 overflow-y-auto",
          isExpanded ? "max-h-[70vh]" : "max-h-[400px]"
        )}>
          <h1 className="text-3xl font-bold text-white mb-6 tracking-tight leading-tight">
            {title}
          </h1>

          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-bold text-white mb-3">Summary</h2>
              <p className="text-[15px] text-white/70 leading-relaxed font-normal">
                {summary}
              </p>
            </section>

            <section>
              <ul className="space-y-2.5">
                {items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 group">
                    <div className="size-1.5 rounded-full bg-white/20 mt-2 transition-colors group-hover:bg-[var(--primary-accent)]" />
                    <span className="text-[15px] text-white/60 group-hover:text-white/90 transition-colors">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {!isExpanded && (
             <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none" />
          )}
        </div>

        {/* Actions bar at bottom */}
        <div className="flex flex-col gap-4 p-8 pt-0">
          <div className="flex items-center justify-center gap-3">
            <button 
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary-accent)] text-white rounded-full text-[13px] font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
              onClick={() => {
                onAction?.("Implement plan");
                onClose();
              }}
            >
              Implement plan
            </button>
            <button 
              className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-full text-[13px] font-medium hover:bg-white/10 hover:text-white transition-all"
              onClick={() => {
                onAction?.("Change anything");
                onClose();
              }}
            >
              Change anything
            </button>
          </div>
          
          <div className="flex justify-center mt-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors"
            >
              {isExpanded ? (
                <>Collapse plan <ChevronUp className="size-3" /></>
              ) : (
                <>Expand plan <ChevronDown className="size-3" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
