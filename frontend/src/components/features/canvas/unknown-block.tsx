import { Handle, Position } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnknownBlockNode({ data }: { data: any }) {
  return (
    <div className="bg-[var(--surface)] border-2 border-dashed border-red-500/30 rounded-2xl p-4 w-[280px] shadow-xl group transition-all duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <AlertTriangle className="size-4 text-red-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Unknown Type</span>
          <span className="text-sm font-bold text-[var(--foreground)] uppercase tracking-tight truncate">
            {data.type?.toUpperCase() || "N/A"}
          </span>
        </div>
      </div>
      
      <div className="p-3 rounded-xl bg-[var(--foreground)]/5 border border-[var(--border)]">
        <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed italic">
          Rendered via fallback registry because block type &ldquo;{data.type}&rdquo; is not recognized by the renderer.
        </p>
      </div>

      <Handle type="target" position={Position.Left} id="left-in" className="!opacity-0" />
      <Handle type="target" position={Position.Right} id="right-in" className="!opacity-0" />
      <Handle type="target" position={Position.Top} id="top-in" className="!opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-in" className="!opacity-0" />
    </div>
  );
}
