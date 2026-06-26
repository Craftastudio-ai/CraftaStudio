"use client";

import { BaseEdge, EdgeProps, getBezierPath } from "@xyflow/react";
import { useEdgeHighlight } from "@/components/features/canvas/edge-highlight-context";

//  Constants 
const PARTICLE_COUNT = 4;

/** Default (idle) edge appearance */
const DEFAULT_STYLE = {
  stroke: "#2A2A2A",
  strokeWidth: 1.2,
  strokeOpacity: 0.55,
  strokeDasharray: "5 8",
} as const;

/** Active (running) edge appearance */
const ACTIVE_STYLE = {
  stroke: "#8B5CF6",
  strokeWidth: 2.5,
  strokeOpacity: 1,
  strokeDasharray: "6 6",
} as const;

// Types 
interface FlowingEdgeData {
  animated?: boolean;
  color?: string;
  colorEnd?: string;
}

//  Component 
export function FlowingEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data: rawData,
  selected,
}: EdgeProps) {
  //  Derive active state from global activeNodeId (never stored in edge data)
  const { activeNodeId } = useEdgeHighlight();
  const isActive = activeNodeId !== null &&
    (source === activeNodeId || target === activeNodeId);

  const data = rawData as FlowingEdgeData | undefined;
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Colour sources: prefer edge data palette, fall back to active/default 
  const colorStart = data?.color ?? (isActive ? ACTIVE_STYLE.stroke : "#7c3aed");
  const colorEnd   = data?.colorEnd ?? (isActive ? "#6366f1" : "#3b82f6");
  const isAnimated = data?.animated !== false;

  // Unique SVG ids 
  const gradId  = `grad-${id}`;
  const glowId  = `glow-${id}`;
  const trailId = `trail-${id}`;
  const pathId  = `path-${id}`;

  // Particle config for animateMotion dots 
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: `${id}-p${i}`,
    delay: `${(i / PARTICLE_COUNT) * -2.8}s`,
    dur: `${2.2 + i * 0.2}s`,
    size: i === 0 ? 2.8 : 1.8,
    opacity: i === 0 ? 0.95 : 0.6,
  }));

  //  Resolved stroke style (derive, never store in edge)
  const resolvedStroke     = isActive ? ACTIVE_STYLE.stroke     : DEFAULT_STYLE.stroke;
  const resolvedWidth      = isActive ? ACTIVE_STYLE.strokeWidth : DEFAULT_STYLE.strokeWidth;
  const resolvedOpacity    = isActive ? ACTIVE_STYLE.strokeOpacity : DEFAULT_STYLE.strokeOpacity;
  const resolvedDashArray  = isActive ? ACTIVE_STYLE.strokeDasharray : DEFAULT_STYLE.strokeDasharray;

  // When selected override opacity slightly
  const finalOpacity = selected ? 1 : resolvedOpacity;

  return (
    <g className="flowing-edge-group">
      <defs>
        {/* Multi-stop gradient for the path stroke */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
          x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%"   stopColor={colorStart} stopOpacity="0.85" />
          <stop offset="50%"  stopColor={colorStart} stopOpacity={isActive ? "0.7" : "0.45"} />
          <stop offset="100%" stopColor={colorEnd}   stopOpacity="0.85" />
        </linearGradient>

        {/* Bloom glow filter — stronger when active */}
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={isActive ? "4" : "3"} result="blur1" />
          <feGaussianBlur stdDeviation={isActive ? "8" : "6"} result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Particle trail gradient */}
        <radialGradient id={trailId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={isActive ? ACTIVE_STYLE.stroke : colorStart} stopOpacity="1" />
          <stop offset="50%"  stopColor={isActive ? ACTIVE_STYLE.stroke : colorStart} stopOpacity="0.5" />
          <stop offset="100%" stopColor={isActive ? ACTIVE_STYLE.stroke : colorStart} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Backdrop blur halo (enhanced when active) ── */}
      <path
        d={edgePath}
        fill="none"
        stroke={resolvedStroke}
        strokeWidth={isActive ? 14 : 8}
        strokeOpacity={isActive ? 0.08 : 0.025}
        style={{ filter: `blur(${isActive ? 6 : 4}px)` }}
      />

      {/* ── Main visible edge path ── */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isActive ? resolvedStroke : `url(#${gradId})`,
          strokeWidth: resolvedWidth,
          strokeDasharray: resolvedDashArray,
          strokeOpacity: finalOpacity,
          fill: "none",
          // CSS animation for the marching-dashes flow effect
          animation: isActive ? "edge-flow 0.5s linear infinite" : undefined,
          // Drop-shadow glow when active (per spec)
          filter: isActive
            ? `drop-shadow(0 0 6px ${ACTIVE_STYLE.stroke})`
            : selected
              ? `drop-shadow(0 0 4px ${colorStart})`
              : undefined,
          transition: "stroke 0.35s ease, stroke-width 0.35s ease, stroke-opacity 0.35s ease, filter 0.35s ease",
          ...style,
        }}
      />

      {/* ── Selected/active glow overlay on the path ── */}
      {(selected || isActive) && (
        <path
          d={edgePath}
          fill="none"
          stroke={isActive ? ACTIVE_STYLE.stroke : colorStart}
          strokeWidth={isActive ? 3 : 2}
          strokeOpacity={isActive ? 0.45 : 0.25}
          filter={`url(#${glowId})`}
          style={{
            animation: isActive ? "edge-flow 0.5s linear infinite" : undefined,
            strokeDasharray: isActive ? ACTIVE_STYLE.strokeDasharray : undefined,
          }}
        />
      )}

      {/* ── Animated signal particles (always run, more vibrant when active) ── */}
      {isAnimated &&
        particles.map((p) => (
          <g key={p.id} filter={`url(#${glowId})`}>
            {/* Soft trail aura */}
            <circle r={p.size * (isActive ? 3 : 2.5)} fill={`url(#${trailId})`} opacity={isActive ? 0.5 : 0.3}>
              <animateMotion
                dur={isActive ? `${parseFloat(p.dur) * 0.6}s` : p.dur}
                repeatCount="indefinite"
                begin={p.delay}
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.45 0 0.55 1"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>

            {/* Bright core dot */}
            <circle
              r={isActive ? p.size * 1.4 : p.size}
              fill={isActive ? ACTIVE_STYLE.stroke : colorStart}
              opacity={p.opacity}
            >
              <animateMotion
                dur={isActive ? `${parseFloat(p.dur) * 0.6}s` : p.dur}
                repeatCount="indefinite"
                begin={p.delay}
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.45 0 0.55 1"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

      {/* Hidden named path for animateMotion reference */}
      <path id={pathId} d={edgePath} fill="none" stroke="none" />
    </g>
  );
}
