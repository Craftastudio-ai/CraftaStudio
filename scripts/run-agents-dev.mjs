import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const candidates = [
  {
    command: path.join(repoRoot, "agents", ".venv", "bin", "python"),
    args: [],
    requiresFile: true,
  },
  {
    command: path.join(repoRoot, "agents", "venv", "bin", "python"),
    args: [],
    requiresFile: true,
  },
  {
    command: path.join(repoRoot, "agents", ".venv", "Scripts", "python.exe"),
    args: [],
    requiresFile: true,
  },
  {
    command: path.join(repoRoot, "agents", "venv", "Scripts", "python.exe"),
    args: [],
    requiresFile: true,
  },
  { command: "python3", args: [] },
  { command: "python", args: [] },
  { command: "py", args: ["-3"] },
];

function fileExists(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function canImportUvicorn(command, args) {
  try {
    const result = spawnSync(command, [...args, "-c", "import uvicorn"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

const selected = candidates.find((candidate) => {
  if (candidate.requiresFile && !fileExists(candidate.command)) {
    return false;
  }

  return canImportUvicorn(candidate.command, candidate.args);
});

if (!selected) {
  console.error(
    [
      "Could not find a Python interpreter with uvicorn installed.",
      "Run `npm run install:all` to create agents/.venv and install agents dependencies.",
    ].join("\n"),
  );
  process.exit(1);
}

const child = spawn(
  selected.command,
  [...selected.args, "-m", "uvicorn", "main:app", "--reload", "--app-dir", "agents", "--port", "8000"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

