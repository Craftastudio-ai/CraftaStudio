/**
 * provisionController.ts  —  MERGED
 *
 * Handles full Daytona sandbox lifecycle for the live preview feature.
 *
 * POST /api/sandbox/provision  { projectId }
 *   → creates or reuses a Daytona workspace for the project
 *   → scaffolds a Vite+React OR plain HTML/CSS/JS app from block outputs
 *   → starts vite dev server or npx serve
 *   → returns { previewUrl, previewToken, sandboxId, blockCount }
 *
 * POST /api/sandbox/delete  { projectId }
 *   → destroys the Daytona workspace and clears sandboxId on the project
 *
 * GET /api/sandbox/debug-scaffold  { projectId }
 *   → returns scaffold diagnostic without provisioning
 *
 * ─── Fixes carried forward from patched version ───────────────────────────────
 *
 * FIX #1  — Auto dependency extraction via extractDependencies()
 * FIX #2  — Stop stripping imports in sanitizeBlockCode (kept React imports)
 * FIX #3  — Strong TSX/JSX detection via isTypeScriptFile()
 * FIX #4  — HTML projects bypass Vite entirely, served via npx serve
 * FIX #5  — Next.js import shims injected for Daytona (no Next runtime)
 * FIX #6  — Skip npm install when package.json hash unchanged
 * FIX #7  — Self-healing: parse Vite crash logs, auto-install missing deps
 * FIX #8  — Daytona CPU limit / zombie sandbox exhaustion handling
 * FIX #9  — Correct JS/CSS/JSX file detection via classifyBlockContent()
 *
 * BUG FIX A — Strip code fences and // FILE: headers before saving HTML blocks
 * BUG FIX B — Classify cleaned code (not raw); handle JS and REACT_JS for scripts
 * BUG FIX C — Classify each unfenced block individually before sanitizeBlockCode
 * BUG FIX D — Preserve filenames already referenced in HTML (<script src>, <link href>)
 * BUG FIX E — Split multi-file LLM output (// FILE: sections) into individual files
 * BUG FIX F — looksLikePureCSS: strip block comments before line-scoring heuristic
 * BUG FIX G — Preserve subdirectory prefix (js/, css/) from FILE: section filenames
 * BUG FIX H — UNKNOWN section type: fall back to extension-based routing
 * BUG FIX I — classifyBlockContent: added class defs, object literals, DOM calls as JS signals
 * FIX J    — Topological JS load-order sort via inferJSDependencies() + topoSortJS()
 *
 * ─── Additional fixes ────────────────────────────────────────────────────────
 *
 * MERGE-1  — ErrorBoundary in App.tsx scaffold so prop-crash components render
 *            silently (hidden div) instead of blowing up the whole preview.
 *
 * FIX K    — App-root detection via looksLikeAppRoot(): when a block imports
 *            2+ siblings via "./components/*", it IS the App entry point.
 *            Such blocks are promoted to src/App.tsx instead of being saved as
 *            a sibling component inside src/components/, which caused Vite to
 *            fail with "Failed to resolve import ./components/X" because the
 *            relative path resolved to src/components/components/X (one level
 *            too deep). The scaffold-generated App.tsx is also suppressed when
 *            a real app-root block has already been promoted.
 *
 * FIX L    — In the unfenced fallback path, derive forJS from the per-block
 *            classifyBlockContent() result (REACT_JS or JS) rather than from
 *            the project-level projectType. This prevents sanitizeBlockCode
 *            from stripping TypeScript syntax out of REACT_TS blocks, which
 *            was causing isValidJSX to reject them and skip writing component
 *            files that App.jsx then failed to resolve at runtime.
 *
 * FIX M    — isTestFile() guard: blocks that import from vitest / @testing-library
 *            / jest, or contain describe/it/beforeEach/afterEach calls, are
 *            test files and must NEVER be bundled by Vite. They are filtered
 *            out before buildScaffoldFiles() and also rejected inside isValidJSX().
 *            This fixes the "[plugin:vite:import-analysis] Failed to resolve
 *            import @testing-library/react" error that caused the preview to
 *            crash with a red overlay.
 *
 * FIX M2   — isTestFile() was too aggressive — it matched $RefreshSig$() which
 *            Vite HMR injects into EVERY .tsx component at runtime, causing all
 *            real component blocks to be falsely skipped. Fixed by:
 *            1. Removing $RefreshSig$ from the test heuristic entirely.
 *            2. Requiring BOTH a test-framework import AND a test-body call
 *               (describe/it/test/expect) to confirm a block is a test file.
 *               A single import alone is not sufficient — utility files may
 *               re-export test helpers without being test files themselves.
 *            3. Checking the block's blockType field: blocks typed as "ui",
 *               "service", "database" etc. are never test files regardless of
 *               content. Only blocks explicitly typed "test" are auto-rejected.
 *
 * FIX N    — Multi-file blocks: blocks whose outputCode contains multiple
 *            FILE: sections (e.g. Display.tsx + Display.module.css + utils/)
 *            were only partially processed. The fenced-block regex consumed
 *            the first match and stopped; subsequent FILE: sections were lost.
 *            Fixed by running splitFileSections() on EVERY block before the
 *            fenced-regex loop, and routing each section to the correct path.
 *
 * FIX O    — Root config files (vite.config.ts, tsconfig.json, tsconfig.node.json,
 *            .env.example, build.sh, etc.) inside multi-file blocks were being
 *            misrouted to /workspace/src/ because looksLikePureCSS() matched
 *            JSON/TOML-like content (curly braces + colons) and the CSS branch
 *            added the src/ prefix, or they fell to the fallback which also
 *            added src/. Fixed by matching known root-file patterns by basename
 *            BEFORE any content-type classification, and writing them directly
 *            to /workspace/<path> without any src/ prefix.
 *
 * FIX O2   — LLM-supplied vite.config.ts/js references @vitejs/plugin-react but
 *            the scaffold patches package.json to use @vitejs/plugin-react-swc.
 *            Fixed by rewriting the import inside the LLM vite config file after
 *            it is extracted, so Vite can actually load its config.
 *
 * FIX P    — Real Next.js scaffold: when detectProjectType() returns "NEXT",
 *            buildScaffoldFiles() now exits the Vite path early and instead
 *            produces a proper Next.js boilerplate (next.config.js, app/layout.tsx,
 *            app/page.tsx, tsconfig.json, package.json with next@14). NEXT_SHIMS
 *            are no longer injected. Blocks land in app/components/. Dev server
 *            uses `next dev -p 3000`; startup wait increased to 8 s.
 *
 * FIX Q    — parseMissingModules() now detects missing packages from three
 *            bundler error formats:
 *            1. Vite:    Failed to resolve import "pkg"
 *            2. Webpack/Next.js: Module not found: Can't resolve 'pkg'
 *            3. Node:    Cannot find module 'pkg'
 *            Previously only the Vite pattern was matched, so Next.js/Webpack
 *            errors were silently ignored and the preview stayed dead.
 *
 * FIX R    — Scaffold App.tsx for Vite React SPA now uses react-router-dom
 *            <BrowserRouter>/<Routes>/<Route> instead of flat component stacking.
 *            Each component file gets its own route (/ for the first, /comp-N
 *            for subsequent ones) so navigation actually works. A nav bar with
 *            <Link> elements is injected when more than one component exists.
 *
 * FIX S    — isTestPath() helper: test files were slipping through isTestFile()
 *            content check when they lacked standard test-framework imports
 *            (e.g. integration.test.tsx, errors.test.ts, keyboard.test.ts).
 *            Fixed by adding filename-based detection BEFORE content analysis:
 *            any file matching *.test.*, *.spec.*, living under tests?/ or
 *            __tests?__/ directories, or named setup.ts/setup.js is always
 *            treated as a test file and excluded from the Vite bundle.
 *            isTestPath() is applied in FIX N (multi-file sections), the fenced
 *            path, and the unfenced fallback — all three scaffold code paths.
 *
 * FIX T    — HMR websocket fix for deployed/remote previews: scaffold-generated
 *            vite.config.js now includes hmr.clientPort=443 and hmr.protocol='wss'
 *            so the browser connects HMR over the Daytona proxy (HTTPS/WSS) instead
 *            of trying ws://localhost:5173 which causes ERR_CONNECTION_REFUSED when
 *            the preview is accessed via a remote URL. Also applied to LLM-supplied
 *            vite.config.ts/js via the FIX O2 patch path.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "crypto";
import path from "path";
import daytona from "../services/daytona.service";
import prisma from "../lib/prisma";

// ─── FIX #8c: Per-project provision lock (deduplicate concurrent requests) ────
const provisioningProjects = new Set<string>();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProvisionBody {
  projectId: string;
}

interface BlockRow {
  id: string;
  blockType: string;
  name: string | null;
  outputCode: string | null;
}

type ProjectType = "HTML" | "REACT_JS" | "REACT_TS" | "NEXT";
type BlockContentType = "HTML" | "CSS" | "REACT_TS" | "REACT_JS" | "NEXT" | "JS" | "UNKNOWN";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── FIX #1: Auto dependency extraction ──────────────────────────────────────

const BUILTIN_MODULES = new Set([
  "react", "react-dom", "react-dom/client", "react/jsx-runtime",
  "react-router", "react-router-dom",
  "fs", "path", "os", "util", "crypto", "stream", "events", "http", "https",
  "child_process", "buffer", "process", "module", "url", "querystring",
  "assert", "net", "tls", "dns", "zlib", "readline", "repl", "vm",
]);

const SCAFFOLD_DEPS = new Set([
  "react", "react-dom", "react-router-dom", "lucide-react", "framer-motion",
  "clsx", "tailwind-merge", "class-variance-authority",
  "zod", "react-hook-form", "@hookform/resolvers",
  "date-fns", "recharts", "axios", "zustand",
]);

const VERSION_PINS: Record<string, string> = {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0",
  "lucide-react": "^0.383.0",
  "framer-motion": "^11.3.19",
  "tailwindcss": "^3.4.4",
  "postcss": "^8.4.38",
  "autoprefixer": "^10.4.19",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.2",
  "class-variance-authority": "^0.7.0",
  "zod": "^3.23.8",
  "react-hook-form": "^7.53.0",
  "@hookform/resolvers": "^3.9.0",
  "date-fns": "^3.6.0",
  "recharts": "^2.12.7",
  "axios": "^1.7.7",
  "zustand": "^5.0.0",
};

function extractDependencies(codeFiles: string[]): string[] {
  const deps = new Set<string>();
  const regex = /(?:from\s+|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;

  for (const file of codeFiles) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(file)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      if (raw.startsWith(".") || raw.startsWith("/")) continue;
      const pkg = raw.startsWith("@")
        ? raw.split("/").slice(0, 2).join("/")
        : raw.split("/")[0];
      if (pkg && !BUILTIN_MODULES.has(pkg) && !SCAFFOLD_DEPS.has(pkg)) {
        deps.add(pkg);
      }
    }
  }
  return [...deps];
}

// ─── FIX S: Filename-based test file detection ────────────────────────────────

function isTestPath(filename: string): boolean {
  if (!filename) return false;
  if (/\.(test|spec)\.(tsx?|jsx?|mjs|cjs)$/.test(filename)) return true;
  if (/[/\\]__?tests?__?[/\\]/i.test(filename)) return true;
  if (/[/\\]tests?[/\\]/i.test(filename)) return true;
  if (/\bsetup\.(ts|js|tsx|jsx)$/.test(filename)) return true;
  return false;
}

// ─── FIX M / FIX M2: Content-based test file detection ───────────────────────

const TEST_FRAMEWORK_IMPORTS = [
  /from\s+['"]vitest['"]/,
  /from\s+['"]@testing-library\//,
  /from\s+['"]@jest\//,
  /from\s+['"]jest-dom['"]/,
  /from\s+['"]@testing-library\/jest-dom['"]/,
  /import\s+['"]@testing-library\//,
];

const TEST_BODY_CALLS = [
  /\bdescribe\s*\(\s*['"]/,
  /\bit\s*\(\s*['"]/,
  /\btest\s*\(\s*['"]/,
  /\bbeforeEach\s*\(\s*(async\s*)?(function|\(|[a-z_$])/,
  /\bafterEach\s*\(\s*(async\s*)?(function|\(|[a-z_$])/,
  /\bbeforeAll\s*\(\s*(async\s*)?(function|\(|[a-z_$])/,
  /\bafterAll\s*\(\s*(async\s*)?(function|\(|[a-z_$])/,
  /\bexpect\s*\([^)]+\)\s*\.(toBe|toEqual|toMatch|toThrow|toHaveLength|toContain|toBeNull|toBeTruthy|toBeFalsy|toBeUndefined|toBeGreaterThan)\s*\(/,
];

function isTestFile(code: string, blockType?: string): boolean {
  if (blockType) {
    if (/^test(ing)?$/i.test(blockType.trim())) return true;
    if (/^(ui|service|job|database|api|component|hook|util|store|style|config)$/i.test(blockType.trim())) {
      return false;
    }
  }

  const hasTestImport = TEST_FRAMEWORK_IMPORTS.some((re) => re.test(code));
  if (!hasTestImport) return false;

  const hasTestBody = TEST_BODY_CALLS.some((re) => re.test(code));
  return hasTestBody;
}

// ─── Combined test check (filename + content) — use this everywhere ───────────

function isAnyTestFile(filename: string, code: string, blockType?: string): boolean {
  return isTestPath(filename) || isTestFile(code, blockType);
}

// ─── FIX #3: Strong TypeScript detection ─────────────────────────────────────

function isTypeScriptFile(code: string): boolean {
  return (
    /:\s*(string|number|boolean|void|never|unknown|any|null|undefined)\b/.test(code) ||
    /interface\s+\w/.test(code) ||
    /type\s+\w[\w<>, ]*\s*=/.test(code) ||
    /:\s*React\.FC/.test(code) ||
    /:\s*React\.ReactNode/.test(code) ||
    /:\s*React\.ReactElement/.test(code) ||
    /<[A-Z]\w*>/.test(code) ||
    /as\s+[A-Z]\w*/.test(code) ||
    /enum\s+\w/.test(code) ||
    /readonly\s+\w/.test(code) ||
    /\?\s*:/.test(code) ||
    /!\s*\./.test(code)
  );
}

