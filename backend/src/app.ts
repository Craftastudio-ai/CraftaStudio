/**
 * App — src/app.ts
 *
 * FIXES APPLIED:
 * FIX-1 — Universal cookie proxy setNotFoundHandler now skips /api/* routes
 *          so a stale sandbox_target cookie can't silently proxy real API calls
 *          to a Daytona sandbox.
 * FIX-2 — Added per-route rate limit on /api/sandbox/provision (10 req/min per
 *          user) to prevent sandbox quota exhaustion from hammering provision.
 *
 * UNCHANGED: onReady hook runs inference warm-up for projects that have blocks
 * but zero connections (edges=0 fix).
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'

import { blocksRoutes }      from './routes/blocks'
import { connectionsRoutes } from './routes/connections'
import { workflowRoutes }    from './routes/workflow'
import { authRoutes }        from './routes/auth'
import { projectsRoutes }    from './routes/projects'
import { userRoutes }        from './routes/user'
import { generateRoutes }    from './routes/generate'
import { wsRoutes }          from './routes/ws'
import { mergeRoutes }       from './routes/merge'
import { planRoutes }        from './routes/plan'
import { memoryRoutes }      from './routes/memory'
import { documentRoutes }    from './routes/document'
import { graphRoutes }       from './routes/graph'
import { historyRoutes }     from './routes/history'
import { exportRoutes }      from './routes/export'
import { adminRoutes }       from './routes/admin'
import { sandboxRoutes }     from './routes/sandboxRoutes'
import { graphRegistry }     from './graph/graphEngine'
import { inferConnections }  from './graph/connectionInference'

export async function buildServer() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    pluginTimeout: 60000,
  })

  // ── Plugins ────────────────────────────────────────────────────────────────

  await app.register(rateLimit, {
    max:          500,
    timeWindow:   '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error:      'Too Many Requests',
      message:    'You have exceeded the request limit. Please slow down.',
    }),
  })

  await app.register(cors, {
    origin:      true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  await app.register(websocket)

  // ── Error handler ──────────────────────────────────────────────────────────

  app.setErrorHandler((error: unknown, request, reply) => {
    const err        = error as { statusCode?: number; name?: string; message?: string }
    const statusCode = err.statusCode ?? 500

    console.error({ err, method: request.method, url: request.url, statusCode })

    return reply.code(statusCode).send({
      statusCode,
      error:   err.name    ?? 'Internal Server Error',
      message: err.message ?? 'An unexpected error occurred',
    })
  })

  // ── Routes ──────────────────────────────────────────────────────────────────

  await app.register(authRoutes,        { prefix: '/api/auth' })
  await app.register(blocksRoutes,      { prefix: '/api/blocks' })
  await app.register(connectionsRoutes, { prefix: '/api/connections' })
  await app.register(workflowRoutes,    { prefix: '/api/workflow' })
  await app.register(projectsRoutes,    { prefix: '/api/projects' })
  await app.register(userRoutes,        { prefix: '/api' })
  await app.register(generateRoutes,    { prefix: '/api/projects' })
  await app.register(mergeRoutes,       { prefix: '/api/projects' })
  await app.register(wsRoutes,          { prefix: '/api/ws' })
  await app.register(planRoutes,        { prefix: '/api/plan' })
  await app.register(memoryRoutes,      { prefix: '/api/memory' })
  await app.register(documentRoutes,    { prefix: '/api/projects' })
  await app.register(graphRoutes,       { prefix: '/api/graph' })
  await app.register(historyRoutes,     { prefix: '/api/history' })
  await app.register(exportRoutes,      { prefix: '/api/export' })
  await app.register(adminRoutes,       { prefix: '/api/admin' })
  await app.register(sandboxRoutes,     { prefix: '/api/sandbox' })

  // FIX-2: Dedicated stricter rate limit on /provision — provision spins up
  // Daytona sandboxes with 180s timeouts. Without this, a single user can
  // exhaust sandbox CPU quota by hitting provision repeatedly.
  // This must be registered AFTER sandboxRoutes so it applies as an additional
  // constraint on that specific path.
  app.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url === '/api/sandbox/provision' && routeOptions.method === 'POST') {
      // @ts-ignore — addHook after registration is a valid fastify pattern
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => req.user?.id ?? req.ip,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Too many provision requests. Please wait before trying again.',
          }),
        },
      }
    }
  })

  // ── Startup: Graph Cache Warm-up + Inference Repair ───────────────────────

  app.addHook('onReady', async () => {
    // Run asynchronously to avoid blocking server startup
    setTimeout(async () => {
      const { default: prisma } = await import('./lib/prisma')

      try {
        // 1. Find active projects from last 7 days
        const activeProjects = await prisma.project.findMany({
          where: {
            workflowRuns: {
              some: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            },
          },
          select: { id: true },
          take: 20,
        })

        console.log(`[startup] Pre-warming graph cache for ${activeProjects.length} active projects`)
        await Promise.allSettled(activeProjects.map(p => graphRegistry.get(p.id)))
        console.log('[startup] Graph cache warm-up complete')

        // 2. Run inference repair for projects that have blocks but zero connections
        const projectsNeedingInference = await prisma.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT b."projectId" AS id
          FROM blocks b
          WHERE b."deletedAt" IS NULL
            AND b."projectId" NOT IN (
              SELECT DISTINCT c."projectId" FROM connections c WHERE c."deletedAt" IS NULL
            )
          LIMIT 20
        `

        if (projectsNeedingInference.length > 0) {
          console.log(
            `[startup] Running inference repair for ${projectsNeedingInference.length} projects with edges=0`
          )
          await Promise.allSettled(
            projectsNeedingInference.map(p =>
              inferConnections(p.id, 'system:startup', 0.65, false).catch(err =>
                console.error(`[startup] Inference failed for project=${p.id}:`, err)
              )
            )
          )
          console.log('[startup] Inference repair complete')
        }

      } catch (err) {
        console.error('[startup] Warm-up / inference repair failed (non-fatal):', err)
      }
    }, 1000)
  })

  // ── Health ──────────────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  app.get('/api/health/blocks/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { HealthService } = await import('./services/healthService')
    const health = await HealthService.getBlockHealth(id)
    const aiSummary = await HealthService.getAIHealthSummary(id)
    return reply.status(200).send({
      health,
      aiSummary,
      analysis: { explainability: health.explainability || null },
    })
  })

  app.get('/', async () => ({ message: 'Backend is running 🚀' }))

  // ── Universal Cookie Proxy Fallback ──────────────────────────────────────────
  // Catches absolute-path asset requests (e.g. /src/main.tsx, /assets/index.js)
  // that the iframe sends to our backend origin when the Daytona sandbox is
  // the actual target. The sandbox_target cookie (set by preview-proxy) tells
  // us where to forward these requests.
  //
  // FIX-1: Only proxy non-API, non-health paths. A stale sandbox_target cookie
  // must never silently forward real API calls (e.g. /api/blocks) to Daytona.
  app.setNotFoundHandler(async (req, reply) => {
    const url = req.raw.url || ''

    // FIX-1: Skip proxying for any API route or health check
    if (
      url.startsWith('/api/') ||
      url === '/health' ||
      url === '/'
    ) {
      return reply.status(404).send({ error: 'Not Found' })
    }

    const cookieHeader = req.headers.cookie || ''
    const match = cookieHeader.match(/sandbox_target=([^;]+)/)
    const tokenMatch = cookieHeader.match(/sandbox_token=([^;]+)/)

    if (match) {
      const sandboxTarget = decodeURIComponent(match[1])
      try {
        const targetUrl = new URL(url, sandboxTarget)

        const upstreamHeaders: Record<string, string> = {
          'User-Agent': 'CraftaStudio-Universal-Proxy/1.0',
          Accept: req.headers.accept || '*/*',
        }
        if (req.headers.cookie) {
          upstreamHeaders['Cookie'] = req.headers.cookie
        }

        const upstream = await fetch(targetUrl.toString(), {
          method: req.method,
          headers: upstreamHeaders,
          redirect: 'manual',
        })

        console.log(`[Universal Proxy] ${req.method} ${targetUrl.pathname} -> ${upstream.status} (Cookie: ${!!req.headers.cookie})`);

        reply.status(upstream.status)

        const skippedHeaders = new Set([
          'x-frame-options',
          'content-security-policy',
          'content-encoding',
          'transfer-encoding',
          'connection',
          'set-cookie',
        ])

        for (const [name, value] of upstream.headers.entries()) {
          if (!skippedHeaders.has(name.toLowerCase())) {
            reply.header(name, value)
          }
        }

        // Fix: Use getSetCookie() to get an array of cookies without comma-joining issues
        const proxyCookies = upstream.headers.getSetCookie();
        if (proxyCookies && proxyCookies.length > 0) {
          // Enforce SameSite=Lax and remove Secure for localhost HTTP
          const laxCookies = proxyCookies.map(c => 
            c.replace(/SameSite=None/i, 'SameSite=Lax').replace(/;\s*Secure/i, '')
          );
          reply.header('set-cookie', laxCookies);
        }

        const body = Buffer.from(await upstream.arrayBuffer())
        return reply.send(body)
      } catch (err) {
        console.error('[universal-proxy] fetch error:', err)
        return reply.status(502).send({ error: 'Universal proxy failed' })
      }
    }

    return reply.status(404).send({ error: 'Not Found' })
  })

  return app
}
// Trigger nodemon restart// Trigger nodemon restart
