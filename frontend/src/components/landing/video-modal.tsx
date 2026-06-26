"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ isOpen, onClose }: VideoModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#07070d]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-5xl aspect-video bg-[#0d0d1a] border border-[#1e1e38] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(124,111,238,0.15)] flex flex-col z-10"
          >
            <div className="flex items-center justify-between px-4 h-12 bg-[#0a0a14] border-b border-[#1e1e38] shrink-0">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#ff5f57]/50" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#febc2e]/50" />
                <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#28c840]/50" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-[#111120] border border-[#1e1e38] rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
                <span className="text-[10px] font-mono text-[#9896b8]">CraftaStudio Demo</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-[#1e1e38] text-[#5a5878] hover:text-[#f0effe] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative flex-1 bg-[#07070d] flex flex-col items-center justify-center">
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: "radial-gradient(#7c6fee 1px, transparent 1px)", backgroundSize: "24px 24px" }}
              />
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#7c6fee]/10 border border-[#7c6fee]/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(124,111,238,0.3)]">
                  <Play size={24} className="text-[#7c6fee] translate-x-0.5" />
                </div>
                <h3 className="text-2xl font-bold text-[#f0effe] mb-2 tracking-tight">Product Demo</h3>
                <p className="text-[#7a7898] text-sm text-center max-w-[300px]">
                  Visualizing architecture and generating production code in real-time.
                </p>
                <div className="mt-8 px-4 py-2 rounded-lg bg-[#1e1e38]/50 border border-[#1e1e38] text-[11px] font-mono text-[#5a5878] uppercase tracking-widest">
                  Coming Soon
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
