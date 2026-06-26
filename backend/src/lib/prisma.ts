// CraftaStudio — src/lib/prisma.ts
// ─────────────────────────────────────────────────────────────
// SINGLETON PRISMA CLIENT — import this everywhere in the backend.
//
// DO NOT call `new PrismaClient()` anywhere else.
//
// Why: Each PrismaClient instance opens its own connection pool.
// Multiple instances → connection exhaustion under load → PostgreSQL
// rejects requests with "too many clients". One shared instance
// reuses the same pool across all routes, middleware, and graph utils.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

/**
 * Single shared PrismaClient for the entire backend process.
 *
 * Lazy-initialised on first import. Subsequent imports reuse
 * the same instance via Node.js module caching.
 */
const prisma = new PrismaClient({
  log: [
    { level: 'warn',  emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') + 'connection_limit=3&pool_timeout=20',
    },
  },
})

/** Forward Prisma warnings to the process logger */
prisma.$on('warn', (e: any) => {
  process.stderr.write(`[Prisma warn] ${e.message}\n`)
})

/** Forward Prisma errors to the process logger */
prisma.$on('error', (e: any) => {
  process.stderr.write(`[Prisma error] ${e.message}\n`)
})

export default prisma
