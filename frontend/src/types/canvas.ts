/**
 * Represents a nested feature or sub-item within a larger architectural block.
 */
export interface CanvasSubBlock {
  id: string;
  type: string;
  title?: string;
  status?: "done" | "running" | "idle" | "error" | "awaiting_confirm" | "failed" | "pending";
  description?: string;
}

/**
 * Represents a top-level architectural block in the canvas graph.
 */
export interface CanvasBlock {
  id: string;
  type: string;
  title?: string;
  stack?: string;
  description?: string;
  status: "done" | "running" | "idle" | "error" | "awaiting_confirm" | "failed" | "pending";
  files?: string[];
  acceptance_criteria?: string[];
  dependencies?: string[];
  estimated_lines?: number;
  subBlocks?: CanvasSubBlock[];
}

export interface CanvasConnection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  connectionType?: string;
}

/**
 * The structured payload received from the planner engine.
 */
export interface CanvasJSONPayload {
  blocks: CanvasBlock[];
  connections?: CanvasConnection[];
}
