import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import archiver from 'archiver'
import prisma from '../lib/prisma'
import path from 'path'

/**
 * Cleans markdown code fences from a code string.
 * Handles: ```ts, ```typescript, ```jsx, ``` etc.
 */
function cleanMarkdown(code: string): string {
  let cleaned = code.trim()
  // Strip opening fence line (e.g. ```typescript\n)
  cleaned = cleaned.replace(/^```[\w]*\r?\n/, '')
  // Strip closing fence
  if (cleaned.endsWith('```')) {
    const lastNewline = cleaned.lastIndexOf('\n')
    if (lastNewline !== -1) cleaned = cleaned.substring(0, lastNewline)
    else cleaned = cleaned.substring(0, cleaned.length - 3)
  }
  return cleaned.trim()
}

/**
 * Guess a file extension from raw code content (used in Strategy 3).
 */
function guessFileExtension(code: string): string {
  if (/<[A-Z][a-zA-Z]*|React|useState|import React/.test(code)) return 'tsx'
  if (/interface |type [A-Z]|: string|: number|<T>/.test(code)) return 'ts'
  if (/def |import os|print\(|class .+:/.test(code)) return 'py'
  if (/CREATE TABLE|SELECT \*|INSERT INTO/i.test(code)) return 'sql'
  const trimmed = code.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  return 'ts'
}

/**
 * Robust multi-strategy file extractor.
 *
 * Strategy 1 — // FILE: headers (the required LLM format)
 * Strategy 2 — Markdown heading + filename (## path/to/file.ts or ### `file.ts`)
 * Strategy 3 — Single-file fallback: treat the whole block as one file,
 *              guessing the extension from the content.
 *
 * Strategies are tried in order and the first one that produces any files wins.
 */
function extractFilesFromOutput(outputCode: string): Map<string, string> {
  // ── Strategy 1: // FILE: or /* FILE: headers ─────────────────────────────
  {
    const files = new Map<string, string>()
    const fileHeaderRegex = /(?:\/\/\s*FILE:\s*|\/\*\s*FILE:\s*)(\S+)\s*\n/g
    let match
    let currentFile: string | null = null
    let currentFileStart = 0

    while ((match = fileHeaderRegex.exec(outputCode)) !== null) {
      if (currentFile) {
        const content = outputCode.substring(currentFileStart, match.index).trim()
        files.set(currentFile, cleanMarkdown(content))
      }
      currentFile = match[1].trim()
      currentFileStart = match.index + match[0].length
    }
    if (currentFile) {
      files.set(currentFile, cleanMarkdown(outputCode.substring(currentFileStart).trim()))
    }
    if (files.size > 0) return files
  }

  // ── Strategy 2: Markdown heading lines that look like file paths ─────────
  // Matches: ## src/app/page.tsx  or  ### `lib/utils.ts`  or  **file.ts**
  {
    const files = new Map<string, string>()
    const mdHeaderRegex = /^(?:#{1,4}\s+`?|#{1,4}\s+\*\*)?([A-Za-z0-9._/\\-]+\.[a-zA-Z]{1,6})`?\*?\*?\s*\n/gm
    let match
    let currentFile: string | null = null
    let currentFileStart = 0

    while ((match = mdHeaderRegex.exec(outputCode)) !== null) {
      if (currentFile) {
        const content = outputCode.substring(currentFileStart, match.index).trim()
        files.set(currentFile, cleanMarkdown(content))
      }
      currentFile = match[1].trim()
      currentFileStart = match.index + match[0].length
    }
    if (currentFile) {
      files.set(currentFile, cleanMarkdown(outputCode.substring(currentFileStart).trim()))
    }
    if (files.size > 0) return files
  }

  // ── Strategy 3: Single-file fallback ─────────────────────────────────────
  // If the LLM returned code with no file markers at all, save the whole
  // output as one file and infer the extension from the content.
  const cleaned = cleanMarkdown(outputCode)
  if (cleaned.length > 10) {
    const ext = guessFileExtension(cleaned)
    const files = new Map<string, string>()
    files.set(`src/generated/output.${ext}`, cleaned)
    return files
  }

  return new Map()
}

/**
 * Extracts ALL relative import paths from a file — both:
 *   - Static:  import X from './foo'
 *   - Dynamic: React.lazy(() => import('./pages/Foo'))
 */
function extractAllRelativeImports(content: string): string[] {
  const imports: string[] = []

  // Static imports: import ... from './path'
  const staticRegex = /from\s+['"](\.[^'"]+)['"]\s*[;,]?/g
  let match
  while ((match = staticRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  // Dynamic imports: import('./path') — used by React.lazy and code-splitting
  const dynamicRegex = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  return imports
}

/**
 * Validates relative imports (static + dynamic) against the virtual file system.
 * Returns an array of human-readable error strings for any imports that cannot
 * be resolved.
 */
function validateImports(
  filePath: string,
  content: string,
  allFiles: Set<string>
): string[] {
  const brokenImports: string[] = []
  const dir = path.dirname(filePath)
  const possibleExts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx']

  for (const importPath of extractAllRelativeImports(content)) {
    const resolved = path.posix.join(dir, importPath)
    const found = possibleExts.some(ext => allFiles.has(resolved + ext))
    if (!found) {
      brokenImports.push(`In ${filePath}: Cannot resolve import '${importPath}' (resolved to ${resolved})`)
    }
  }

  return brokenImports
}

/**
 * Generates smart stub files for every missing relative import across all
 * generated files. This ensures the downloaded project compiles cleanly
 * even when the LLM only generated a subset of the required files.
 *
 * Stubs are intentionally minimal but valid — they export the right shape so
 * TypeScript and Vite don't crash on startup.
 */
function generateMissingStubs(
  allFiles: Map<string, string>
): Map<string, string> {
  const stubs = new Map<string, string>()
  const filePathsSet = new Set(allFiles.keys())
  const possibleExts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx']

  for (const [filePath, content] of allFiles) {
    const dir = path.dirname(filePath)

    for (const importPath of extractAllRelativeImports(content)) {
      const resolved = path.posix.join(dir, importPath)
      const found = possibleExts.some(
        ext => filePathsSet.has(resolved + ext) || stubs.has(resolved + ext)
      )
      if (found) continue

      // Determine what kind of stub to generate from the import path
      const isComponent = /\/components?\/|[A-Z]/.test(importPath.split('/').pop() ?? '')
      const isContext  = /[Cc]ontext/.test(importPath)
      const isLayout   = /[Ll]ayout/.test(importPath)
      const isPage     = /\/pages?\//.test(importPath)
      const isHook     = /\/hooks?\/|^use[A-Z]/.test(importPath.split('/').pop() ?? '')

      const stubPath = resolved + '.tsx'
      let stubCode = ''

      if (isContext) {
        // Contexts need a provider + hook export
        const ctxName = (importPath.split('/').pop() ?? 'App').replace(/Context$/, '')
        stubCode = [
          `// AUTO-GENERATED STUB — replace with real implementation`,
          `import React, { createContext, useContext, useState } from 'react'`,
          ``,
          `interface ${ctxName}ContextType { [key: string]: any }`,
          ``,
          `const ${ctxName}Context = createContext<${ctxName}ContextType>({})`,
          ``,
          `export function use${ctxName}() { return useContext(${ctxName}Context) }`,
          ``,
          `export function ${ctxName}Provider({ children }: { children: React.ReactNode }) {`,
          `  const [state] = useState({})`,
          `  return <${ctxName}Context.Provider value={state}>{children}</${ctxName}Context.Provider>`,
          `}`,
          ``,
          `export default ${ctxName}Context`,
        ].join('\n')
      } else if (isLayout) {
        // Layouts need to render an Outlet for nested routes
        const layoutName = (importPath.split('/').pop() ?? 'Layout')
        stubCode = [
          `// AUTO-GENERATED STUB — replace with real implementation`,
          `import React from 'react'`,
          `import { Outlet } from 'react-router-dom'`,
          ``,
          `export default function ${layoutName}() {`,
          `  return (`,
          `    <div className="layout-stub">`,
          `      <Outlet />`,
          `    </div>`,
          `  )`,
          `}`,
        ].join('\n')
      } else if (isPage || isComponent) {
        // Pages & components render a placeholder UI
        const compName = (importPath.split('/').pop() ?? 'Component')
        stubCode = [
          `// AUTO-GENERATED STUB — replace with real implementation`,
          `import React from 'react'`,
          ``,
          `export default function ${compName}() {`,
          `  return (`,
          `    <div style={{ padding: '2rem', textAlign: 'center' }}>`,
          `      <h2>${compName}</h2>`,
          `      <p>This page was auto-stubbed. Replace with your real component.</p>`,
          `    </div>`,
          `  )`,
          `}`,
        ].join('\n')
      } else if (isHook) {
        // Hooks return an empty object so callers don't crash on destructure
        const hookName = (importPath.split('/').pop() ?? 'useHook')
        stubCode = [
          `// AUTO-GENERATED STUB — replace with real implementation`,
          `import { useState, useEffect } from 'react'`,
          ``,
          `export function ${hookName}() {`,
          `  const [data, setData] = useState<any>(null)`,
          `  useEffect(() => {}, [])`,
          `  return { data, setData }`,
          `}`,
          ``,
          `export default ${hookName}`,
        ].join('\n')
      } else {
        // Generic module / service / utility stub
        const modName = (importPath.split('/').pop() ?? 'module')
        stubCode = [
          `// AUTO-GENERATED STUB — replace with real implementation`,
          `// Module: ${modName}`,
          ``,
          `export default {}`,
        ].join('\n')
      }

      stubs.set(stubPath, stubCode)
      // Make the new stub visible to subsequent iterations
      filePathsSet.add(stubPath)
    }
  }

  return stubs
}

// ── Scaffold boilerplate injected into every zip so it runs locally ───────────
const SCAFFOLD_PACKAGE_JSON = JSON.stringify({
  name: "craftastudio-app",
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "tsc && vite build",
    preview: "vite preview",
  },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.383.0",
    "framer-motion": "^11.3.19",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "class-variance-authority": "^0.7.0",
    zod: "^3.23.8",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "date-fns": "^3.6.0",
    recharts: "^2.12.7",
    axios: "^1.7.7",
    zustand: "^5.0.0",
  },
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
}, null, 2)

const SCAFFOLD_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
});
`

const SCAFFOLD_TSCONFIG = JSON.stringify({
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
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src"],
}, null, 2)

const SCAFFOLD_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`

