import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const venvDir = path.join(repoRoot, "agents", ".venv");
const requirementsFile = path.join(repoRoot, "agents", "requirements.txt");

const bootstrapCandidates = [
  { command: "python3", args: [] },
  { command: "python", args: [] },
  { command: "py", args: ["-3"] },
];

function runOrExit(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      return false;
    }

    console.error(`Failed to ${label}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return true;
}

function venvPythonPath() {
  const unixPath = path.join(venvDir, "bin", "python");
  const windowsPath = path.join(venvDir, "Scripts", "python.exe");
  return existsSync(unixPath) ? unixPath : windowsPath;
}

if (!existsSync(venvPythonPath())) {
  const created = bootstrapCandidates.some((candidate) =>
    runOrExit(
      candidate.command,
      [...candidate.args, "-m", "venv", venvDir],
      "create the agents virtual environment",
    ),
  );

  if (!created) {
    console.error("Could not find Python 3 to create agents/.venv.");
    process.exit(1);
  }
}

const python = venvPythonPath();

runOrExit(python, ["-m", "pip", "install", "--upgrade", "pip"], "upgrade pip");
runOrExit(
  python,
  ["-m", "pip", "install", "-r", requirementsFile],
  "install the agents dependencies",
);

