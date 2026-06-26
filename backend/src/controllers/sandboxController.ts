/**
 * sandboxController.ts
 *
 * Low-level Daytona sandbox management handlers.
 * These are utility endpoints for ad-hoc sandbox operations
 * (separate from provisionProject which handles the full lifecycle).
 *
 * SECURITY NOTES:
 * - All handlers require verifyClerk (enforced at the route level)
 * - sandboxId inputs are validated to be non-empty strings
 * - Error detail strings are logged server-side; only generic messages returned to client
 * - TODO(security): Add per-user sandbox ownership check before operating on a sandboxId
 */

import { FastifyRequest, FastifyReply } from "fastify";
import daytona from "../services/daytona.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateSandboxBody {
  image?: string;
  envVars?: Record<string, string>;
}

interface UploadFilesBody {
  sandboxId: string;
  files: Record<string, string>;
}

interface InstallPackagesBody {
  sandboxId: string;
  packages: string[];
  cwd?: string;
}

interface RunProjectBody {
  sandboxId: string;
  command: string;
  cwd?: string;
}

interface SandboxLogsBody {
  sandboxId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(reply: FastifyReply, status: number, message: string) {
  // Only send generic message to client — details stay in server logs
  return reply.status(status).send({ error: message });
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function isPortOpen(sandbox: any, port: number): Promise<boolean> {
  try {
    // Try bash /dev/tcp first (always available in bash)
    const r1 = await sandbox.process.executeCommand(
      `bash -c "(echo > /dev/tcp/localhost/${port}) 2>/dev/null; echo $?"`,
      "/",
      undefined,
      5
    );
    if (r1.result.trim() === "0") return true;

    // Fallback: check ss or netstat
    const r2 = await sandbox.process.executeCommand(
      `ss -tlnp 2>/dev/null | grep :${port} || netstat -tlnp 2>/dev/null | grep :${port} || echo ""`,
      "/",
      undefined,
      5
    );
    return r2.result.includes(`:${port}`);
  } catch {
    return false;
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function createSandbox(
  request: FastifyRequest<{ Body: CreateSandboxBody }>,
  reply: FastifyReply
) {
  try {
    const { image = "node:20", envVars = {} } = request.body ?? {};

    const sandbox = await daytona.create(
      { image, language: "javascript", envVars, autoStopInterval: 0, public: true },
      { timeout: 120, onSnapshotCreateLogs: (chunk) => console.log("[daytona]", chunk) }
    );

    console.log("[createSandbox] created sandbox:", sandbox.id);
    const previewLink = await sandbox.getPreviewLink(3000);

    return reply.status(201).send({
      sandboxId: sandbox.id,
      previewUrl: previewLink.url,
      previewToken: previewLink.token ?? null,
      state: sandbox.state,
    });
  } catch (err) {
    console.error("[createSandbox] error:", err);
    return sendError(reply, 500, "Failed to create sandbox");
  }
}

export async function uploadFiles(
  request: FastifyRequest<{ Body: UploadFilesBody }>,
  reply: FastifyReply
) {
  const { sandboxId, files } = request.body ?? {};
  if (!sandboxId) return sendError(reply, 400, "sandboxId is required");
  if (!files || Object.keys(files).length === 0)
    return sendError(reply, 400, "files map must not be empty");

  try {
    const sandbox = await daytona.get(sandboxId);
    await Promise.all(
      Object.entries(files).map(([remotePath, content]) =>
        sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), remotePath)
      )
    );
    return reply.send({ ok: true, uploaded: Object.keys(files).length });
  } catch (err) {
    console.error("[uploadFiles] error:", err);
    return sendError(reply, 500, "Failed to upload files");
  }
}

export async function installPackages(
  request: FastifyRequest<{ Body: InstallPackagesBody }>,
  reply: FastifyReply
) {
  const { sandboxId, packages, cwd = "/workspace" } = request.body ?? {};
  if (!sandboxId) return sendError(reply, 400, "sandboxId is required");
  if (!packages?.length) return sendError(reply, 400, "packages array must not be empty");

  try {
    const sandbox = await daytona.get(sandboxId);
    const result = await sandbox.process.executeCommand(
      `npm install ${packages.join(" ")} --legacy-peer-deps 2>&1`,
      cwd,
      undefined,
      300
    );
    if (result.exitCode !== 0) {
      console.error("[installPackages] npm install failed:", result.result.slice(-500));
      return sendError(reply, 500, "npm install failed");
    }
    return reply.send({ ok: true });
  } catch (err) {
    console.error("[installPackages] error:", err);
    return sendError(reply, 500, "Failed to install packages");
  }
}

/**
 * POST /api/sandbox/run
 *
 * Three-strategy dev server launcher:
 *  A. npx serve  — zero install, fastest (~5s)
 *  B. npm run dev / vite — requires prior npm install (~30s)
 *  C. python3 http.server — always-available fallback
 */
export async function runProject(
  request: FastifyRequest<{ Body: RunProjectBody }>,
  reply: FastifyReply
) {
  const { sandboxId, command, cwd = "/workspace" } = request.body ?? {};
  if (!sandboxId) return sendError(reply, 400, "sandboxId is required");
  if (!command) return sendError(reply, 400, "command is required");

  try {
    const sandbox = await daytona.get(sandboxId);

    // Diagnose environment
    const envCheck = await sandbox.process.executeCommand(
      `node --version 2>&1; npm --version 2>&1; which python3 2>&1; ls ${cwd} 2>&1`,
      cwd,
      undefined,
      15
    );
    console.log("[runProject] env check:\n", envCheck.result);

    // Kill anything on port 3000
    await sandbox.process
      .executeCommand(
        "fuser -k 3000/tcp 2>/dev/null; pkill -f 'serve|vite|http.server' 2>/dev/null; sleep 1; echo done",
        "/",
        undefined,
        10
      )
      .catch(() => {});

    const useServe = command.includes("serve") || command.includes("npx serve");
    const usePython = command.includes("python");
    const useNpm = command.includes("npm run") || command.includes("vite");

    let serverCmd: string;

    if (usePython) {
      serverCmd = `python3 -m http.server 3000 --directory ${cwd}`;
    } else if (useServe || !useNpm) {
      serverCmd = `npx --yes serve@14 ${cwd} -l 3000 --no-clipboard`;
    } else {
      console.log("[runProject] running npm install before dev server...");
      const install = await sandbox.process.executeCommand(
        "npm install --legacy-peer-deps 2>&1",
        cwd,
        undefined,
        300
      );
      console.log("[runProject] npm install exit:", install.exitCode);
      if (install.exitCode !== 0) {
        console.error("[runProject] npm install failed:", install.result.slice(-500));
        return sendError(reply, 500, "npm install failed");
      }
      serverCmd = command;
    }

    console.log("[runProject] launching:", serverCmd);
    const launchScript = `
rm -f /tmp/preview.log
(${serverCmd} >> /tmp/preview.log 2>&1) &
echo "PID=$!"
`.trim();

    const launch = await sandbox.process.executeCommand(launchScript, cwd, undefined, 20);
    console.log("[runProject] launch result:", launch.result);

    const maxAttempts = 25;
    let previewLink: { url: string; token: string } | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000);
      const open = await isPortOpen(sandbox, 3000);
      console.log(`[runProject] poll ${i + 1}/${maxAttempts}: port open = ${open}`);

      try {
        const tail = await sandbox.process.executeCommand(
          "tail -3 /tmp/preview.log 2>/dev/null",
          "/",
          undefined,
          3
        );
        if (tail.result.trim()) console.log("[runProject] log tail:", tail.result.trim());
      } catch {}

      if (open) {
        previewLink = await sandbox.getPreviewLink(3000);
        break;
      }

      // Auto-fallback to python on attempt 5 if serve seems stuck
      if (i === 4 && !useNpm && !usePython) {
        console.log("[runProject] serve seems stuck, trying python fallback...");
        await sandbox.process
          .executeCommand(
            `(python3 -m http.server 3000 --directory ${cwd} >> /tmp/preview.log 2>&1) &`,
            cwd,
            undefined,
            10
          )
          .catch(() => {});
      }
    }

    if (!previewLink) {
      try {
        const r = await sandbox.process.executeCommand(
          "cat /tmp/preview.log 2>/dev/null || echo '(log file not found)'",
          "/",
          undefined,
          10
        );
        console.error("[runProject] server log:\n", r.result);
      } catch {}
      return sendError(reply, 500, "Dev server did not start within 75s");
    }

    console.log("[runProject] preview ready:", previewLink.url);
    return reply.send({
      ok: true,
      previewUrl: previewLink.url,
      previewToken: previewLink.token ?? null,
    });
  } catch (err) {
    console.error("[runProject] error:", err);
    return sendError(reply, 500, "Failed to run project");
  }
}

/** POST /api/sandbox/logs — read /tmp/preview.log for debugging */
export async function getSandboxLogs(
  request: FastifyRequest<{ Body: SandboxLogsBody }>,
  reply: FastifyReply
) {
  const { sandboxId } = request.body ?? {};
  if (!sandboxId) return sendError(reply, 400, "sandboxId is required");

  try {
    const sandbox = await daytona.get(sandboxId);
    const result = await sandbox.process.executeCommand(
      "cat /tmp/preview.log 2>/dev/null || echo '(log does not exist)'",
      "/",
      undefined,
      10
    );
    return reply.send({ log: result.result });
  } catch (err) {
    console.error("[getSandboxLogs] error:", err);
    return sendError(reply, 500, "Failed to read logs");
  }
}