const SCAFFOLD_MAIN_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`

const SCAFFOLD_INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; }
`

const SCAFFOLD_TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`

const SCAFFOLD_POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`

const SCAFFOLD_UTILS_TS = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`

export async function exportRoutes(app: FastifyInstance) {

  // GET /api/export/:runId/zip
  app.get('/:runId/zip', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string }

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        blockOutputs: {
          where: { status: 'done' },
          include: { block: true }
        }
      }
    })

    if (!run) {
      return reply.status(404).send({ error: 'Run not found' })
    }

    const archive = archiver('zip', { zlib: { level: 9 } })
    reply.header('Content-Type', 'application/zip')
    reply.header('Content-Disposition', `attachment; filename="craftastudio-${runId.slice(0, 8)}.zip"`)

    // Pipe the archive to the fastify raw response stream
    archive.pipe(reply.raw)

    const allExtractedFiles = new Map<string, string>()
    const allEnvVars = new Set<{ key: string, description: string }>()

    // 1. Extract all files and env vars from block outputs
    for (const output of run.blockOutputs) {
      const blockJson = output.block.blockJson as any

      // Extract ENV vars
      const envVars = blockJson?.env_vars || []
      for (const ev of envVars) {
        allEnvVars.add({
          key: ev.name || ev.key || 'UNKNOWN_VAR',
          description: ev.description || ev.purpose || 'No description provided'
        })
      }

      // Extract files from the output code
      const parsedFiles = extractFilesFromOutput(output.outputCode)
      for (const [filepath, content] of parsedFiles) {
        allExtractedFiles.set(filepath, content)
      }
    }

    // 2. Auto-generate smart stubs for any missing relative imports
    const missingStubs = generateMissingStubs(allExtractedFiles)
    for (const [stubPath, stubCode] of missingStubs) {
      allExtractedFiles.set(stubPath, stubCode)
    }

    // 3. Detect what the project generated so we know what boilerplate to inject
    const hasPackageJson = allExtractedFiles.has('package.json')
    const hasViteConfig  = allExtractedFiles.has('vite.config.ts') || allExtractedFiles.has('vite.config.js')
    const hasTsConfig    = allExtractedFiles.has('tsconfig.json')
    const hasIndexHtml   = allExtractedFiles.has('index.html')
    const hasMainTsx     = allExtractedFiles.has('src/main.tsx') || allExtractedFiles.has('src/main.jsx')
    const hasIndexCss    = allExtractedFiles.has('src/index.css')
    const hasUtils       = allExtractedFiles.has('src/lib/utils.ts') || allExtractedFiles.has('src/lib/utils.js')
    const hasTailwindCfg = allExtractedFiles.has('tailwind.config.js') || allExtractedFiles.has('tailwind.config.ts')
    const hasPostcssCfg  = allExtractedFiles.has('postcss.config.js') || allExtractedFiles.has('postcss.config.ts')

    // Detect the App root — look for App.tsx / App.jsx
    const hasApp = allExtractedFiles.has('src/App.tsx') || allExtractedFiles.has('src/App.jsx')

    // If no src/App.tsx exists, find the first component and create a simple App wrapper
    if (!hasApp) {
      const firstComponent = [...allExtractedFiles.keys()].find(k =>
        (k.endsWith('.tsx') || k.endsWith('.jsx')) &&
        k.startsWith('src/') &&
        !k.includes('main.')
      )
      if (firstComponent) {
        const compName = path.basename(firstComponent).replace(/\.(tsx|jsx)$/, '')
        allExtractedFiles.set('src/App.tsx',
          `import React from 'react';\nimport ${compName} from './${firstComponent.replace('src/', '').replace(/\.(tsx|jsx)$/, '')}';\n\nexport default function App() {\n  return <${compName} />;\n}\n`
        )
      } else {
        allExtractedFiles.set('src/App.tsx',
          `import React from 'react';\n\nexport default function App() {\n  return (\n    <div className="min-h-screen flex items-center justify-center bg-gray-50">\n      <p className="text-gray-500">No components were generated.</p>\n    </div>\n  );\n}\n`
        )
      }
    }

    // Inject scaffold boilerplate for any missing config files
    if (!hasPackageJson) allExtractedFiles.set('package.json', SCAFFOLD_PACKAGE_JSON)
    if (!hasViteConfig)  allExtractedFiles.set('vite.config.ts', SCAFFOLD_VITE_CONFIG)
    if (!hasTsConfig)    allExtractedFiles.set('tsconfig.json', SCAFFOLD_TSCONFIG)
    if (!hasIndexHtml)   allExtractedFiles.set('index.html', SCAFFOLD_INDEX_HTML)
    if (!hasMainTsx)     allExtractedFiles.set('src/main.tsx', SCAFFOLD_MAIN_TSX)
    if (!hasIndexCss)    allExtractedFiles.set('src/index.css', SCAFFOLD_INDEX_CSS)
    if (!hasUtils)       allExtractedFiles.set('src/lib/utils.ts', SCAFFOLD_UTILS_TS)
    if (!hasTailwindCfg) allExtractedFiles.set('tailwind.config.js', SCAFFOLD_TAILWIND_CONFIG)
    if (!hasPostcssCfg)  allExtractedFiles.set('postcss.config.js', SCAFFOLD_POSTCSS_CONFIG)

    // 4. Validate imports (post-stub) and write all files into the archive
    const filePathsSet = new Set(allExtractedFiles.keys())
    const allBrokenImports: string[] = []

    for (const [filepath, content] of allExtractedFiles) {
      archive.append(content, { name: filepath })

      if (filepath.endsWith('.ts') || filepath.endsWith('.tsx') || filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
        const broken = validateImports(filepath, content, filePathsSet)
        allBrokenImports.push(...broken)
      }
    }

    // 5. Generate .env.example
    let envExampleContent = '# Environment Variables\n# Copy this file to .env and fill in your values\n\n'
    for (const ev of allEnvVars) {
      envExampleContent += `# ${ev.description}\n`
      envExampleContent += `${ev.key}="YOUR_VALUE_HERE"\n\n`
    }
    archive.append(envExampleContent, { name: '.env.example' })

    // 6. Generate README.md
    const fileList = [...allExtractedFiles.keys()].sort()
    let readme = `# CraftaStudio Generated App\n\n`
    readme += `Generated by [CraftaStudio](https://craftastudio.ai) — Vite + React 18 + TypeScript + Tailwind CSS.\n\n`

    readme += `## Quick Start\n\n`
    readme += `\`\`\`bash\n`
    readme += `npm install\n`
    readme += `npm run dev\n`
    readme += `\`\`\`\n\n`
    readme += `Open **http://localhost:3000** in your browser.\n\n`

    if (allEnvVars.size > 0) {
      readme += `## Environment Variables\n\n`
      readme += `Copy \`.env.example\` to \`.env\` and fill in your values:\n\n`
      readme += `\`\`\`bash\ncp .env.example .env\n\`\`\`\n\n`
      for (const ev of allEnvVars) {
        readme += `- \`${ev.key}\` — ${ev.description}\n`
      }
      readme += '\n'
    }

    readme += `## Tech Stack\n\n`
    readme += `- **Vite** + **React 18** + **TypeScript**\n`
    readme += `- **Tailwind CSS** (PostCSS)\n`
    readme += `- **lucide-react** (icons), **framer-motion** (animations)\n`
    readme += `- **react-router-dom** v6 (routing)\n`
    readme += `- **zod** + **react-hook-form** (forms & validation)\n`
    readme += `- **recharts** (charts), **axios** (HTTP), **zustand** (state)\n\n`

    readme += `## Project Structure\n\n`
    readme += `\`\`\`\n`
    for (const f of fileList.slice(0, 40)) readme += `${f}\n`
    if (fileList.length > 40) readme += `... and ${fileList.length - 40} more files\n`
    readme += `\`\`\`\n\n`

    if (missingStubs.size > 0) {
      readme += `## Auto-Generated Stubs\n\n`
      readme += `${missingStubs.size} stub file(s) were generated for missing imports. Replace them with real implementations:\n\n`
      for (const stubPath of missingStubs.keys()) {
        readme += `- \`${stubPath}\`\n`
      }
      readme += '\n'
    }

    if (allBrokenImports.length > 0) {
      readme += `## ⚠️ Unresolved Imports\n\n`
      readme += `These imports could not be automatically stubbed:\n\n`
      for (const issue of allBrokenImports) {
        readme += `- ${issue}\n`
      }
      readme += '\n'
    }

    archive.append(readme, { name: 'README.md' })

    // Finalize the ZIP stream
    await archive.finalize()
  })

  // GET /api/export/:runId/manifest
  app.get('/:runId/manifest', async (request, reply) => {
    const { runId } = request.params as { runId: string }
    return {
      message: 'Export manifest functionality is currently a placeholder',
      runId,
      blocks: []
    }
  })
}
