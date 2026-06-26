/**
 * BE-09 — WebSocket connection manager
 */

// projectId → Set of open sockets
const clients = new Map<string, Set<any>>()

/** Register a new connection for a project. */
export function addClient(projectId: string, socket: any): void {
  if (!clients.has(projectId)) {
    clients.set(projectId, new Set())
  }
  clients.get(projectId)!.add(socket)
  console.log(`[ws] Client connected  — project=${projectId}  total=${clients.get(projectId)!.size}`)
}

/** Remove a connection (call on close / error). */
export function removeClient(projectId: string, socket: any): void {
  const sockets = clients.get(projectId)
  if (!sockets) return
  sockets.delete(socket)
  if (sockets.size === 0) clients.delete(projectId)
  console.log(`[ws] Client disconnected — project=${projectId}  remaining=${sockets.size}`)
}

/** Broadcast a JSON payload to every live socket for a project. */
export function broadcastToProject(projectId: string, payload: object): void {
  const sockets = clients.get(projectId)
  if (!sockets || sockets.size === 0) return

  const message = JSON.stringify(payload)
  let sent = 0

  for (const socket of Array.from(sockets)) {
    try {
      if (socket.readyState === 1) {
        socket.send(message)
        sent++
      }
    } catch (err) {
      console.error('[ws] Send error — removing dead socket:', err)
      sockets.delete(socket)
    }
  }

  console.log(`[ws] Broadcast to project=${projectId}  recipients=${sent}`)
}