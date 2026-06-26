import { PrismaClient, DeploymentState } from "@prisma/client";
import { broadcastToProject } from "../ws/wsManager";
import { eventBus, HealthEvent } from "../events/eventBus";
import { PredictiveEngine } from "../core/predictiveEngine";

const prisma = new PrismaClient();

export class HealthService {
  /**
   * Fetches health for a specific block, creating it if it doesn't exist.
   */
  static async getBlockHealth(blockId: string) {
    let health: any = await prisma.blockHealth.findUnique({
      where: { blockId },
      include: { snapshots: { orderBy: { timestamp: "desc" }, take: 20 } },
    });

    if (!health) {
      const block = await prisma.block.findUnique({ where: { id: blockId } });
      
      if (!block) {
        // Return a mock block health if the block hasn't been saved to the DB yet
        return {
          id: `mock-${blockId}`,
          blockId,
          healthScore: 98,
          riskScore: 2,
          deploymentStatus: DeploymentState.IDLE,
          stateStartTime: new Date(Date.now() - 45 * 60000).toISOString(),
          latencyP95: 42,
          errorRate: 0.1,
          cpuUsage: 15,
          memoryUsage: 256,
          dbLatency: 12,
          aiTokenUsage: 1450,
          rollbackReady: false,
          isCanary: false,
          canaryTrafficPct: 0,
          lastUpdated: new Date().toISOString(),
          snapshots: [],
          risk: { schema: 42, auth: 10, infra: 20, flow: 15, score: 42, level: "Medium", explanation: "JWT validation rules changed." },
          baselineDelta: { latency: 18, memory: 6, errors: 0, dbLatency: -1, cpu: 4 },
          canary: { trafficSplit: 5, canaryHealth: 100, stableHealth: 98, latencyDelta: 2, errorDelta: 0, recommendation: "Continue rollout" },
          stagingChecks: { smoke: "PASS", api: "PASS", migration: "PASS", integration: "PASS", runtime: "PASS" },
          rollback: { readiness: true, eta: "< 45s", confidence: 96, stableVersion: "v1.2.3", conditions: ["Latency > 500ms", "Error > 5%"] },
          security: { threatLevel: "LOW", suspiciousRequests: 12, authFailureRate: 0.05, apiAbuse: 0, tokenAbuse: 0, severity: "LOW" },
          database: { slowQueries: 0, deadlocks: 0, lockContention: 0, migrationAnalysis: "No destructive changes detected." },
          cost: { runCost: 0.14, estimatedMonthly: 42.50, delta: 0 },
          aiDecision: { action: "PROMOTE", confidence: 91, reason: "Latency stable and no anomaly spikes detected.", recommendation: "Continue progressive rollout." },
          audit: [
            { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), actor: "System", action: "Staging Promoted", healthScore: 100 },
            { timestamp: new Date(Date.now() - 60 * 60000).toISOString(), actor: "AI Guard", action: "Smoke Tests Passed", healthScore: 99 },
          ],
          edgeCases: [
            { description: "Low traffic volume detected.", recommendation: "Extend monitoring window by 15m." }
          ]
        };
      }

      health = {
        ...(await prisma.blockHealth.create({
          data: {
            blockId,
            healthScore: 100,
            deploymentStatus: DeploymentState.PROMOTED,
            latencyP95: Math.random() * 50 + 20,
            errorRate: 0,
            cpuUsage: Math.random() * 10 + 5,
            memoryUsage: Math.random() * 100 + 200,
            rollbackReady: true,
          },
          include: { snapshots: true },
        })),
        stateStartTime: new Date(Date.now() - 100 * 60000).toISOString(),
        dbLatency: 15,
        aiTokenUsage: 3500,
        risk: { schema: 0, auth: 0, infra: 5, flow: 5, score: 3, level: "Minimal", explanation: "Production workload stable." },
        baselineDelta: { latency: 0, memory: 0, errors: 0, dbLatency: 0, cpu: 0 },
        canary: { trafficSplit: 100, canaryHealth: 100, stableHealth: 100, latencyDelta: 0, errorDelta: 0, recommendation: "Fully promoted" },
        stagingChecks: { smoke: "PASS", api: "PASS", migration: "PASS", integration: "PASS", runtime: "PASS" },
        rollback: { readiness: true, eta: "1m 30s", confidence: 99, stableVersion: "v1.2.2", conditions: ["Latency > 500ms"] },
        security: { threatLevel: "LOW", suspiciousRequests: 0, authFailureRate: 0, apiAbuse: 0, tokenAbuse: 0, severity: "NONE" },
        database: { slowQueries: 0, deadlocks: 0, lockContention: 0, migrationAnalysis: "No destructive changes detected." },
        cost: { runCost: 0.14, estimatedMonthly: 42.50, delta: 0 },
        aiDecision: { action: "MONITOR", confidence: 99, reason: "Service stable in production.", recommendation: "Continue standard monitoring." },
        audit: [
          { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), actor: "System", action: "Staging Promoted", healthScore: 100 },
        ],
        edgeCases: []
      } as any;
    }

    // Inject STEP 5 virtual properties if they are not present (for existing db records)
    if (!health.aiDecision) {
      health.risk = { schema: 0, auth: 0, infra: 5, flow: 5, score: 3, level: "Minimal", explanation: "Production workload stable." };
      health.baselineDelta = { latency: 0, memory: 0, errors: 0, dbLatency: 0, cpu: 0 };
      health.canary = { trafficSplit: 100, canaryHealth: 100, stableHealth: 100, latencyDelta: 0, errorDelta: 0, recommendation: "Fully promoted" };
      health.stagingChecks = { smoke: "PASS", api: "PASS", migration: "PASS", integration: "PASS", runtime: "PASS" };
      health.rollback = { readiness: true, eta: "1m 30s", confidence: 99, stableVersion: "v1.2.2", conditions: ["Latency > 500ms"] };
      health.security = { threatLevel: "LOW", suspiciousRequests: 0, authFailureRate: 0, apiAbuse: 0, tokenAbuse: 0, severity: "NONE" };
      health.database = { slowQueries: 0, deadlocks: 0, lockContention: 0, migrationAnalysis: "No destructive changes detected." };
      health.cost = { runCost: 0.14, estimatedMonthly: 42.50, delta: 0 };
      health.aiDecision = { action: "MONITOR", confidence: 99, reason: "Service stable in production.", recommendation: "Continue standard monitoring." };
      health.audit = [
        { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), actor: "System", action: "Staging Promoted", healthScore: 100 },
      ];
      health.edgeCases = [];
      health.stateStartTime = new Date(Date.now() - 100 * 60000).toISOString();
      health.dbLatency = 15;
      health.aiTokenUsage = 3500;
    }

    return health;
  }

  /**
   * Simulates a health update for a block and broadcasts it.
   */
  static async updateBlockHealth(blockId: string) {
    const health = await this.getBlockHealth(blockId);
    
    // Simulate some variance
    const latencyP95 = Math.max(10, health.latencyP95 + (Math.random() - 0.5) * 10);
    const errorRate = Math.random() > 0.95 ? Math.random() * 2 : 0;
    const cpuUsage = Math.max(1, Math.min(100, health.cpuUsage + (Math.random() - 0.5) * 5));
    
    // Calculate new health score
    let healthScore = 100;
    if (latencyP95 > 100) healthScore -= 10;
    if (errorRate > 1) healthScore -= 20;
    if (cpuUsage > 80) healthScore -= 15;
    healthScore = Math.max(0, healthScore);

    let updated: any;
    if (health.id.startsWith("mock-")) {
      updated = {
        ...health,
        healthScore,
        latencyP95,
        errorRate,
        cpuUsage,
        lastUpdated: new Date(),
      };
    } else {
      const prismaUpdated = await prisma.blockHealth.update({
        where: { blockId },
        data: {
          healthScore,
          latencyP95,
          errorRate,
          cpuUsage,
          lastUpdated: new Date(),
        },
      });

      updated = {
        ...prismaUpdated,
        stateStartTime: health.stateStartTime,
        dbLatency: 15,
        aiTokenUsage: 3500,
        risk: health.risk,
        baselineDelta: health.baselineDelta,
        canary: health.canary,
        stagingChecks: health.stagingChecks,
        rollback: health.rollback,
        security: health.security,
        database: health.database,
        cost: health.cost,
        aiDecision: health.aiDecision,
        audit: health.audit,
        edgeCases: health.edgeCases
      };

      // Create a snapshot
      await prisma.healthSnapshot.create({
        data: {
          blockHealthId: updated.id,
          healthScore: updated.healthScore,
          latency: updated.latencyP95,
          errorRate: updated.errorRate,
          cpu: updated.cpuUsage,
          memory: updated.memoryUsage,
        },
      });
    }

    // Predictive Analysis
    const prediction = PredictiveEngine.predictHealthDegradation(health.snapshots);

    // Broadcast to project
    const block = await prisma.block.findUnique({ where: { id: blockId } });
    if (block) {
      eventBus.emitEvent(block.projectId, HealthEvent.BLOCK_HEALTH_UPDATED, {
        blockId,
        health: updated,
        prediction
      });

      if (updated.healthScore < 50) {
        eventBus.emitEvent(block.projectId, HealthEvent.DEPLOYMENT_FAILED, {
          blockId,
          reason: "Critical health score degradation"
        });
      }
    }

    return updated;
  }

  /**
   * AI-generated anomaly detection summary.
   */
  static async getAIHealthSummary(blockId: string) {
    const health = await this.getBlockHealth(blockId);
    
    // In a real app, we'd call the Python agent service here.
    // For now, we'll return a simulated AI insight.
    if (health.healthScore > 90) {
      return "Deployment is stable. All metrics are within normal operating parameters.";
    } else if (health.healthScore > 70) {
      return "Minor latency fluctuations detected. Anomaly analysis suggests non-critical variance.";
    } else {
      return "CRITICAL: High error rate detected. AI recommends immediate investigation or rollback.";
    }
  }
}
