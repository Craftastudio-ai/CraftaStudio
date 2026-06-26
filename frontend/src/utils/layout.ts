import { Node, Edge } from "@xyflow/react";
import { CanvasJSONPayload } from "../types/canvas";

const PREMIUM_COLOR = "#8b5cf6";
const PLANNER_ID = "planner";

export function calculateDagreLayout(
  payload: CanvasJSONPayload,
  _center: { x: number; y: number } = { x: 0, y: 0 }
) {
  const blocks = payload.blocks;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Planner node approximate dimensions
  const PLANNER_W = 460;
  const PLANNER_H = 200;
  const PLANNER_CX = PLANNER_W / 2;  // 230 — center X offset
  const PLANNER_CY = PLANNER_H / 2;  // 100 — center Y offset

  // ── Planner node — positioned so its center is at canvas (0,0) ──
  nodes.push({
    id: PLANNER_ID,
    type: "planner",
    position: { x: -PLANNER_CX, y: -PLANNER_CY },
    data: {},
    draggable: true,
  });

  const N = blocks.length;
  // Scale radius based on block count so nodes don't overlap
  const X_RADIUS = Math.max(550, N * 55);
  const Y_RADIUS = Math.max(380, N * 38);

  // ── Radial Block Placement & Edges ──
  blocks.forEach((block, i) => {
    const nodeId = block.id || `temp-${Math.random().toString(36).substr(2, 9)}`;

    // Distribute evenly starting from the right, going clockwise
    let angle = (i / N) * 2 * Math.PI - Math.PI / 2; // start from top

    if (N === 2) angle = i === 0 ? 0 : Math.PI;
    if (N === 3) angle = (i / N) * 2 * Math.PI + Math.PI / 2;

    // Blocks radiate from planner CENTER (0,0 after offset)
    const x = Math.cos(angle) * X_RADIUS;
    const y = Math.sin(angle) * Y_RADIUS;

    nodes.push({
      id: nodeId,
      type: block.type === "legacy-system" ? "legacy-system" : "block",
      position: { x: x - 120, y: y - 100 }, // Center the block
      data: { ...block, id: nodeId },
      draggable: true,
    });

    // Determine the best handles based on position
    let sourceHandle = "right";
    let targetHandle = "left-in";
    
    // Normalize degree to 0-360
    let deg = ((angle * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    
    // Quadrants based on 0-360 degrees
    if (deg >= 315 || deg < 45) {
      // Right
      sourceHandle = "right";
      targetHandle = "left-in";
    } else if (deg >= 45 && deg < 135) {
      // Bottom
      sourceHandle = "bottom";
      targetHandle = "top-in";
    } else if (deg >= 135 && deg < 225) {
      // Left
      sourceHandle = "left";
      targetHandle = "right-in";
    } else if (deg >= 225 && deg < 315) {
      // Top
      sourceHandle = "top";
      targetHandle = "bottom-in";
    }

    edges.push({
      id: `e-radial-${nodeId}`,
      source: PLANNER_ID,
      sourceHandle: sourceHandle,
      target: nodeId,
      targetHandle: targetHandle,
      type: "flowing",
      data: { animated: true, color: PREMIUM_COLOR, colorEnd: PREMIUM_COLOR },
    });
  });

  return { nodes, edges };
}
