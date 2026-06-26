export enum HealthEvent {
  BLOCK_HEALTH_UPDATED = "BLOCK_HEALTH_UPDATED",
  DEPLOYMENT_FAILED = "DEPLOYMENT_FAILED"
}

export const eventBus = {
  emitEvent(projectId: string, eventName: HealthEvent, data: any) {
    console.log(`[EventBus] Project ${projectId} Event ${eventName}:`, data);
    // In a real app, this could stream to WebSockets or other microservices.
  }
};
