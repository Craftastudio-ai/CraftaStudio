"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────
export type NodeExecutionStatus = "idle" | "running" | "completed";

interface EdgeHighlightContextValue {
  /** The ID of the node currently executing, or null if none is active. */
  activeNodeId: string | null;
  /** Call when a node starts running — sets activeNodeId and clears any previous. */
  startNode: (nodeId: string) => void;
  /** Call when a node finishes — resets activeNodeId to null. */
  finishNode: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────
const EdgeHighlightContext = createContext<EdgeHighlightContextValue>({
  activeNodeId: null,
  startNode: () => {},
  finishNode: () => {},
});

// ─── Provider ──────────────────────────────────────────────────────────────
export function EdgeHighlightProvider({ children }: { children: ReactNode }) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  /**
   * Begin execution for a node.
   * Automatically replaces any previously active node — only one active at a time.
   */
  const startNode = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
  }, []);

  /**
   * Signal completion — returns all edges to their default style.
   */
  const finishNode = useCallback(() => {
    setActiveNodeId(null);
  }, []);

  return (
    <EdgeHighlightContext.Provider value={{ activeNodeId, startNode, finishNode }}>
      {children}
    </EdgeHighlightContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────
/**
 * Consume the edge highlight state anywhere inside the canvas.
 * Use activeNodeId to derive whether an edge or node should be highlighted.
 */
export function useEdgeHighlight() {
  return useContext(EdgeHighlightContext);
}
