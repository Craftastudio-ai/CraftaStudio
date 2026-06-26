/** Shared map of AbortControllers keyed by runId.
 *  Exported so both workflow routes and admin routes can cancel in-flight LLM calls. */
export const runAbortControllers = new Map<string, AbortController>();
