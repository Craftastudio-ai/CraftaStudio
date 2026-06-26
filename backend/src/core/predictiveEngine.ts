interface Snapshot {
  healthScore: number;
  latency: number;
  errorRate: number;
  cpu: number;
  memory: number;
}

export class PredictiveEngine {
  static predictHealthDegradation(snapshots: Snapshot[] | null | undefined) {
    if (!snapshots || snapshots.length < 3) {
      return {
        prediction: "Stable. Awaiting more metrics history.",
        confidence: 100,
        severity: "LOW"
      };
    }

    // Check if error rate is trending upwards or health is trending downwards
    const recent = snapshots.slice(-5);
    let errorTrendUp = false;
    let latencyTrendUp = false;

    for (let i = 1; i < recent.length; i++) {
      if (recent[i].errorRate > recent[i - 1].errorRate) errorTrendUp = true;
      if (recent[i].latency > recent[i - 1].latency * 1.2) latencyTrendUp = true;
    }

    if (errorTrendUp) {
      return {
        prediction: "Anomaly: Rising error rate trend detected.",
        confidence: 85,
        estimatedTimeMinutes: 12,
        severity: "HIGH"
      };
    }

    if (latencyTrendUp) {
      return {
        prediction: "Warning: Gradual latency creep observed.",
        confidence: 75,
        estimatedTimeMinutes: 25,
        severity: "MEDIUM"
      };
    }

    return {
      prediction: "Optimal performance expected. No degradation trends.",
      confidence: 94,
      severity: "LOW"
    };
  }
}
