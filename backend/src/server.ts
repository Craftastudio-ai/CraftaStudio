/**
 * The above TypeScript code initializes a server, connects to a Redis database, and starts the server
 * on port 3000 after setting up necessary configurations.
 */
/// <reference path="./types/fastify.d.ts" />
import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
});

import { buildServer } from "./app";
import { redis } from "./config/redis";
import { startBlockWorker } from './queue/blockWorker'

const PORT = Number(process.env.PORT) || 3001;

// ── Startup Environment Validation ───────────────────────────────────────────
function validateEnvironment() {
  const critical = [
    { key: 'DATABASE_URL',       desc: 'PostgreSQL connection string' },
    { key: 'CLERK_SECRET_KEY',   desc: 'Clerk secret key for JWT validation' },
  ];
  const important = [
    { key: 'ANTHROPIC_API_KEY',  desc: 'Anthropic API key for AI features' },
    { key: 'REDIS_URL',          desc: 'Redis connection for BullMQ queues' },
    { key: 'GROQ_API_KEY',       desc: 'Groq API key (optional AI fallback)' },
  ];

  console.log('\n┌──────────────────────────────────────────────────────┐');
  console.log('│          CraftaStudio Server — Env Check              │');
  console.log('└──────────────────────────────────────────────────────┘');

  let hasCriticalErrors = false;
  for (const { key, desc } of critical) {
    const val = process.env[key];
    if (!val) {
      console.error(`❌ MISSING [CRITICAL] ${key} — ${desc}`);
      hasCriticalErrors = true;
    } else {
      console.log(`✅ ${key} — set (${val.slice(0, 8)}...)`);
    }
  }
  for (const { key, desc } of important) {
    const val = process.env[key];
    if (!val) {
      console.warn(`⚠️  MISSING [IMPORTANT] ${key} — ${desc} — AI features may not work`);
    } else {
      console.log(`✅ ${key} — set (${val.slice(0, 8)}...)`);
    }
  }

  // Model name validation
  const planModel = process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001';
  const codeModel = process.env.CLAUDE_CODE_MODEL ?? 'claude-haiku-4-5-20251001';
  const knownBadModels = ['claude-3-20241022', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'];
  if (knownBadModels.includes(planModel) || knownBadModels.includes(codeModel)) {
    console.error(`❌ INVALID MODEL NAME detected: "${planModel}" or "${codeModel}"`);
    console.error(`   Use: "claude-haiku-4-5-20251001" or "claude-sonnet-4-5" instead`);
  } else {
    console.log(`✅ CLAUDE_PLAN_MODEL — ${planModel}`);
    console.log(`✅ CLAUDE_CODE_MODEL — ${codeModel}`);
  }
  console.log(`ℹ️  AGENT_SERVICE_URL — ${process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000 (default)'}`);
  console.log('──────────────────────────────────────────────────────\n');

  if (hasCriticalErrors) {
    console.error('🚨 Critical env vars missing. Server may fail to start correctly.');
  }
}

async function startServer() {
  try {
    validateEnvironment();

    const app = await buildServer();

    try {
      await redis.set("test", "connected");
      console.log("✅ Redis: connected");
    } catch (err) {
      console.warn("⚠️ Redis test connection failed, but proceeding to start server:", err);
    }

    try {
      startBlockWorker();
    } catch (err) {
      console.warn("⚠️ Failed to start block worker:", err);
    }

    await app.listen({ port: PORT, host: '::' });

    console.log(`\n🚀 CraftaStudio API running on http://localhost:${PORT}`);
    console.log(`   Health:  GET http://localhost:${PORT}/api/blocks/health`);

  } catch (error) {
    console.error("Startup failed:", error);
  }
}

startServer();