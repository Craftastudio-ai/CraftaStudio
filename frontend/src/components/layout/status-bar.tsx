import { Share2, Download } from "lucide-react";

interface StatusBarProps {
  hasGeneratedOutput?: boolean;
}

export function StatusBar({ hasGeneratedOutput = false }: StatusBarProps) {
  return (
    <footer className="h-7 border-t border-[var(--border)] bg-[var(--surface)] text-[11px] font-mono flex items-center justify-between px-3 shrink-0 text-[var(--muted-foreground)] z-10 relative">
      <div className="flex items-center gap-4">
        <span>PHASE: DEV_IDLE</span>
        <span>TOKENS: 42,104 / 128,000</span>
      </div>

      {/* ✅ Export & Share only visible when output has been generated */}
      {hasGeneratedOutput && (
        <div className="flex items-center gap-4 animate-in fade-in duration-300">
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Download className="size-3" /> Export
          </button>
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Share2 className="size-3" /> Share
          </button>
        </div>
      )}
    </footer>
  );
}