// ─── FIX #4: HTML project detection ──────────────────────────────────────────

function looksLikePureHTML(code: string): boolean {
  const trimmed = code.trim();
  return (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    (trimmed.includes("<html") &&
      !trimmed.includes("import React") &&
      !trimmed.includes("export default"))
  );
}

// ─── BUG FIX F: looksLikePureCSS — strip block comments first ────────────────

function looksLikePureCSS(code: string): boolean {
  const trimmed = code.trim();

  if (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("function ") ||
    trimmed.startsWith("const ") ||
    trimmed.startsWith("class ") ||
    trimmed.startsWith("//") ||
    trimmed.includes("React") ||
    trimmed.includes("JSX") ||
    trimmed.includes("=>") ||
    trimmed.includes("return (")
  ) {
    return false;
  }

  const withoutBlockComments = trimmed.replace(/\/\*[\s\S]*?\*\//g, "").trim();

  if (
    /^:root\s*\{/.test(withoutBlockComments) ||
    /^@(media|keyframes|import|charset|font-face|supports|layer)\b/.test(withoutBlockComments) ||
    /^\.[a-zA-Z][\w-]*[\s,{]/.test(withoutBlockComments) ||
    /^#[a-zA-Z][\w-]*[\s,{]/.test(withoutBlockComments) ||
    /^\*\s*\{/.test(withoutBlockComments) ||
    /^:[:\w-]/.test(withoutBlockComments) ||
    /^[a-z][a-z0-9-]*\s*\{/.test(withoutBlockComments)
  ) {
    return true;
  }

  const firstMeaningfulLine = withoutBlockComments
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "";

  if (
    /^(import|export|const|let|var|function|class|return|if|for)\b/.test(firstMeaningfulLine)
  ) {
    return false;
  }

  const lines = withoutBlockComments.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;

  let cssLines = 0;
  let jsLines = 0;
  for (const line of lines) {
    if (
      isTopLevelCSSLine(line) ||
      /^\s*(\/\*|[{}])/.test(line) ||
      /^\s+[a-z-]+\s*:/.test(line)
    ) {
      cssLines++;
    } else if (
      /^(import|export|const|let|var|function|class|return|if|for)\b/.test(line.trim())
    ) {
      jsLines++;
    }
  }
  const total = cssLines + jsLines;
  return total > 0 && cssLines / total >= 0.6;
}

// ─── BUG FIX A: strip code fences and FILE: headers ──────────────────────────

function stripFencesAndHeaders(raw: string): string {
  let code = raw.trim();
  code = code.replace(/^```[\w]*\r?\n/, "");
  code = code.replace(/\r?\n```\s*$/, "");
  code = code.replace(/^```[\w]*\s*$/gm, "");
  code = code.replace(/^(?:\/\/|#)\s*FILE:[^\n]*\n/gim, "");
  code = code.replace(/^\/\/\s*(?:filename|file|filepath):[^\n]*\n/im, "");
  return code.trim();
}

// ─── BUG FIX E: split multi-file LLM output into individual file sections ────

interface FileSection {
  filename: string;
  content: string;
}

function splitFileSections(raw: string): FileSection[] {
  let code = raw.trim();
  code = code.replace(/^```[\w]*\r?\n/, "").replace(/\r?\n```\s*$/, "");

  const FILE_HEADER = /^(?:\/\/|#)\s*FILE:\s*([^\n]+)/im;
  if (!FILE_HEADER.test(code)) return [];

  const sections: FileSection[] = [];
  const parts = code.split(/^(?:\/\/|#)\s*FILE:\s*/im);

  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const filename = part.slice(0, newlineIdx).trim();
    const rawContent = part.slice(newlineIdx + 1);
    if (!filename) continue;
    const content = stripFencesAndHeaders(rawContent);
    if (content.length > 0) {
      sections.push({ filename, content });
    }
  }

  return sections;
}

// ─── BUG FIX D: extract filenames already referenced in HTML ─────────────────

function extractReferencedScripts(html: string): string[] {
  const refs: string[] = [];
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRegex.exec(html)) !== null) {
    const src = m[1].replace(/^\//, "");
    if (!src.startsWith("http") && !src.startsWith("//")) refs.push(src);
  }
  return refs;
}

function extractReferencedLinks(html: string): string[] {
  const refs: string[] = [];
  const linkRegex = /<link[^>]+href=["']([^"']+\.css)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1].replace(/^\//, "");
    if (!href.startsWith("http") && !href.startsWith("//")) refs.push(href);
  }
  return refs;
}

// ─── FIX #5: Next.js shims ────────────────────────────────────────────────────

const NEXT_SHIMS: Record<string, string> = {
  "/workspace/src/shims/next-link.jsx":
    `import React from 'react';
export default function Link({ href, children, ...props }) {
  return <a href={href} {...props}>{children}</a>;
}`,

  "/workspace/src/shims/next-image.jsx":
    `import React from 'react';
export default function Image({ src, alt, width, height, ...props }) {
  return <img src={src} alt={alt || ''} width={width} height={height} {...props} />;
}`,

  "/workspace/src/shims/next-router.js":
    `export function useRouter() {
  return {
    push: (path) => { window.location.href = path; },
    replace: (path) => { window.location.replace(path); },
    back: () => { window.history.back(); },
    pathname: window.location.pathname,
    query: Object.fromEntries(new URLSearchParams(window.location.search)),
    asPath: window.location.pathname + window.location.search,
  };
}`,

  "/workspace/src/shims/next-navigation.js":
    `export function useRouter() {
  return {
    push: (path) => { window.location.href = path; },
    replace: (path) => { window.location.replace(path); },
    back: () => { window.history.back(); },
  };
}
export function usePathname() { return window.location.pathname; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
export function redirect(path) { window.location.href = path; }`,
};

const EXTRA_SHIMS: Record<string, string> = {
  "/workspace/src/shims/next-font.js":
    `export function Inter(opts) { return { className: '', style: {} }; }
export function Roboto(opts) { return { className: '', style: {} }; }
export default function localFont(opts) { return { className: '', style: {} }; }`,

  "/workspace/src/shims/next-head.jsx":
    `import React from 'react';
export default function Head({ children }) { return null; }`,
};

function buildViteAliases(): string {
  return `
    alias: {
      'next/link':       '/src/shims/next-link.jsx',
      'next/image':      '/src/shims/next-image.jsx',
      'next/router':     '/src/shims/next-router.js',
      'next/navigation': '/src/shims/next-navigation.js',
      'next/font/google': '/src/shims/next-font.js',
      'next/font/local':  '/src/shims/next-font.js',
      'next/head':        '/src/shims/next-head.jsx',
    },`;
}

// ─── Project type / content detection ────────────────────────────────────────

function hasReactSignals(code: string): boolean {
  return (
    /from\s+['"]react['"]/.test(code) ||
    /import\s+React\b/.test(code) ||
    /ReactDOM\./.test(code) ||
    /className\s*=/.test(code) ||
    /useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer/.test(code) ||
    /<[A-Z][a-zA-Z]+[\s/>]/.test(code) ||
    /return\s*\(\s*\n?\s*</.test(code)
  );
}

// ─── FIX K: App-root detection ────────────────────────────────────────────────

function looksLikeAppRoot(code: string): boolean {
  const componentImports = (code.match(/from\s+['"]\.\/components\//g) || []).length;
  return componentImports >= 2;
}

// ─── FIX O: Root config file detection ───────────────────────────────────────

const ROOT_FILE_PATTERNS = [
  /^vite\.config\.[jt]s$/,
  /^tsconfig[\w.-]*\.json$/,
  /^\.env[\w.-]*$/,
  /^env\.example$/,
  /^build\.(sh|js|ts|mjs)$/,
  /^\.eslint(rc|\.config\.[jt]s|\.json)?$/,
  /^\.prettier(rc|\.config\.[jt]s|\.json)?$/,
  /^rollup\.config\.[jt]s$/,
  /^babel\.config\.[jt]s$/,
  /^postcss\.config\.[jt]s$/,
  /^tailwind\.config\.[jt]s$/,
  /^jest\.config\.[jt]s$/,
  /^vitest\.config\.[jt]s$/,
  /^\.gitignore$/,
  /^\.npmrc$/,
  /^README\.md$/,
];

function isRootConfigFile(filename: string): boolean {
  const basename = filename.replace(/^.*[/\\]/, "");
  return ROOT_FILE_PATTERNS.some((p) => p.test(basename));
}

// ─── FIX #9 + BUG FIX I: full block content classifier ───────────────────────

function classifyBlockContent(code: string): BlockContentType {
  const trimmed = code.trim();
  if (!trimmed) return "UNKNOWN";

  if (looksLikePureHTML(trimmed)) return "HTML";
  if (looksLikePureCSS(trimmed)) return "CSS";

  if (
    /from\s+['"]next\//.test(trimmed) ||
    /"use client"/.test(trimmed) ||
    /import\s+(?:Image|Link)\s+from\s+['"]next\//.test(trimmed)
  ) {
    return "NEXT";
  }

  if (hasReactSignals(trimmed)) {
    return isTypeScriptFile(trimmed) ? "REACT_TS" : "REACT_JS";
  }

  const hasJS =
    /^(import|export)\s/m.test(trimmed) ||
    /^(?:const|let|var|function|class|async\s+function)\s+[A-Za-z]/m.test(trimmed);

  if (hasJS) {
    return isTypeScriptFile(trimmed) ? "REACT_TS" : "JS";
  }

  const hasPlainJSCallExpr =
    /^(?:document|window|navigator|location|history|console|setTimeout|setInterval|fetch|Promise|Object|Array|Math|JSON)\s*[.(]/.test(trimmed) ||
    /^\(function\s*\(/.test(trimmed) ||
    /^\(\s*\(\s*\)\s*=>/.test(trimmed) ||
    /^['"]use strict['"]/.test(trimmed);

  if (hasPlainJSCallExpr) return "JS";

  const hasClassDef = /^class\s+\w+/.test(trimmed);
  const hasObjectLiteral = /^(?:const|let|var)\s+\w+\s*=\s*\{/.test(trimmed);
  const hasDocWindowMid =
    /\bdocument\s*[.(]/.test(trimmed) ||
    /\bwindow\s*[.[=(]/.test(trimmed) ||
    /\blocalStorage\s*[.(]/.test(trimmed) ||
    /\bsessionStorage\s*[.(]/.test(trimmed) ||
    /\beventListener\b/.test(trimmed) ||
    /\baddEventListener\s*\(/.test(trimmed);
  const hasJSControlFlow =
    /\bif\s*\(/.test(trimmed) &&
    (/\bfunction\s+\w/.test(trimmed) || /\bvar\s+\w/.test(trimmed) || /\blet\s+\w/.test(trimmed));
  const hasDOMManip =
    /getElementById|getElementsBy|querySelector|createElement|innerHTML|textContent/.test(trimmed);

  if (hasClassDef || hasObjectLiteral || hasDocWindowMid || hasJSControlFlow || hasDOMManip) {
    return "JS";
  }

  return "UNKNOWN";
}

function detectProjectType(blocks: BlockRow[]): ProjectType {
  const strippedBlocks = blocks
    .filter((b) => b.outputCode)
    .map((b) => ({ ...b, outputCode: stripFencesAndHeaders(b.outputCode!) }));

  const types = strippedBlocks.map((b) => classifyBlockContent(b.outputCode!));

  const hasNext    = types.includes("NEXT");
  const hasHTML    = types.includes("HTML");
  const hasCSS     = types.includes("CSS");
  const hasJS      = types.includes("JS");
  const hasReactTS = types.includes("REACT_TS");

  const hasActualReact = !hasHTML && strippedBlocks.some(
    (b) => hasReactSignals(b.outputCode!) || /jsx|tsx/.test(b.blockType ?? "")
  );

  console.log(
    `[scaffold] block types: ${types.join(", ")} | hasHTML=${hasHTML} | hasActualReact=${hasActualReact} | hasNext=${hasNext}`
  );

  if (hasNext) return "NEXT";

  if (hasHTML) {
    console.log("[scaffold] HTML block present — treating as plain HTML/CSS/JS project, bypassing Vite");
    return "HTML";
  }

  if (hasActualReact || hasReactTS) return hasReactTS ? "REACT_TS" : "REACT_JS";

  if (hasCSS || hasJS) {
    console.log("[scaffold] CSS/JS-only blocks, no React — treating as plain HTML/CSS/JS project");
    return "HTML";
  }

  return "REACT_JS";
}

// ─── CSS helpers ──────────────────────────────────────────────────────────────

function isTopLevelCSSLine(line: string): boolean {
  if (/^\s/.test(line)) return false;
  const t = line.trim();
  if (!t) return false;
  if (/^@(media|keyframes|import|charset|font-face|supports|layer)\b/.test(t)) return true;
  if (/^:[:\w-]/.test(t)) return true;
  if (/^[.#][a-zA-Z][\w-]*[\s,{]/.test(t)) return true;
  if (/^\*\s*\{/.test(t)) return true;
  if (/^[a-z-]+\s*:\s*[^;{(]+;\s*$/.test(t)) return true;
  if (
    /^[a-z][a-z0-9-]*\s*[{,]/.test(t) &&
    !/^(return|const|let|var|if|else|for|while|function|async|await|class|import|export|default|switch|case|break|continue|throw|try|catch|finally|new|typeof|instanceof|void|delete|in|of|yield|true|false|null|undefined)[\s({,;]/.test(t)
  )
    return true;
  return false;
}

function stripTrailingCSS(code: string): string {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!isTopLevelCSSLine(lines[i])) continue;
    const before = lines.slice(0, i).join("\n");
    const hasAnyJS =
      /^(?:import|export|const|let|var|function|class)\s/m.test(before) ||
      /function\s+\w|const\s+\w+\s*=/.test(before) ||
      /<[A-Za-z][\s/>]|return\s*\(/.test(before);
    if (hasAnyJS) {
      console.log(`[scaffold] stripTrailingCSS: cut at line ${i} — "${lines[i].trim().slice(0, 60)}"`);
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }
  return code;
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────

function braceBalance(s: string): number {
  let balance = 0;
  let inString: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === inString && s[i - 1] !== "\\") inString = null;
    } else if (c === '"' || c === "'" || c === "`") {
      inString = c;
    } else if (c === "{") {
      balance++;
    } else if (c === "}") {
      balance--;
    }
  }
  return balance;
}

function removeTopLevelTypeScriptBlocks(code: string): string {
  const lines = code.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const isTSBlock =
      /^(export\s+)?(interface)\s/.test(trimmed) ||
      /^(export\s+)?(declare\s+(module|namespace|global|class|function|const|let|var|type|enum|abstract))\s/.test(trimmed) ||
      /^declare\s+/.test(trimmed) ||
      /^(export\s+)?type\s+\w[\w<>, ]*\s*=/.test(trimmed) ||
      /^(export\s+)?(const\s+)?enum\s+\w/.test(trimmed);
    if (!isTSBlock) { result.push(line); i++; continue; }
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    if (openCount === 0 || openCount <= closeCount) {
      i++;
      while (i < lines.length && /\|\s*$/.test(lines[i - 1])) i++;
      continue;
    }
    let depth = openCount - closeCount;
    i++;
    while (i < lines.length && depth > 0) {
      const l = lines[i];
      depth += (l.match(/\{/g) || []).length;
      depth -= (l.match(/\}/g) || []).length;
      i++;
    }
    if (i < lines.length && lines[i].trim() === ";") i++;
  }
  return result.join("\n");
}

function sanitizeBlockCode(raw: string, forJS = false): string {
  let code = raw.trim();

  code = code.replace(/^```[\w]*\r?\n/, "").replace(/\r?\n```\s*$/, "");
  code = code.replace(/^```[\w]*/gm, "").replace(/^```\s*$/gm, "");
  code = code.trim();

  // FIX: Convert react-icons imports to lucide-react automatically
  code = code.replace(/from\s+['"]react-icons\/[^'"]+['"]/g, 'from "lucide-react"');
  code = code.replace(/from\s+['"]react-icons['"]/g, 'from "lucide-react"');
  code = code.replace(/\b(Fa|Fi|Bs|Md|IoMd|Io|Ti|Go|Ri|Si|Vsc|Hi|Lu)([A-Z][a-zA-Z0-9]+)\b/g, '$2');
  code = code.replace(/IconType/g, 'LucideIcon');


  if (code.includes("// FILE:") || code.includes("# FILE:")) {
    const parts = code.split(/(?:\/\/|#) FILE:[^\n]*\n/).filter(Boolean);
    const jsxPart = parts.find((p) => /<[A-Z][a-zA-Z]*|return\s*\(|React/.test(p));
    code = (jsxPart ?? parts[0] ?? code).trim();
  }

  code = code.replace(/\/\*[\s\S]*?\*\//g, "");

  if (forJS) {
    code = removeTopLevelTypeScriptBlocks(code);
    code = code.replace(
      /^(const|let|var)\s+(\w+)\s*:\s*[A-Za-z<>[\], |&]+\s*=/gm,
      "$1 $2 ="
    );
    code = code.replace(/^import\s+type\s+[^\n]+$/gm, "");
  }

  code = code.replace(/^export\s+default\s+(\w+)\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+default\s+/gm, "");
  code = code.replace(/^export\s+\{[\s\S]*?\};?$/gm, "");
  code = code.replace(/^export\s+\*\s+from\s+['"].*['"];?$/gm, "");
  code = code.replace(/^export\s+\{[^}]*\}\s*(?:from\s+['"][^'"]+['"])?\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+type\s+\{[^}]*\}\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+((?:async\s+)?function|class|const|let|var)\s+/gm, "$1 ");

  const lines = code.split("\n");
  const cleaned: string[] = [];
  let balance = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const isDanglingClose = /^\}[\s;,]*$/.test(trimmed) && !/^\s/.test(line);
    if (isDanglingClose && balance <= 0) continue;
    balance += braceBalance(line);
    cleaned.push(line);
  }
  code = cleaned.join("\n").trim();

  code = code.replace(/^;\s*$/gm, "");
  code = code.replace(/^\s*;\s*\n/gm, "");

  return code;
}

function isValidJSX(code: string, blockName?: string): boolean {
  if (isTestFile(code)) {
    console.log(`[isValidJSX] REJECT ${blockName}: confirmed test file (framework import + test body)`);
    return false;
  }

  const firstLine = code.split("\n")[0].trim();
  if (firstLine.startsWith("#")) return false;
  if (/^[.#:@]/.test(firstLine)) return false;
  if (/^\*\s*\{/.test(firstLine)) return false;
  if (/^[a-z-]+\s*:\s*[^;{]+;/.test(firstLine)) return false;

  const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+[\s/>]|return\s*\(/.test(code);
  const hasFunction = /function\s+[A-Za-z]|const\s+[A-Za-z][a-zA-Z]*\s*=|=>/.test(code);
  const hasPlainJS = /^(?:const|let|var|function|class|async\s+function)\s+[A-Za-z]/m.test(code);
  const hasImportOrExport = /^(import|export)\s/m.test(code);

  if (!hasJSX && !hasFunction && !hasPlainJS && !hasImportOrExport) return false;

  console.log(
    `[isValidJSX] ACCEPT ${blockName}: hasJSX=${hasJSX} hasFunction=${hasFunction} ` +
    `hasPlainJS=${hasPlainJS} hasImportOrExport=${hasImportOrExport}`
  );
  return true;
}

// ─── Port readiness check ─────────────────────────────────────────────────────

async function isPortOpen(sandbox: any, port: number): Promise<boolean> {
  try {
    const r = await sandbox.process.executeCommand(
      `timeout 5 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/${port}" 2>/dev/null && echo "OPEN" || echo "CLOSED"`,
      "/", undefined, 10
    );
    const isOpen = r.result?.includes("OPEN") || false;
    if (isOpen) {
      try {
        const htmlCheck = await sandbox.process.executeCommand(
          `timeout 3 curl -s http://localhost:${port}/ 2>/dev/null | head -c 500`,
          "/", undefined, 8
        );
        const html = htmlCheck.result || "";
        return (
          html.includes("<!DOCTYPE") ||
          html.includes('id="root"') ||
          html.includes("<html") ||
          html.length > 0
        );
      } catch {
        return isOpen;
      }
    }
    return false;
  } catch (e) {
    console.warn(`[isPortOpen] error checking port ${port}:`, e);
    return false;
  }
}

// ─── Component name helper ────────────────────────────────────────────────────

function toComponentName(raw: string): string {
  return (
    raw
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") || "Component"
  );
}

// ─── FIX #6: Package.json hash for install skip ───────────────────────────────

function hashPackageJson(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// ─── BUG FIX G+H: resolve section destination path ───────────────────────────

function resolveRefName(
  sectionPath: string,
  sectionBasename: string,
  unclaimedRefs: string[]
): string {
  const idxFull = unclaimedRefs.findIndex((r) => r === sectionPath);
  if (idxFull !== -1) return unclaimedRefs.splice(idxFull, 1)[0];

  const idxBase = unclaimedRefs.findIndex(
    (r) => r === sectionBasename || r.endsWith(`/${sectionBasename}`)
  );
  if (idxBase !== -1) return unclaimedRefs.splice(idxBase, 1)[0];

  return sectionPath;
}

// ─── FIX J: Topological JS load-order sort ───────────────────────────────────

function inferJSDependencies(
  jsFiles: string[],
  files: Record<string, string>
): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();

  const stemToFile = new Map<string, string>();
  for (const f of jsFiles) {
    const basename = f.replace(/^.*\//, "").replace(/\.m?js$/, "");
    stemToFile.set(basename.toLowerCase(), f);
    stemToFile.set(basename, f);
  }

  for (const f of jsFiles) {
    const fileDeps = new Set<string>();
    const content = files[`/workspace/${f}`] ?? "";

    for (const [stem, depFile] of stemToFile) {
      if (depFile === f) continue;
      if (stem.length < 3) continue;
      const pattern = new RegExp(`\\b${stem}\\b`, "i");
      if (pattern.test(content)) fileDeps.add(depFile);
    }
    deps.set(f, fileDeps);
  }

  return deps;
}

function topoSortJS(jsFiles: string[], deps: Map<string, Set<string>>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(f: string) {
    if (visited.has(f)) return;
    if (visiting.has(f)) return;
    visiting.add(f);
    for (const dep of deps.get(f) ?? []) visit(dep);
    visiting.delete(f);
    visited.add(f);
    sorted.push(f);
  }

  for (const f of jsFiles) visit(f);
  for (const f of jsFiles) { if (!visited.has(f)) sorted.push(f); }

  return sorted;
}

// ─── FIX T: HMR config string — used in both scaffold and LLM vite.config patch ─
//
// When the preview is accessed via a remote Daytona proxy URL (HTTPS), Vite's
// default HMR tries to open a websocket to ws://localhost:5173 — which is the
// user's local machine, not the sandbox. This causes ERR_CONNECTION_REFUSED in
// the browser console and breaks hot-reload entirely.
//
// Setting clientPort=443 + protocol='wss' tells the Vite client bundle to use
// the same host the page was loaded from (the Daytona proxy domain) over WSS,
// which correctly routes through the proxy to the sandbox.

const VITE_HMR_CONFIG = `    hmr: {\n      clientPort: 443,\n      protocol: 'wss',\n    },`;

// ─── Main scaffold builder ────────────────────────────────────────────────────

export function buildScaffoldFiles(blocks: BlockRow[]): Record<string, string> {
  const files: Record<string, string> = {};
  let hasPackageJson = false;
  let viteScaffoldInjected = false;

  const projectType = detectProjectType(blocks);
  console.log(`[scaffold] detected project type: ${projectType}`);

  // ── FIX #4 + BUG FIX A/B/D/E/F/G/H: HTML project path ───────────────────
  if (projectType === "HTML") {
    const cssFileNames: string[] = [];
    const jsFileNames: string[] = [];

    let htmlSourceForRefs = "";
    for (const block of blocks) {
      if (!block.outputCode) continue;
      const sections = splitFileSections(block.outputCode);
      if (sections.length > 0) {
        const htmlSection = sections.find(
          (s) => s.filename.endsWith(".html") || classifyBlockContent(s.content) === "HTML"
        );
        if (htmlSection) { htmlSourceForRefs = htmlSection.content; break; }
      } else {
        const raw = stripFencesAndHeaders(block.outputCode);
        if (classifyBlockContent(raw) === "HTML") { htmlSourceForRefs = raw; break; }
      }
    }

    const unclaimedScripts = extractReferencedScripts(htmlSourceForRefs);
    const unclaimedLinks   = extractReferencedLinks(htmlSourceForRefs);
    console.log(
      `[scaffold] HTML references — scripts: [${unclaimedScripts.join(", ")}] ` +
      `links: [${unclaimedLinks.join(", ")}]`
    );

    for (const block of blocks) {
      if (!block.outputCode) continue;

      const preferredName = block.name
        ? toComponentName(block.name).toLowerCase()
        : block.id.replace(/-/g, "").slice(0, 8);

      const sections = splitFileSections(block.outputCode);

      if (sections.length > 0) {
        console.log(
          `[scaffold] block "${block.name ?? block.id}" has ${sections.length} FILE sections: ` +
          sections.map((s) => s.filename).join(", ")
        );

        for (const section of sections) {
          if (isAnyTestFile(section.filename, section.content, block.blockType)) {
            console.log(`[scaffold] skipping test section "${section.filename}"`);
            continue;
          }

          const sectionPath     = section.filename.replace(/^[./\\]+/, "");
          const sectionBasename = sectionPath.replace(/^.*[/\\]/, "");
          const blockType       = classifyBlockContent(section.content);

          if (blockType === "HTML") {
            const dest = files["/workspace/index.html"]
              ? `/workspace/${sectionPath}`
              : "/workspace/index.html";
            files[dest] = section.content;
            console.log(`[scaffold] FILE section HTML → ${dest}`);

          } else if (blockType === "CSS") {
            const cssName = resolveRefName(sectionPath, sectionBasename, unclaimedLinks);
            files[`/workspace/${cssName}`] = section.content;
            cssFileNames.push(cssName);
            console.log(`[scaffold] FILE section CSS → /workspace/${cssName}`);

          } else if (blockType === "JS" || blockType === "REACT_JS") {
            const jsName = resolveRefName(sectionPath, sectionBasename, unclaimedScripts);
            files[`/workspace/${jsName}`] = section.content;
            jsFileNames.push(jsName);
            console.log(`[scaffold] FILE section JS → /workspace/${jsName}`);

          } else {
            const ext = sectionBasename.split(".").pop()?.toLowerCase();
            if (ext === "js" || ext === "ts" || ext === "mjs") {
              const jsName = resolveRefName(sectionPath, sectionBasename, unclaimedScripts);
              files[`/workspace/${jsName}`] = section.content;
              jsFileNames.push(jsName);
              console.log(`[scaffold] FILE section JS (ext-fallback) → /workspace/${jsName}`);
            } else if (ext === "css") {
              const cssName = resolveRefName(sectionPath, sectionBasename, unclaimedLinks);
              files[`/workspace/${cssName}`] = section.content;
              cssFileNames.push(cssName);
              console.log(`[scaffold] FILE section CSS (ext-fallback) → /workspace/${cssName}`);
            } else {
              console.log(`[scaffold] FILE section truly unclassifiable "${sectionBasename}" — skipping`);
            }
          }
        }
        continue;
      }

      const raw = stripFencesAndHeaders(block.outputCode);
      const blockType = classifyBlockContent(raw);

      if (blockType === "HTML") {
        const dest = files["/workspace/index.html"]
          ? `/workspace/${preferredName}.html`
          : "/workspace/index.html";
        files[dest] = raw;
        console.log(`[scaffold] HTML block → ${dest}`);

      } else if (blockType === "CSS") {
        const cssName = unclaimedLinks.shift() ?? `${preferredName}.css`;
        files[`/workspace/${cssName}`] = raw;
        cssFileNames.push(cssName);
        console.log(`[scaffold] CSS block → /workspace/${cssName}`);

      } else if (blockType === "JS" || blockType === "REACT_JS") {
        const jsName = unclaimedScripts.shift() ?? `${preferredName}.js`;
        files[`/workspace/${jsName}`] = raw;
        jsFileNames.push(jsName);
        console.log(`[scaffold] JS block → /workspace/${jsName}`);

      } else {
        const ext = preferredName.split(".").pop()?.toLowerCase();
        if (ext === "js" || ext === "ts") {
          const jsName = unclaimedScripts.shift() ?? `${preferredName}.js`;
          files[`/workspace/${jsName}`] = raw;
          jsFileNames.push(jsName);
          console.log(`[scaffold] JS block (ext-fallback) → /workspace/${jsName}`);
        } else {
          console.log(`[scaffold] UNKNOWN block type for "${block.name ?? block.id}" — skipping`);
        }
      }
    }

    if (!files["/workspace/index.html"]) {
      files["/workspace/index.html"] =
        "<!DOCTYPE html><html><body><p>No HTML content found.</p></body></html>";
    }

    let html = files["/workspace/index.html"];

    const CSS_FOUNDATION = [/variables/i, /reset/i, /base/i, /normalize/i, /global/i];
    const cssFilesToInject = cssFileNames.filter(
      (f) => !html.includes(f) && !html.includes(f.replace(/^.*\//, ""))
    );
    cssFilesToInject.sort((a, b) => {
      const aF = CSS_FOUNDATION.some((p) => p.test(a)) ? 0 : 1;
      const bF = CSS_FOUNDATION.some((p) => p.test(b)) ? 0 : 1;
      return aF - bF;
    });
    for (const cssFile of cssFilesToInject) {
      const tag = `<link rel="stylesheet" href="/${cssFile}">`;
      html = html.includes("</head>")
        ? html.replace("</head>", `  ${tag}\n</head>`)
        : tag + "\n" + html;
      console.log(`[scaffold] auto-linked CSS: ${cssFile}`);
    }

    const jsFilesToInject = jsFileNames.filter(
      (f) => !html.includes(f) && !html.includes(f.replace(/^.*\//, ""))
    );
    const jsDeps    = inferJSDependencies(jsFilesToInject, files);
    const jsOrdered = topoSortJS(jsFilesToInject, jsDeps);
    for (const jsFile of jsOrdered) {
      const tag = `<script src="/${jsFile}"></script>`;
      html = html.includes("</body>")
        ? html.replace("</body>", `  ${tag}\n</body>`)
        : html + "\n" + tag;
      console.log(`[scaffold] auto-linked JS: ${jsFile}`);
    }

    files["/workspace/index.html"] = html;
    console.log("[scaffold] HTML project: skipping Vite entirely");
    return files;
  }

  // ── Collect component files from blocks (React / Next path) ─────────────────
  const processedBlockIds = new Set<string>();

  for (const block of blocks) {
    if (!block.outputCode) continue;

    const preferredName = block.name
      ? toComponentName(block.name)
      : block.id.replace(/-/g, "").slice(0, 16);

    const fileSections = splitFileSections(block.outputCode);
    if (fileSections.length > 0) {
      console.log(
        `[scaffold] FIX N — block "${block.name ?? block.id}" has ${fileSections.length} FILE sections: ` +
        fileSections.map((s) => s.filename).join(", ")
      );

      for (const section of fileSections) {
        if (isAnyTestFile(section.filename, section.content, block.blockType)) {
          console.log(`[scaffold] FIX N — skipping test section "${section.filename}"`);
          continue;
        }

        let destPath = section.filename.replace(/^[./\\]+/, "");
        const ext = destPath.split(".").pop()?.toLowerCase() ?? "";

        if (destPath.includes("package.json")) {
          try {
            JSON.parse(section.content);
            files["/workspace/package.json"] = section.content;
            hasPackageJson = true;
          } catch { /* ignore malformed JSON */ }
          continue;
        }

        if (isRootConfigFile(destPath)) {
          files[`/workspace/${destPath}`] = section.content;
          console.log(`[scaffold] FIX O — root config → /workspace/${destPath}`);
          continue;
        }

        if (ext === "css" || looksLikePureCSS(section.content)) {
          if (!destPath.startsWith("src/")) destPath = `src/${destPath}`;
          files[`/workspace/${destPath}`] = section.content;
          console.log(`[scaffold] FIX N — CSS → /workspace/${destPath}`);
          continue;
        }

        if ((ext === "ts" || ext === "js") && !ext.endsWith("x")) {
          if (!destPath.startsWith("src/")) destPath = `src/${destPath}`;
          files[`/workspace/${destPath}`] = section.content;
          console.log(`[scaffold] FIX N — TS/JS → /workspace/${destPath}`);
          continue;
        }

        if (ext === "tsx" || ext === "jsx" || hasReactSignals(section.content)) {
          if (!destPath.startsWith("src/")) destPath = `src/${destPath}`;

          if (ext === "jsx" && isTypeScriptFile(section.content)) {
            destPath = destPath.replace(/\.jsx$/, ".tsx");
          }

          let contentToSave = section.content;
          const compMatch = destPath.match(/\/([A-Z][a-zA-Z0-9_]*)\.(tsx|jsx)$/);
          if (compMatch) {
              const compName = compMatch[1];
              if ((contentToSave.includes(`export function ${compName}`) || contentToSave.includes(`export const ${compName}`)) && !contentToSave.includes('export default')) {
                  contentToSave += `\n\nexport default ${compName};\n`;
              }
          }

          if (
            looksLikeAppRoot(contentToSave) &&
            !files["/workspace/src/App.tsx"] &&
            !destPath.toLowerCase().includes("/app.")
          ) {
            const appExt = isTypeScriptFile(contentToSave) ? "tsx" : "jsx";
            destPath = `src/App.${appExt}`;
            console.log(`[scaffold] FIX N+K — promoted to ${destPath}`);
          }

          files[`/workspace/${destPath}`] = contentToSave;
          console.log(`[scaffold] FIX N — TSX/JSX → /workspace/${destPath}`);
          continue;
        }

        files[`/workspace/${destPath}`] = section.content;
        console.log(`[scaffold] FIX N — fallback → /workspace/${destPath}`);
      }

      processedBlockIds.add(block.id);
      continue;
    }

    // ── Fenced-block regex path ───────────────────────────────────────────────
    const fenceRegex =
      /```[\w]*\r?\n(?:\/\/\s*(?:filename|file|filepath):\s*([A-Za-z0-9._/\\-]+)\s*\n)?([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    let foundFiles = false;

    while ((match = fenceRegex.exec(block.outputCode)) !== null) {
      let filename = match[1]?.trim();
      let rawContent = match[2];

      if (!filename) {
        const inlineMatch =
          /^\/\/\s*(?:filename|file|filepath):\s*([A-Za-z0-9._/\\-]+)\s*\n/i.exec(rawContent);
        if (inlineMatch) {
          filename = inlineMatch[1].trim();
          rawContent = rawContent.replace(inlineMatch[0], "");
        } else {
          const isTS = isTypeScriptFile(rawContent);
          const isCSSContent = looksLikePureCSS(rawContent);
          const ext = isCSSContent
            ? "css"
            : rawContent.includes("React") || rawContent.includes("className=")
            ? isTS ? "tsx" : "jsx"
            : rawContent.includes("<html") ? "html" : "js";
          filename = `src/components/${preferredName}.${ext}`;
        }
      }

      filename = filename.replace(/^[/\\]/, "");

      if (isAnyTestFile(filename, rawContent, block.blockType)) {
        console.log(`[scaffold] FIX S — skipping fenced test section "${filename}"`);
        continue;
      }

      if (
        filename.startsWith("src/components/") &&
        /^src\/components\/[0-9a-f]{16,}/.test(filename) &&
        block.name
      ) {
        const isTS = isTypeScriptFile(rawContent);
        filename = `src/components/${preferredName}.${isTS ? "tsx" : "jsx"}`;
      }

      if (!filename.includes("package.json")) {
        const fileParts = rawContent.split(/\/\/\s*(?:FILE|filename|file|filepath):\s*([^\n]+)\n/i);
        if (fileParts.length > 1) {
          // Multi-file block inside a single fence
          for (let i = 1; i < fileParts.length; i += 2) {
            let partName = fileParts[i].trim().replace(/^[/\\]/, "");
            let partContent = fileParts[i + 1];
            
            const isConfig = partName.includes("package.json") || partName.endsWith("vite.config.js") || partName.endsWith("vite.config.ts") || partName.endsWith(".html") || partName.endsWith(".css") || isRootConfigFile(partName);
            if (!isConfig) {
              const partFencedType = classifyBlockContent(partContent);
              partContent = sanitizeBlockCode(partContent, partFencedType !== "REACT_TS");
              partContent = stripTrailingCSS(partContent);
            }
            if (partName.includes("package.json")) hasPackageJson = true;

            let contentToSave = partContent.trim();
            const compMatch = partName.match(/\/([A-Z][a-zA-Z0-9_]*)\.(tsx|jsx)$/);
            if (compMatch) {
                const compName = compMatch[1];
                if ((contentToSave.includes(`export function ${compName}`) || contentToSave.includes(`export const ${compName}`)) && !contentToSave.includes('export default')) {
                    contentToSave += `\n\nexport default ${compName};\n`;
                }
            }

            files[`/workspace/${partName}`] = contentToSave;
          }
          foundFiles = true;
          processedBlockIds.add(block.id);
          continue;
        }

        const trimmedRaw = rawContent.trimStart();
        if (trimmedRaw.startsWith("{") && trimmedRaw.includes('"scripts"')) {
          try {
            JSON.parse(trimmedRaw);
            console.log(`[scaffold] fenced package.json detected in block "${block.id}" — writing`);
            files["/workspace/package.json"] = trimmedRaw.trim();
            hasPackageJson = true;
            foundFiles = true;
            processedBlockIds.add(block.id);
            continue;
          } catch { /* not valid JSON, fall through */ }
        }
      }

      const isConfigFile =
        filename.includes("package.json") ||
        filename.endsWith("vite.config.js") ||
        filename.endsWith("vite.config.ts") ||
        filename.endsWith(".html") ||
        filename.endsWith(".css") ||
        isRootConfigFile(filename);

      if (isConfigFile) {
        if (filename.includes("package.json")) hasPackageJson = true;
        files[`/workspace/${filename}`] = rawContent.trim();
        foundFiles = true;
        processedBlockIds.add(block.id);
        continue;
      }

      const firstTrimmed = rawContent.trimStart().split("\n")[0].trim();
      const looksLikeShellOrProse =
        /^(git |npm |npx |cp |cd |mkdir |rm |ls |cat |echo |export |source |\$ )/.test(firstTrimmed) ||
        /^[├└│─]/.test(firstTrimmed) ||
        /^[a-z][\w-]*\/$/.test(firstTrimmed) ||
        (/^[a-z]/.test(firstTrimmed) && !/[({=<]/.test(firstTrimmed) && firstTrimmed.length < 40 && !firstTrimmed.includes("import") && !firstTrimmed.includes("const") && !firstTrimmed.includes("function"));
      if (looksLikeShellOrProse) {
        continue;
      }

      const fencedBlockType = classifyBlockContent(rawContent);
      const forJS = fencedBlockType !== "REACT_TS";
      let content = sanitizeBlockCode(rawContent, forJS);
      content = stripTrailingCSS(content);

      if (looksLikePureCSS(content)) {
        console.log(`[scaffold] CSS block detected for "${filename}" — saving as .css`);
        files[`/workspace/src/components/${preferredName}.css`] = rawContent.trim();
        foundFiles = true;
        processedBlockIds.add(block.id);
        continue;
      }

      if (!isValidJSX(content, filename)) {
        console.log(`[scaffold] skipping invalid JSX for "${filename}" (block ${block.id})`);
        continue;
      }

      if (
        looksLikeAppRoot(content) &&
        !files["/workspace/src/App.tsx"] &&
        !filename.toLowerCase().includes("app")
      ) {
        const isTS = isTypeScriptFile(content);
        const promotedFilename = isTS ? "src/App.tsx" : "src/App.jsx";
        console.log(
          `[scaffold] FIX K — fenced block "${filename}" promoted to ${promotedFilename} ` +
          `(imports 2+ ./components/*)`
        );
        files[`/workspace/${promotedFilename}`] = content;
      } else {
        files[`/workspace/${filename}`] = content;
      }

      foundFiles = true;
      processedBlockIds.add(block.id);
    }

    // ── BUG FIX C: unfenced fallback ──────────────────────────────────────────
    if (!foundFiles && !processedBlockIds.has(block.id)) {
      const rawContent = block.outputCode.trim();
      if (rawContent.length > 20) {
        if (looksLikePureHTML(rawContent)) {
          files[`/workspace/src/components/${preferredName}.html`] = rawContent;
          continue;
        }

        const stripped = stripFencesAndHeaders(rawContent);

        if (isAnyTestFile(block.name ?? block.id, stripped, block.blockType)) {
          console.log(`[scaffold] FIX S — skipping unfenced test block "${block.name ?? block.id}"`);
          continue;
        }

        const pkgSearch = rawContent;
        const pkgStart = pkgSearch.indexOf('"scripts"') !== -1 && pkgSearch.indexOf('"dependencies"') !== -1
          ? pkgSearch.lastIndexOf("{", pkgSearch.indexOf('"scripts"'))
          : -1;
        if (pkgStart !== -1) {
          let depth = 0;
          let pkgEnd = -1;
          for (let ci = pkgStart; ci < pkgSearch.length; ci++) {
            if (pkgSearch[ci] === "{") depth++;
            else if (pkgSearch[ci] === "}") { depth--; if (depth === 0) { pkgEnd = ci + 1; break; } }
          }
          if (pkgEnd !== -1) {
            const pkgCandidate = pkgSearch.slice(pkgStart, pkgEnd);
            try {
              JSON.parse(pkgCandidate);
              console.log(`[scaffold] extracted package.json from block "${block.name ?? block.id}" — writing`);
              files["/workspace/package.json"] = pkgCandidate.trim();
              hasPackageJson = true;
              foundFiles = true;
              processedBlockIds.add(block.id);
              continue;
            } catch { /* malformed JSON, fall through */ }
          }
        }

        const blockType = classifyBlockContent(stripped);

        if (blockType === "CSS") {
          console.log(`[scaffold] CSS block (unfenced) "${block.name ?? block.id}" — saving as .css`);
          files[`/workspace/src/components/${preferredName}.css`] = stripped;
          foundFiles = true;
          processedBlockIds.add(block.id);
          continue;
        }

        if (blockType === "JS") {
          console.log(`[scaffold] JS block (unfenced) "${block.name ?? block.id}" — saving as .js`);
          files[`/workspace/src/components/${preferredName}.js`] = stripped;
          foundFiles = true;
          processedBlockIds.add(block.id);
          continue;
        }

        const forJS = blockType !== "REACT_TS";
        let content = sanitizeBlockCode(rawContent, forJS);
        content = stripTrailingCSS(content);

        if (!isValidJSX(content, block.name ?? block.id)) {
          console.log(`[scaffold] skipping non-JSX unfenced block "${block.name ?? block.id}"`);
          continue;
        }

        const isTS = isTypeScriptFile(content);
        const ext = isTS ? "tsx" : "jsx";

        if (looksLikeAppRoot(content) && !files["/workspace/src/App.tsx"]) {
          console.log(
            `[scaffold] FIX K — unfenced block "${block.name ?? block.id}" promoted to src/App.${ext} ` +
            `(imports 2+ ./components/*)`
          );
          files[`/workspace/src/App.${ext}`] = content;
        } else {
          files[`/workspace/src/components/${preferredName}.${ext}`] = content;
        }
      }
    }
  }

  // ── FIX #5 (rewrite): Real Next.js scaffold ───────────────────────────────
  if (projectType === "NEXT") {
    console.log("[scaffold] NEXT project detected — building real Next.js scaffold");

    const nextAppFiles: Record<string, string> = {};

    for (const [path, content] of Object.entries(files)) {
      const relative = path.replace(/^\/workspace\/src\//, "");
      nextAppFiles[`/workspace/${relative}`] = content;
    }
    for (const key of Object.keys(files)) delete files[key];

    const promotedApp =
      nextAppFiles["/workspace/App.tsx"] ||
      nextAppFiles["/workspace/App.jsx"] ||
      null;

    const componentEntries = Object.entries(nextAppFiles).filter(
      ([k]) =>
        !k.includes("/workspace/App.") &&
        (k.endsWith(".tsx") || k.endsWith(".jsx") || k.endsWith(".ts") || k.endsWith(".js") || k.endsWith(".css"))
    );

    for (const [origPath, content] of componentEntries) {
      const basename = origPath.replace(/^.*\//, "");
      files[`/workspace/app/components/${basename}`] = content;
    }

    if (promotedApp) {
      files["/workspace/app/page.tsx"] =
        `'use client';\n\n${promotedApp}\n`;
    } else if (componentEntries.length > 0) {
      const [firstPath] = componentEntries[0];
      const firstBasename = firstPath.replace(/^.*\//, "").replace(/\.(tsx|jsx)$/, "");
      const firstComponentName = firstBasename.charAt(0).toUpperCase() + firstBasename.slice(1);
      files["/workspace/app/page.tsx"] =
        `'use client';\nimport ${firstComponentName} from './components/${firstBasename}';\n\nexport default function Page() {\n  return <${firstComponentName} />;\n}\n`;
    } else {
      files["/workspace/app/page.tsx"] =
        `export default function Page() {\n  return (\n    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>\n      <h1>Preview Ready</h1>\n    </main>\n  );\n}\n`;
    }

    files["/workspace/app/layout.tsx"] =
      `import type { Metadata } from 'next';\nexport const metadata: Metadata = { title: 'Preview' };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <head>\n        <script src="https://cdn.tailwindcss.com" />\n      </head>\n      <body>{children}</body>\n    </html>\n  );\n}\n`;

    if (!files["/workspace/next.config.js"] && !files["/workspace/next.config.ts"]) {
      files["/workspace/next.config.js"] =
        `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n`;
    }

    if (!files["/workspace/tsconfig.json"]) {
      files["/workspace/tsconfig.json"] = JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: false,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: { "@/*": ["./*"] },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2
      );
    }

    const allBlockCode = blocks.map((b) => b.outputCode ?? "");
    const detectedDeps = extractDependencies(allBlockCode);
    const TEST_ONLY_PKGS = new Set([
      "@testing-library/react", "@testing-library/user-event", "@testing-library/jest-dom",
      "vitest", "@vitest/ui", "jest", "@jest/globals", "jest-environment-jsdom",
    ]);
    const extraDeps: Record<string, string> = {};
    for (const dep of detectedDeps) {
      if (!TEST_ONLY_PKGS.has(dep) && dep !== "next" && dep !== "react" && dep !== "react-dom") {
        extraDeps[dep] = VERSION_PINS[dep] ?? "latest";
      }
    }

    if (!files["/workspace/package.json"]) {
      files["/workspace/package.json"] = JSON.stringify(
        {
          name: "craftastudio-next-preview",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev -p 3000",
            build: "next build",
            start: "next start -p 3000",
          },
          dependencies: {
            next: "14.2.5",
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "lucide-react": "^0.383.0",
            "framer-motion": "^11.3.19",
            ...extraDeps,
          },
          devDependencies: {
            typescript: "^5.4.0",
            "@types/node": "^20",
            "@types/react": "^18.3.1",
            "@types/react-dom": "^18.3.0",
          },
        },
        null,
        2
      );
    } else {
      try {
        const pkg = JSON.parse(files["/workspace/package.json"]);
        pkg.scripts = pkg.scripts ?? {};
        pkg.scripts.dev = "next dev -p 3000";
        pkg.dependencies = pkg.dependencies ?? {};
        if (!pkg.dependencies["next"]) pkg.dependencies["next"] = "14.2.5";
        if (!pkg.dependencies["react"]) pkg.dependencies["react"] = "^18.3.1";
        if (!pkg.dependencies["react-dom"]) pkg.dependencies["react-dom"] = "^18.3.1";
        pkg.devDependencies = pkg.devDependencies ?? {};
        delete pkg.devDependencies["vite"];
        delete pkg.devDependencies["@vitejs/plugin-react"];
        delete pkg.devDependencies["@vitejs/plugin-react-swc"];
        for (const dep of TEST_ONLY_PKGS) {
          delete pkg.devDependencies[dep];
          if (pkg.dependencies) delete pkg.dependencies[dep];
        }
        files["/workspace/package.json"] = JSON.stringify(pkg, null, 2);
      } catch {
        console.warn("[scaffold] could not patch Next.js package.json");
      }
    }

    console.log("[scaffold] Next.js scaffold complete:", Object.keys(files).join(", "));
    return files;
  }


  // ── FIX #1: Extract all dependencies from block code ────────────────────────
  const allBlockCode = blocks.map((b) => b.outputCode ?? "");
  const detectedDeps = extractDependencies(allBlockCode);
  console.log(`[scaffold] auto-detected dependencies: ${detectedDeps.join(", ") || "(none extra)"}`);

  // ── Inject Vite scaffold ──────────────────────────────────────────────────────
  if (!files["/workspace/index.html"]) {
    viteScaffoldInjected = true;

    if (hasPackageJson && files["/workspace/package.json"]) {
      try {
        const pkg = JSON.parse(files["/workspace/package.json"]);
        pkg.scripts = pkg.scripts ?? {};
        pkg.scripts.dev = "vite --host 0.0.0.0 --port 3000";
        pkg.devDependencies = pkg.devDependencies ?? {};
        delete pkg.devDependencies["@vitejs/plugin-react"];
        pkg.devDependencies["@vitejs/plugin-react-swc"] = "^3.5.0";
        if (!pkg.devDependencies["vite"]) pkg.devDependencies["vite"] = "^5.4.2";
        if (!pkg.devDependencies["typescript"]) pkg.devDependencies["typescript"] = "^5.4.0";
        if (!pkg.devDependencies["@types/react"]) pkg.devDependencies["@types/react"] = "^18.3.1";
        if (!pkg.devDependencies["@types/react-dom"]) pkg.devDependencies["@types/react-dom"] = "^18.3.0";
        pkg.type = "module";
        const testDeps = [
          "@testing-library/react", "@testing-library/user-event", "@testing-library/jest-dom",
          "vitest", "@vitest/ui", "jest", "@jest/globals", "jest-environment-jsdom",
        ];
        for (const dep of testDeps) {
          delete pkg.devDependencies[dep];
          if (pkg.dependencies) delete pkg.dependencies[dep];
        }
        if (pkg.dependencies?.["tailwindcss"]) pkg.dependencies["tailwindcss"] = "^3.4.4";
        if (pkg.devDependencies?.["tailwindcss"]) pkg.devDependencies["tailwindcss"] = "^3.4.4";
        if (pkg.dependencies?.["postcss"]) pkg.dependencies["postcss"] = "^8.4.38";
        if (pkg.devDependencies?.["postcss"]) pkg.devDependencies["postcss"] = "^8.4.38";
        if (pkg.dependencies?.["autoprefixer"]) pkg.dependencies["autoprefixer"] = "^10.4.19";
        if (pkg.devDependencies?.["autoprefixer"]) pkg.devDependencies["autoprefixer"] = "^10.4.19";
        files["/workspace/package.json"] = JSON.stringify(pkg, null, 2);
        console.log("[scaffold] patched LLM package.json: dev script + tailwind v3 + @vitejs/plugin-react-swc + removed test deps");
      } catch {
        console.warn("[scaffold] could not patch LLM package.json — using scaffold package.json");
        hasPackageJson = false;
      }
    }

    if (!hasPackageJson) {
      const allDeps: Record<string, string> = {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.0",
        "lucide-react": "^0.383.0",
        "framer-motion": "^11.3.19",
        "clsx": "^2.1.1",
        "tailwind-merge": "^2.5.2",
        "class-variance-authority": "^0.7.0",
        "zod": "^3.23.8",
        "react-hook-form": "^7.53.0",
        "@hookform/resolvers": "^3.9.0",
        "date-fns": "^3.6.0",
        "recharts": "^2.12.7",
        "axios": "^1.7.7",
        "zustand": "^5.0.0",
      };
      const TEST_ONLY_PKGS = new Set([
        "@testing-library/react", "@testing-library/user-event", "@testing-library/jest-dom",
        "vitest", "@vitest/ui", "jest", "@jest/globals", "jest-environment-jsdom",
      ]);
      for (const dep of detectedDeps) {
        if (!allDeps[dep] && !TEST_ONLY_PKGS.has(dep)) {
          allDeps[dep] = VERSION_PINS[dep] ?? "latest";
        }
      }
      files["/workspace/package.json"] = JSON.stringify(
        {
          name: "craftastudio-preview",
          private: true,
          type: "module",
          scripts: {
            dev: "vite --host 0.0.0.0 --port 3000",
            build: "tsc && vite build",
            preview: "vite preview",
          },
          dependencies: allDeps,
          devDependencies: {
            "@vitejs/plugin-react-swc": "^3.5.0",
            vite: "^5.4.2",
            typescript: "^5.4.0",
            "@types/react": "^18.3.1",
            "@types/react-dom": "^18.3.0",
            tailwindcss: "^3.4.4",
            postcss: "^8.4.38",
            autoprefixer: "^10.4.19",
          },
        },
        null,
        2
      );
    }

    const hasLLMViteConfig =
      !!files["/workspace/vite.config.ts"] || !!files["/workspace/vite.config.js"];

    if (!hasLLMViteConfig) {
      // ── FIX T: scaffold vite.config.js includes HMR config for remote previews ──
      // clientPort=443 + protocol='wss' ensures the Vite HMR websocket connects
      // through the Daytona HTTPS proxy instead of trying ws://localhost:5173.
      files["/workspace/vite.config.js"] =
        `import { defineConfig } from 'vite';\n` +
        `import react from '@vitejs/plugin-react-swc';\n` +
        `export default defineConfig({\n` +
        `  plugins: [react()],\n` +
        `  server: {\n` +
        `    host: '0.0.0.0',\n` +
        `    port: 3000,\n` +
        `    allowedHosts: 'all',\n` +
        `    cors: { origin: '*' },\n` +
        `${VITE_HMR_CONFIG}\n` +
        `  },\n` +
        `  esbuild: { logOverride: { 'this-is-undefined-in-esm': 'silent' } },\n` +
        `});`;
    } else {
      // ── FIX O2 + FIX T: patch LLM-supplied vite.config ───────────────────────
      // 1. Replace @vitejs/plugin-react with @vitejs/plugin-react-swc (FIX O2)
      // 2. Inject HMR config if not already present (FIX T)
      const viteConfigKey = files["/workspace/vite.config.ts"]
        ? "/workspace/vite.config.ts"
        : "/workspace/vite.config.js";

      // FIX O2: patch plugin import
      files[viteConfigKey] = files[viteConfigKey]
        .replace(
          /from\s+['"]@vitejs\/plugin-react['"]/g,
          `from '@vitejs/plugin-react-swc'`
        )
        .replace(
          /require\s*\(\s*['"]@vitejs\/plugin-react['"]\s*\)/g,
          `require('@vitejs/plugin-react-swc')`
        );
      console.log(`[scaffold] FIX O2 — patched LLM vite.config to use @vitejs/plugin-react-swc`);

      // FIX T: inject HMR config into LLM-supplied vite.config if missing
      if (!files[viteConfigKey].includes("hmr:")) {
        files[viteConfigKey] = files[viteConfigKey].replace(
          /cors:\s*\{\s*origin:\s*['"][^'"]*['"]\s*\}/,
          `cors: { origin: '*' },\n${VITE_HMR_CONFIG}`
        );
        // Fallback: if cors block not found, inject after allowedHosts line
        if (!files[viteConfigKey].includes("hmr:")) {
          files[viteConfigKey] = files[viteConfigKey].replace(
            /(allowedHosts\s*:\s*['"]all['"][^\n]*\n)/,
            `$1    ${VITE_HMR_CONFIG}\n`
          );
        }
        console.log(`[scaffold] FIX T — injected HMR config into LLM vite.config`);
      }
    }

    if (!files["/workspace/tsconfig.json"]) {
      files["/workspace/tsconfig.json"] = JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: false,
            noUnusedLocals: false,
            noUnusedParameters: false,
          },
          include: ["src"],
        },
        null,
        2
      );
    }

    files["/workspace/index.html"] =
      `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Preview</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>`;

    // PostCSS + Tailwind config for proper local Tailwind (no CDN needed)
    if (!files["/workspace/postcss.config.js"]) {
      files["/workspace/postcss.config.js"] =
        `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`;
    }
    if (!files["/workspace/tailwind.config.js"]) {
      files["/workspace/tailwind.config.js"] =
        `/** @type {import('tailwindcss').Config} */\n` +
        `export default {\n` +
        `  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n` +
        `  theme: { extend: {} },\n` +
        `  plugins: [],\n` +
        `};\n`;
    }

    // Always inject src/lib/utils.ts so cn() is always available
    if (!files["/workspace/src/lib/utils.ts"]) {
      files["/workspace/src/lib/utils.ts"] =
        `import { clsx, type ClassValue } from 'clsx';\n` +
        `import { twMerge } from 'tailwind-merge';\n\n` +
        `export function cn(...inputs: ClassValue[]) {\n` +
        `  return twMerge(clsx(inputs));\n` +
        `}\n`;
    }

    const appExt = files["/workspace/src/App.tsx"] ? "tsx" : "jsx";
    // Global CSS with Tailwind directives — only inject if not already provided
    if (!files["/workspace/src/index.css"]) {
      files["/workspace/src/index.css"] =
        `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n` +
        `*, *::before, *::after { box-sizing: border-box; }\n` +
        `body { font-family: system-ui, -apple-system, sans-serif; }\n`;
    }
    files["/workspace/src/main.tsx"] =
      `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App.${appExt}';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n`;

    const hasPromotedAppRoot =
      !!files["/workspace/src/App.tsx"] || !!files["/workspace/src/App.jsx"];

    const componentFiles = Object.keys(files).filter(
      (k) =>
        k.startsWith("/workspace/src/") &&
        k !== "/workspace/src/main.tsx" &&
        k !== "/workspace/src/App.tsx" &&
        k !== "/workspace/src/App.jsx" &&
        (k.endsWith(".tsx") || k.endsWith(".jsx"))
    );

    const cssFiles = Object.keys(files).filter(
      (k) => k.startsWith("/workspace/src/") && k.endsWith(".css") && k !== "/workspace/src/index.css"
    );
    const cssImports = cssFiles
      .map((k) => `import '.${k.replace("/workspace/src", "")}';`)
      .join("\n");

    if (!hasPromotedAppRoot) {
      const errorBoundaryClass = `
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <div style={{ display: 'none' }} />;
    return this.props.children;
  }
}`;

      if (componentFiles.length > 0) {
        const imports = componentFiles
          .map(
            (k, i) =>
              `import Comp${i} from '.${k
                .replace("/workspace/src", "")
                .replace(/\.(tsx|jsx)$/, "")}';`
          )
          .join("\n");

        const routeElements = componentFiles
          .map((_, i) => {
            const path = i === 0 ? "/" : `/comp-${i}`;
            return `        <Route path="${path}" element={<ErrorBoundary><Comp${i} /></ErrorBoundary>} />`;
          })
          .join("\n");

        const navLinks = componentFiles.length > 1
          ? componentFiles
              .map((k, i) => {
                const label = k.replace(/^.*\//, "").replace(/\.(tsx|jsx)$/, "");
                const path = i === 0 ? "/" : `/comp-${i}`;
                return `        <Link to="${path}" style={{margin:'0 8px',color:'#6366f1',textDecoration:'none',fontSize:'13px'}}>${label}</Link>`;
              })
              .join("\n")
          : "";

        const navBar = componentFiles.length > 1
          ? `      <nav style={{padding:'8px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb',display:'flex',alignItems:'center',gap:'4px'}}>\n${navLinks}\n      </nav>`
          : "";

        const stackedElements = componentFiles.map((_, i) => `      <ErrorBoundary><Comp${i} /></ErrorBoundary>`).join("\n");
          files["/workspace/src/App.tsx"] =
            `import React from 'react';\n${cssImports ? cssImports + "\n" : ""}${imports}\n${errorBoundaryClass}\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-[#0f0f13] text-white overflow-x-hidden">\n${stackedElements}\n    </div>\n  );\n}`;
      } else {
        files["/workspace/src/App.tsx"] =
          `import React from 'react';\n${cssImports ? cssImports + "\n" : ""}${errorBoundaryClass}\n\nexport default function App() {\n  return (\n    <div style={{minHeight:'100vh',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif'}}>\n      <div style={{textAlign:'center',padding:'2rem'}}>\n        <h1 style={{fontSize:'1.5rem',fontWeight:'700',color:'#1f2937',marginBottom:'1rem'}}>Preview Ready</h1>\n        <p style={{color:'#6b7280'}}>No renderable UI components were found in this project.</p>\n        <p style={{color:'#9ca3af',fontSize:'0.875rem',marginTop:'0.5rem'}}>Check that your blocks output valid JSX components.</p>\n      </div>\n    </div>\n  );\n}`;
      }
    } else {
      const appKey = files["/workspace/src/App.tsx"] ? "/workspace/src/App.tsx" : "/workspace/src/App.jsx";
      if (files[appKey] && cssImports && !files[appKey].includes(cssImports.split("\n")[0])) {
        files[appKey] = cssImports + "\n" + files[appKey];
        console.log(`[scaffold] FIX K — injected CSS imports into promoted App file`);
      }
      console.log(
        `[scaffold] FIX K — skipping scaffold App.tsx generation; using promoted app-root block`
      );
    }
  }

  if (!viteScaffoldInjected && !hasPackageJson && !files["/workspace/index.html"]) {
    const htmlFile = Object.keys(files).find((k) => k.endsWith(".html"));
    if (htmlFile) {
      console.log(`[scaffold] static HTML fallback: using ${htmlFile} as index.html`);
      files["/workspace/index.html"] = files[htmlFile];
    }
  }

  // ─── FIX U: Auto-generate stubs for missing components (like export.ts) ──────
  function extractAllRelativeImports(content: string): string[] {
    const imports: string[] = [];
    const staticRegex = /from\s+['"](\.[^'"]+)['"]\s*[;,]?/g;
    let match;
    while ((match = staticRegex.exec(content)) !== null) imports.push(match[1]);
    const directRegex = /import\s+['"](\.[^'"]+)['"]\s*[;,]?/g;
    while ((match = directRegex.exec(content)) !== null) imports.push(match[1]);
    const dynamicRegex = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    while ((match = dynamicRegex.exec(content)) !== null) imports.push(match[1]);
    return imports;
  }

  const possibleExts = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js", "/index.tsx", ".css"];
  const filePathsSet = new Set(Object.keys(files));
  
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx") && !filePath.endsWith(".js") && !filePath.endsWith(".jsx")) {
      continue;
    }
    const dir = path.posix.dirname(filePath);
    
    for (const importPath of extractAllRelativeImports(content)) {
      const resolved = path.posix.join(dir, importPath);
      let found = possibleExts.some((ext) => filePathsSet.has(resolved + ext));
      
      if (!found) {
        const importBasenameLower = path.posix.basename(importPath).toLowerCase();
        for (const [key, _] of Object.entries(files)) {
          const keyBasename = path.posix.basename(key);
          const keyBasenameNoExt = keyBasename.replace(/\.[^/.]+$/, "").toLowerCase();
          
          if (keyBasenameNoExt === importBasenameLower) {
            found = true;
            const isCss = key.endsWith('.css');
            const stubPath = resolved + (isCss ? '.css' : '.ts');
            
            if (!filePathsSet.has(stubPath)) {
              const stubDir = path.posix.dirname(stubPath);
              let relPath = path.posix.relative(stubDir, key);
              if (!relPath.startsWith('.')) relPath = './' + relPath;
              
              files[stubPath] = isCss 
                ? `@import '${relPath}';` 
                : `export * from '${relPath}';\nexport { default } from '${relPath}';`;
              filePathsSet.add(stubPath);
              console.log(`[scaffold] FIX U — generated cross-directory redirect for ${importPath} -> ${relPath}`);
            }
            break;
          }
        }
      }

      if (found) continue;

      const isComponent = /\/components?\/|[A-Z]/.test(importPath.split("/").pop() ?? "");
      const isHook = /\/hooks?\/|^use[A-Z]/.test(importPath.split("/").pop() ?? "");
      const isCss = importPath.endsWith(".css");
      
      let stubPath = resolved;
      if (isCss) stubPath += "";
      else stubPath += (isComponent || isHook ? ".tsx" : ".ts");

      let stubCode = "";

      if (isCss) {
        stubCode = `/* AUTO-GENERATED STUB */`;
      } else if (isComponent) {
        const compName = (importPath.split("/").pop() ?? "Component").replace(/\.tsx?$/, "");
        stubCode = `// AUTO-GENERATED STUB\nimport React from 'react';\nexport default function ${compName}() {\n  return <div style={{padding:'1rem',border:'1px dashed #ccc'}}>Stub: ${compName}</div>;\n}`;
      } else if (isHook) {
        const hookName = (importPath.split("/").pop() ?? "useHook").replace(/\.tsx?$/, "");
        stubCode = `// AUTO-GENERATED STUB\nimport { useState, useEffect } from 'react';\nexport function ${hookName}() {\n  const [data, setData] = useState<any>(null);\n  useEffect(() => {}, []);\n  return { data, setData };\n}\nexport default ${hookName};`;
      } else {
        stubCode = `// AUTO-GENERATED STUB\nexport default {};`;
      }

      files[stubPath] = stubCode;
      filePathsSet.add(stubPath);
      console.log(`[scaffold] FIX U — generated stub for missing import ${importPath} -> ${stubPath}`);
    }
  }

  // ─── GLOBAL FIX: Replace hallucinated lucide-react types ─────────────────
  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content === "string") {
      files[filePath] = content.replace(/IconType/g, "LucideIcon");
    }
  }

  return files;
}

// ─── FIX #7 (extended): Self-healing — parse missing modules ─────────────────

function parseMissingModules(devlog: string): string[] {
  const missing: string[] = [];

  const TEST_ONLY_PKGS = new Set([
    "@testing-library/react", "@testing-library/user-event", "@testing-library/jest-dom",
    "vitest", "@vitest/ui", "jest", "@jest/globals", "jest-environment-jsdom",
  ]);

  function extractPkg(raw: string): string | null {
    if (raw.startsWith(".") || raw.startsWith("/")) return null;
    const pkg = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
    return pkg && !TEST_ONLY_PKGS.has(pkg) ? pkg : null;
  }

  let m: RegExpExecArray | null;

  const viteRegex = /Failed to resolve import ["']([^"']+)["']/g;
  while ((m = viteRegex.exec(devlog)) !== null) {
    const pkg = extractPkg(m[1]);
    if (pkg) missing.push(pkg);
  }

  const webpackRegex = /Module not found: Can't resolve ["']([^"']+)["']/g;
  while ((m = webpackRegex.exec(devlog)) !== null) {
    const pkg = extractPkg(m[1]);
    if (pkg) missing.push(pkg);
  }

  const nodeRegex = /Cannot find module ["']([^"'./][^"']*)["']/g;
  while ((m = nodeRegex.exec(devlog)) !== null) {
    const pkg = extractPkg(m[1]);
    if (pkg) missing.push(pkg);
  }

  return [...new Set(missing)];
}

// ─── Controller ───────────────────────────────────────────────────────────────

export async function provisionProject(
  request: FastifyRequest<{ Body: ProvisionBody }>,
  reply: FastifyReply
) {
  const { projectId } = request.body ?? {};

  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return reply
      .status(400)
      .send({ error: "projectId is required and must be a valid UUID" });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, sandboxId: true },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const blockRecords = await prisma.block.findMany({
      where: { projectId, deletedAt: null },
      include: {
        blockOutputs: {
          where: { outputCode: { not: "" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const blocks: BlockRow[] = blockRecords
      .map((block) => ({
        id: block.id,
        blockType: block.blockType,
        name: block.name,
        outputCode: block.blockOutputs[0]?.outputCode ?? null,
      }))
      .filter((block) => block.outputCode)
      .filter((block) => {
        if (isAnyTestFile(block.name ?? block.id, block.outputCode!, block.blockType)) {
          console.log(`[provision] FIX M+S — skipping test block "${block.name ?? block.id}" (blockType=${block.blockType})`);
          return false;
        }
        return true;
      });

    if (provisioningProjects.has(projectId)) {
      console.warn(`[provision] project=${projectId} already provisioning — rejecting duplicate`);
      return reply
        .status(409)
        .send({ error: "Provisioning already in progress for this project" });
    }
    provisioningProjects.add(projectId);

    try {
      console.log(
        `[provision] project=${projectId} blocks=${blocks.length} existingSandbox=${
          project.sandboxId ?? "none"
        }`
      );

      const scaffoldFiles = buildScaffoldFiles(blocks);
      console.log(`[provision] scaffold has ${Object.keys(scaffoldFiles).length} files`);

      let sandbox: any;

      if (project.sandboxId) {
        try {
          sandbox = await daytona.get(project.sandboxId);
          console.log(`[provision] reusing sandbox=${project.sandboxId} state=${sandbox.state}`);
          if (sandbox.state === "stopped" || sandbox.state === "archived") {
            await sandbox.start({ timeout: 60 });
          }
        } catch (e) {
          console.warn(`[provision] could not get sandbox ${project.sandboxId}, creating new:`, e);
          sandbox = null;
        }
      }

      if (!sandbox) {
        const createSandbox = async (isRetry = false): Promise<any> => {
          try {
            console.log(`[provision] creating new sandbox${isRetry ? " (retry after cleanup)" : ""}...`);
            const sb = await daytona.create(
              {
                image: "node:20",
                language: "javascript",
                envVars: {},
                autoStopInterval: 0,
                public: true,
              },
              {
                timeout: 180,
                onSnapshotCreateLogs: (chunk: string) => console.log("[daytona]", chunk),
              }
            );
            console.log(`[provision] created sandbox=${sb.id}`);
            await prisma.project.update({ where: { id: projectId }, data: { sandboxId: sb.id } });
            return sb;
          } catch (err: any) {
            const isCpuLimit =
              err?.constructor?.name === "DaytonaValidationError" ||
              (typeof err?.message === "string" && err.message.includes("CPU limit exceeded"));

            if (isCpuLimit && !isRetry) {
              console.warn("[provision] CPU limit hit — cleaning up stale sandbox...");
              try {
                const currentSandboxId = (
                  await prisma.project.findUnique({ where: { id: projectId }, select: { sandboxId: true } })
                )?.sandboxId;
                if (currentSandboxId) {
                  console.log(`[provision] deleting stale sandbox=${currentSandboxId}`);
                  await daytona.delete({ id: currentSandboxId } as any).catch(() => {});
                  await prisma.project.update({ where: { id: projectId }, data: { sandboxId: null } });
                }
              } catch (cleanupErr) {
                console.warn("[provision] cleanup error (non-fatal):", cleanupErr);
              }
              await sleep(3000);
              return createSandbox(true);
            }
            throw err;
          }
        };

        sandbox = await createSandbox();
        await sandbox.process.executeCommand("mkdir -p /workspace/src/blocks", "/", undefined, 10);
      }

      console.log(`[provision] killing any existing dev processes...`);
      await sandbox.process
        .executeCommand(
          "pkill -9 -f 'vite|npm run dev' 2>/dev/null || true; " +
            "pkill -9 -f 'node.*3000' 2>/dev/null || true; " +
            "pkill -9 -f 'serve' 2>/dev/null || true; " +
            "fuser -k 3000/tcp 2>/dev/null || true; " +
            "sleep 1; " +
            "rm -f /tmp/vite.pid /tmp/vite.log /tmp/npm-install.log; echo killed",
          "/", undefined, 15
        )
        .catch((e: any) => console.log("[provision] cleanup note:", e?.message || "OK"));

      console.log(`[provision] cleaning stale workspace files...`);
      await sandbox.process
        .executeCommand(
          "rm -rf /workspace/src /workspace/.vite-ssrManifest.json /workspace/dist 2>/dev/null || true; " +
            "mkdir -p /workspace/src/blocks && echo cleaned",
          "/", undefined, 10
        )
        .catch((e: any) => console.warn("[provision] clean warning:", e?.message));

      const subDirs = new Set<string>();
      for (const remotePath of Object.keys(scaffoldFiles)) {
        const dir = remotePath.replace(/\/[^/]+$/, "");
        if (dir && dir !== "/workspace") subDirs.add(dir);
      }
      if (subDirs.size > 0) {
        await sandbox.process
          .executeCommand(`mkdir -p ${[...subDirs].join(" ")} && echo dirs_created`, "/", undefined, 10)
          .catch((e: any) => console.warn("[provision] mkdir warning:", e?.message));
      }

      const fileEntries = Object.entries(scaffoldFiles);
      console.log(`[provision] uploading ${fileEntries.length} files...`);
      const BATCH_SIZE = 5;
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        const batch = fileEntries.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(([remotePath, content]) =>
            sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), remotePath)
          )
        );
      }
      console.log(`[provision] upload complete`);

      const isStaticHTML = !Object.keys(scaffoldFiles).some((k) => k.includes("package.json"));
      const isNextJS = Object.keys(scaffoldFiles).some((k) => k.includes("next.config"));

      if (isStaticHTML) {
        console.log(`[provision] static HTML project — starting npx serve...`);
        await sandbox.process
          .executeCommand(
            `cd /workspace && setsid nohup npx -y serve . -p 3000 > /tmp/vite.log 2>&1 </dev/null & echo $! > /tmp/vite.pid && sleep 2 && echo start_done`,
            "/", undefined, 30
          )
          .catch(() => {});
      } else {
        const newHash = hashPackageJson(scaffoldFiles["/workspace/package.json"] ?? "");
        const prevHashResult = await sandbox.process
          .executeCommand("cat /tmp/pkg-hash 2>/dev/null || echo ''", "/", undefined, 5)
          .catch(() => ({ result: "" }));
        const prevHash = (prevHashResult.result ?? "").trim();

        const nodeModulesCheck = await sandbox.process
          .executeCommand(
            "[ -e /workspace/node_modules/.bin/vite ] && echo 'EXISTS' || echo 'MISSING'",
            "/", undefined, 5
          )
          .catch(() => ({ result: "MISSING" }));
        const nodeModulesExist = nodeModulesCheck.result?.includes("EXISTS");

        if (prevHash === newHash && nodeModulesExist) {
          console.log(`[provision] package.json unchanged (hash=${newHash}), skipping npm install`);
        } else {
          console.log(`[provision] package.json changed (${prevHash || "new"} → ${newHash}), running npm install...`);
          const installResult = await sandbox.process
            .executeCommand(
              `cd /workspace && npm install --legacy-peer-deps --no-audit --no-fund > /tmp/npm-install.log 2>&1 && tail -5 /tmp/npm-install.log || tail -5 /tmp/npm-install.log`,
              "/", undefined, 120
            )
            .catch((e: any) => { throw new Error(`npm install failed: ${e?.message || "timeout"}`); });
          console.log(`[provision] npm install:`, installResult?.result?.slice(0, 300));

          const npmCheck = await sandbox.process
            .executeCommand(
              "[ -d /workspace/node_modules ] && echo 'INSTALLED' || echo 'FAILED'",
              "/", undefined, 10
            )
            .catch(() => ({ result: "FAILED" }));

          if (!npmCheck.result?.includes("INSTALLED")) {
            const npmLog = await sandbox.process
              .executeCommand("cat /tmp/npm-install.log 2>/dev/null | tail -30", "/", undefined, 10)
              .catch(() => ({ result: "(no log)" }));
            console.error("[provision] npm install failed. Log:\n", npmLog.result);
            return reply.status(500).send({ error: "npm install failed", detail: npmLog.result });
          }

          await sandbox.process
            .executeCommand(`echo '${newHash}' > /tmp/pkg-hash`, "/", undefined, 5)
            .catch(() => {});
        }

        const devServerLabel = isNextJS ? "Next.js" : "Vite";
        console.log(`[provision] starting ${devServerLabel} dev server...`);
        const devStartSleep = isNextJS ? 8 : 3;
        await sandbox.process
          .executeCommand(
            "printf '#!/bin/sh\\ncd /workspace\\nnpm run dev >> /tmp/vite.log 2>&1 &\\necho $! > /tmp/vite.pid\\n' > /tmp/start-vite.sh && chmod +x /tmp/start-vite.sh",
            "/", undefined, 10
          )
          .catch(() => {});
        await sandbox.process
          .executeCommand(`/tmp/start-vite.sh && sleep ${devStartSleep} && echo start_done`, "/", undefined, isNextJS ? 20 : 15)
          .catch(() => {});
      }

      let viteReady = false;
      for (let i = 0; i < 15; i++) {
        const psCheck = await sandbox.process
          .executeCommand(
            "ps -p $(cat /tmp/vite.pid 2>/dev/null) 2>/dev/null || echo 'PROCESS_DEAD'",
            "/", undefined, 5
          )
          .catch(() => ({ result: "PROCESS_DEAD" }));

        if (psCheck.result.includes("PROCESS_DEAD") && !isStaticHTML) {
          const viteLog = await sandbox.process
            .executeCommand("cat /tmp/vite.log 2>/dev/null || echo '(no vite log)'", "/", undefined, 8)
            .catch(() => ({ result: "" }));
          const logText = viteLog.result?.trim() ?? "";

          const missing = parseMissingModules(logText);
          if (missing.length > 0) {
            console.log(`[provision] self-heal: installing missing packages: ${missing.join(", ")}`);
            await sandbox.process
              .executeCommand(
                `cd /workspace && npm install ${missing.join(" ")} --legacy-peer-deps --no-audit --no-fund >> /tmp/npm-install.log 2>&1`,
                "/", undefined, 60
              )
              .catch((e: any) => console.error("[provision] self-heal install error:", e?.message));

            console.log("[provision] self-heal: restarting Vite...");
            await sandbox.process
              .executeCommand(
                "fuser -k 3000/tcp 2>/dev/null || true; " +
                  "rm -f /tmp/vite.log /tmp/vite.pid; " +
                  "/tmp/start-vite.sh && sleep 4 && echo restarted",
                "/", undefined, 20
              )
              .catch(() => {});
            continue;
          }

          const npmLog = await sandbox.process
            .executeCommand("cat /tmp/npm-install.log 2>/dev/null | tail -30 || echo ''", "/", undefined, 8)
            .catch(() => ({ result: "" }));
          const detail = [
            logText,
            npmLog.result?.trim() ? `\n--- npm install ---\n${npmLog.result.trim()}` : "",
          ].filter(Boolean).join("");
          console.error("[provision] vite process died at iteration", i, ". Log:\n", detail);
          return reply.status(500).send({ error: "Vite crashed on startup", detail });
        }

        const open = await isPortOpen(sandbox, 3000);
        console.log(`[vite-check ${i + 1}/15] port open: ${open}`);
        if (open) { viteReady = true; break; }
        await sleep(2000);
      }

      if (!viteReady) {
        const fullLog = await sandbox.process
          .executeCommand("cat /tmp/vite.log 2>/dev/null || echo '(no log)'", "/", undefined, 8)
          .catch(() => ({ result: "(error reading log)" }));
        const pmCheck = await sandbox.process
          .executeCommand(
            "ps aux | grep -E 'vite|npm|node' | grep -v grep || echo '(no processes)'",
            "/", undefined, 8
          )
          .catch(() => ({ result: "(error)" }));
        console.error("[provision] vite never became reachable. Log:\n", fullLog.result);
        console.error("[provision] running processes:\n", pmCheck.result);
        return reply.status(500).send({
          error: "Vite did not start within 30s",
          detail: fullLog.result,
        });
      }

      console.log("[provision] vite reachable");
      const previewLink = await sandbox.getPreviewLink(3000);
      console.log(`[provision] preview ready: ${previewLink.url}`);

      return reply.status(200).send({
        ok: true,
        sandboxId: sandbox.id,
        previewUrl: previewLink.url,
        previewToken: previewLink.token ?? null,
        blockCount: blocks.length,
      });
    } finally {
      provisioningProjects.delete(projectId);
    }
  } catch (err) {
    provisioningProjects.delete(projectId);
    console.error("[provision] unexpected error:", err);
    return reply.status(500).send({ error: "Failed to provision project" });
  }
}

// ─── Delete sandbox ───────────────────────────────────────────────────────────

export async function deleteSandbox(
  request: FastifyRequest<{ Body: { projectId: string } }>,
  reply: FastifyReply
) {
  const { projectId } = request.body ?? {};
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return reply.status(400).send({ error: "projectId is required and must be a valid UUID" });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sandboxId: true },
    });

    if (!project?.sandboxId) {
      return reply.send({ ok: true, message: "No sandbox to delete" });
    }

    await daytona.delete({ id: project.sandboxId } as any);
    await prisma.project.update({
      where: { id: projectId },
      data: { sandboxId: null },
    });

    return reply.send({ ok: true });
  } catch (err) {
    console.error("[deleteSandbox] error:", err);
    return reply.status(500).send({ error: "Failed to delete sandbox" });
  }
}

// ─── Debug scaffold ───────────────────────────────────────────────────────────

export async function debugScaffold(
  request: FastifyRequest<{ Body: ProvisionBody }>,
  reply: FastifyReply
) {
  const { projectId } = request.body ?? {};
  if (!projectId) return reply.status(400).send({ error: "projectId required" });

  const blockRecords = await prisma.block.findMany({
    where: { projectId, deletedAt: null },
    include: {
      blockOutputs: {
        where: { outputCode: { not: "" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const blocks: BlockRow[] = blockRecords
    .map((block) => ({
      id: block.id,
      blockType: block.blockType,
      name: block.name,
      outputCode: block.blockOutputs[0]?.outputCode ?? null,
    }))
    .filter((b) => b.outputCode)
    .filter((b) => {
      if (isAnyTestFile(b.name ?? b.id, b.outputCode!, b.blockType)) {
        console.log(`[debugScaffold] FIX M+S — skipping test block "${b.name ?? b.id}" (blockType=${b.blockType})`);
        return false;
      }
      return true;
    });

  const scaffoldFiles = buildScaffoldFiles(blocks);
  const detectedDeps  = extractDependencies(blocks.map((b) => b.outputCode ?? ""));

  return reply.send({
    projectType: detectProjectType(blocks),
    detectedDependencies: detectedDeps,
    blockCount: blocks.length,
    fileCount: Object.keys(scaffoldFiles).length,
    files: Object.keys(scaffoldFiles).map((k) => ({
      path: k,
      size: scaffoldFiles[k].length,
      preview: scaffoldFiles[k].slice(0, 200),
    })),
    rawBlockPreviews: blocks.map((b) => ({
      id: b.id,
      name: b.name,
      blockType: b.blockType,
      fileSections: splitFileSections(b.outputCode ?? "").map((s) => ({
        filename: s.filename,
        contentPreview: s.content.slice(0, 150),
        classifiedAs: classifyBlockContent(s.content),
      })),
      outputCodePreview: b.outputCode?.slice(0, 300),
    })),
  });
}