import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Node, Edge, useReactFlow, ReactFlowProvider } from "@xyflow/react";
import { X } from "lucide-react";
import { BlockNode } from "@/components/features/canvas/block-node";
import { cn } from "@/lib/utils";

interface BlockFocusOverlayProps {
  block: Node | null;
  onClose: () => void;
  onSubblockClick: (subblock: Node) => void;
}

function FocusCanvas({ block, onSubblockClick }: { block: Node; onSubblockClick: (node: Node) => void }) {
  const nodeTypes = useMemo(() => ({ block: BlockNode }), []);
  const { fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    if (!block) return;

    const files: string[] = Array.isArray(block.data.files) ? block.data.files : [];
    
    // Main block positioned at the center
    const mainNode: Node = {
      id: block.id,
      type: "block",
      position: { x: 0, y: 0 },
      data: { ...block.data, isSubblock: false },
    };

    const newNodes: Node[] = [mainNode];
    const newEdges: Edge[] = [];

    // Distribute files equally on both sides (left and right)
    const totalFiles = files.length;
    const midPoint = Math.ceil(totalFiles / 2);

    const leftFiles = files.slice(0, midPoint);
    const rightFiles = files.slice(midPoint);

    const verticalSpacing = 160;
    const horizontalOffset = 450;

    // Left subblocks
    leftFiles.forEach((file, idx) => {
      const id = `${block.id}-left-${idx}`;
      newNodes.push({
        id,
        type: "block",
        position: { 
          x: -horizontalOffset, 
          y: (idx * verticalSpacing) - ((leftFiles.length - 1) * verticalSpacing / 2) 
        },
        data: {
          id: `SUB-L${idx + 1}`,
          title: file,
          stack: "REACT COMPONENT",
          status: "done",
          files: [],
          isSubblock: true,
          parentId: block.id,
        },
      });

      newEdges.push({
        id: `e-${block.id}-${id}`,
        source: block.id,
        target: id,
        sourceHandle: "left-out", // Assuming BlockNode has left-out or just left
        targetHandle: "right-in",
        animated: false,
        type: "default",
      });
    });

    // Right subblocks
    rightFiles.forEach((file, idx) => {
      const id = `${block.id}-right-${idx}`;
      newNodes.push({
        id,
        type: "block",
        position: { 
          x: horizontalOffset, 
          y: (idx * verticalSpacing) - ((rightFiles.length - 1) * verticalSpacing / 2) 
        },
        data: {
          id: `SUB-R${idx + 1}`,
          title: file,
          stack: "REACT COMPONENT",
          status: "done",
          files: [],
          isSubblock: true,
          parentId: block.id,
        },
      });

      newEdges.push({
        id: `e-${block.id}-${id}`,
        source: block.id,
        target: id,
        sourceHandle: "right-out",
        targetHandle: "left-in",
        animated: false,
        type: "default",
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => {
      fitView({ padding: 0.3, duration: 800 });
    }, 100);
  }, [block, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => {
        if (node.data.isSubblock) {
          onSubblockClick(node);
        }
      }}
      fitView
      className="[&_.react-flow__attribution]:hidden"
    >
      <Background color="var(--primary-accent)" gap={24} size={1} variant={"dots" as any} className="opacity-[0.25]" />
    </ReactFlow>
  );
}

export function BlockFocusOverlay({ block, onClose, onSubblockClick }: BlockFocusOverlayProps) {
  if (!block) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--background)]/90 backdrop-blur-sm flex flex-col animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute top-6 right-8 z-[70]">
        <button 
          onClick={onClose}
          className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] shadow-xl transition-all"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="absolute top-8 left-8 z-[70] flex flex-col gap-1">
        <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">Block Inspection</h2>
        <span className="text-xs text-[var(--primary-accent)] font-mono uppercase tracking-widest">{block.id} Architecture</span>
      </div>

      <div className="flex-1 w-full h-full relative">
        <ReactFlowProvider>
          <FocusCanvas block={block} onSubblockClick={onSubblockClick} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
