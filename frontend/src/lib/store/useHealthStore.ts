import { create } from "zustand";

interface HealthMetric {
  timestamp: string;
  healthScore: number;
  latency: number;
  errorRate: number;
  cpu: number;
}

interface AIExplainability {
  issue: string;
  cause: string;
  impact: string;
  recommendation: string;
  confidence: number;
}

interface BlockHealthData {
  blockId: string;
  healthScore: number;
  riskScore: number;
  deploymentStatus: "IDLE" | "PENDING" | "STAGING" | "SMOKE_TESTING" | "CANARY" | "MONITORING" | "PROMOTED" | "ROLLED_BACK" | "FAILED";
  stateStartTime: string;
  latencyP95: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  dbLatency: number;
  aiTokenUsage: number;
  isCanary: boolean;
  canaryTrafficPct: number;
  riskExplanation: string | null;
  explainability: AIExplainability | null;
  rollbackReady: boolean;
  lastUpdated: string;
  history: HealthMetric[];
  prediction: {
    prediction: string;
    confidence: number;
    estimatedTimeMinutes?: number;
    severity: string;
  } | null;
  
  // STEP 5 Features
  aiDecision: { action: "PROMOTE" | "HOLD" | "ROLLBACK" | "MONITOR"; confidence: number; reason: string, recommendation: string } | null;
  risk: { schema: number, auth: number, infra: number, flow: number, score: number, level: string, explanation: string };
  baselineDelta: { latency: number, memory: number, errors: number, dbLatency: number, cpu: number };
  canary: { trafficSplit: number, canaryHealth: number, stableHealth: number, latencyDelta: number, errorDelta: number, recommendation: string };
  stagingChecks: { smoke: string, api: string, migration: string, integration: string, runtime: string };
  rollback: { readiness: boolean, eta: string, confidence: number, stableVersion: string, conditions: string[] };
  security: { threatLevel: string, suspiciousRequests: number, authFailureRate: number, apiAbuse: number, tokenAbuse: number, severity: string };
  database: { slowQueries: number, deadlocks: number, lockContention: number, migrationAnalysis: string };
  cost: { runCost: number, estimatedMonthly: number, delta: number };
  audit: { timestamp: string, actor: string, action: string, healthScore: number }[];
  edgeCases: { description: string, recommendation: string }[];
}

interface HealthStore {
  healthData: Record<string, BlockHealthData>;
  activeBlockId: string | null;
  aiSummary: string | null;
  workspaceHealth: number;
  criticalBlocksCount: number;
  
  setActiveBlock: (blockId: string | null) => void;
  updateHealth: (blockId: string, data: Partial<BlockHealthData>) => void;
  setAISummary: (summary: string | null) => void;
  fetchHealth: (blockId: string) => Promise<void>;
  setWorkspaceStats: (stats: { workspaceHealth: number, criticalBlocksCount: number }) => void;
}

export const useHealthStore = create<HealthStore>((set, get) => ({
  healthData: {},
  activeBlockId: null,
  aiSummary: null,
  workspaceHealth: 100,
  criticalBlocksCount: 0,

  setActiveBlock: (blockId) => set({ activeBlockId: blockId }),

  updateHealth: (blockId, data) => set((state) => ({
    healthData: {
      ...state.healthData,
      [blockId]: { ...(state.healthData[blockId] || {}), ...data } as BlockHealthData
    }
  })),

  setAISummary: (summary) => set({ aiSummary: summary }),

  fetchHealth: async (blockId) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004";
      const res = await fetch(`${apiUrl}/api/health/blocks/${blockId}`);
      if (!res.ok) return;
      
      const { health, aiSummary, analysis } = await res.json();
      
      set((state) => ({
        aiSummary,
        healthData: {
          ...state.healthData,
          [blockId]: {
            ...health,
            explainability: analysis?.explainability || null,
            history: health.snapshots || []
          }
        }
      }));
    } catch (err) {
      console.error("Failed to fetch block health:", err);
    }
  },

  setWorkspaceStats: (stats) => set(stats),
}));
