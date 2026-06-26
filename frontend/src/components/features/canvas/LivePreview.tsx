import { useState, useEffect } from "react";
import { SandpackProvider, SandpackCodeEditor, SandpackPreview } from "@codesandbox/sandpack-react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Server, Database, Loader2, Play } from "lucide-react";

interface LivePreviewProps {
  code: string;
  blockType: string;
}

function parseEndpoints(code: string) {
  const endpoints: { method: string; route: string; description: string }[] = [];
  const regex = /\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    endpoints.push({
      method: match[1].toUpperCase(),
      route: match[2],
      description: `API Endpoint for ${match[2]}`,
    });
  }
  return endpoints;
}

function parseSchema(code: string) {
  const models: { name: string; description: string }[] = [];
  const regex = /model\s+(\w+)\s+{/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    models.push({
      name: match[1],
      description: `Database Model: ${match[1]}`,
    });
  }
  return models;
}

function getBasePackageName(importPath: string): string | null {
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return null;
  }
  const parts = importPath.split("/");
  if (importPath.startsWith("@")) {
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0];
  }
  return parts[0];
}

function extractDependenciesFromFiles(files: Record<string, { code: string }>): Record<string, string> {
  const deps: Record<string, string> = {
    "lucide-react": "latest",
    "framer-motion": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  };

  const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;

  const IGNORED_PACKAGES = new Set([
    "react",
    "react-dom",
    "next",
    "@clerk/nextjs",
  ]);

  for (const fileKey in files) {
    const code = files[fileKey].code;
    
    // Reset regex index
    importRegex.lastIndex = 0;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = getBasePackageName(match[1]);
      if (pkg && !IGNORED_PACKAGES.has(pkg)) {
        deps[pkg] = "latest";
      }
    }

    sideEffectRegex.lastIndex = 0;
    while ((match = sideEffectRegex.exec(code)) !== null) {
      const pkg = getBasePackageName(match[1]);
      if (pkg && !IGNORED_PACKAGES.has(pkg)) {
        deps[pkg] = "latest";
      }
    }
  }

  return deps;
}


function parseFilesFromCode(code: string) {
  const fileMarkerRegex = /\/\/\s*FILE:\s*(.+?)(?:\r?\n)([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
  const files: Record<string, { code: string, active: boolean }> = {};

  let match;
  let hasMatches = false;
  
  while ((match = fileMarkerRegex.exec(code)) !== null) {
    hasMatches = true;
    let name = match[1].trim();
    if (!name.startsWith('/')) name = '/' + name;
    files[name] = { code: match[2].trim(), active: false };
  }

  // If no FILE markers exist, return the whole code as /App.tsx
  if (!hasMatches) {
    const isTypeScript = code.includes("interface ") || code.includes("type ") || code.includes(": React.FC");
    const filename = isTypeScript ? "/App.tsx" : "/App.js";
    return {
      [filename]: { code: code, active: true }
    };
  }

  // Set the active file correctly
  // The file named App.tsx or index.tsx should be set as active: true
  // All others set to active: false
  const fileKeys = Object.keys(files);
  let activeFile = fileKeys.find(k => k.toLowerCase().endsWith('app.tsx') || k.toLowerCase().endsWith('app.js') || k.toLowerCase().endsWith('index.tsx') || k.toLowerCase().endsWith('index.js'));
  
  if (activeFile) {
    files[activeFile].active = true;
  } else if (fileKeys.length > 0) {
    activeFile = fileKeys[0];
    files[activeFile].active = true;
  }

  return files;
}

function stripFences(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Match ```lang\n...\n``` at the start of the string (most common LLM output)
  const atStart = trimmed.match(/^`{3,}[\w-]*\r?\n([\s\S]*?)\r?\n`{3,}(\s*$|\r?\n)/);
  if (atStart) return atStart[1].trim();
  // Match fences anywhere (preamble text before the block)
  const anywhere = trimmed.match(/`{3,}[\w-]*\r?\n([\s\S]*?)\r?\n`{3,}/);
  if (anywhere) return anywhere[1].trim();
  // Last resort: old regex
  const old = trimmed.match(/`{3,}[\w]*\r?\n([\s\S]*?)`{3,}\s*$/);
  if (old) return old[1].trim();
  return trimmed;
}

function isJsonWrappedCode(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

export function LivePreview({ code, blockType }: LivePreviewProps) {
  const cleanCode = stripFences(code);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 2000);
    return () => clearTimeout(timer);
  }, [code]);

  const typeLower = (blockType || "").toLowerCase();
  const isFrontend = typeLower.includes("ui") || typeLower.includes("frontend");
  const isBackend = typeLower.includes("api") || typeLower.includes("backend") || typeLower.includes("server") || typeLower.includes("service");
  const isDatabase = typeLower.includes("database") || typeLower.includes("db") || typeLower.includes("data");
  const hasJsx = cleanCode.includes("/>") || cleanCode.includes("</");
  const isTypeScript = cleanCode.includes("interface ") || cleanCode.includes("type ") || cleanCode.includes(": React.FC");

  // If code is still JSON after fence-stripping, avoid crashing Sandpack — show as syntax-highlighted text
  const isJsonOutput = isJsonWrappedCode(cleanCode);

  if (isInitializing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d12] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary-accent)] mb-4" />
        <p className="text-sm font-mono text-white/60 animate-pulse">Initializing Sandpack environment...</p>
      </div>
    );
  }

  // Handle Backend Blocks
  if (isBackend) {
    const endpoints = parseEndpoints(cleanCode);
    return (
      <div className="w-full h-full flex p-4 gap-4 bg-[#0d0d12] overflow-hidden">
        <div className="flex-1 flex flex-col border border-white/10 rounded-xl overflow-hidden bg-[#13131a]">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">API Endpoints Detected</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {endpoints.length > 0 ? (
              endpoints.map((ep, i) => (
                <div key={i} className="flex flex-col p-3 rounded-lg border border-white/5 bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      ep.method === "GET" ? "bg-green-500/20 text-green-400" :
                      ep.method === "POST" ? "bg-blue-500/20 text-blue-400" :
                      ep.method === "DELETE" ? "bg-red-500/20 text-red-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {ep.method}
                    </span>
                    <span className="text-sm font-mono text-white/90">{ep.route}</span>
                  </div>
                  <p className="mt-2 text-xs text-white/50">{ep.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40">No route definitions automatically detected in this block.</p>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden border border-white/10 rounded-xl">
          <SyntaxHighlighter language="typescript" style={atomOneDark} customStyle={{ margin: 0, height: "100%", background: "#0d0d12", fontSize: "12px" }}>
            {cleanCode}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  // Handle Database Blocks
  if (isDatabase) {
    const models = parseSchema(cleanCode);
    return (
      <div className="w-full h-full flex p-4 gap-4 bg-[#0d0d12] overflow-hidden">
        <div className="flex-1 flex flex-col border border-white/10 rounded-xl overflow-hidden bg-[#13131a]">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-bold text-white">Database Schema Models</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {models.length > 0 ? (
              models.map((m, i) => (
                <div key={i} className="flex flex-col p-3 rounded-lg border border-white/5 bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-green-400 font-bold">{m.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">{m.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/40">No schema models automatically detected.</p>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden border border-white/10 rounded-xl">
          <SyntaxHighlighter language="prisma" style={atomOneDark} customStyle={{ margin: 0, height: "100%", background: "#0d0d12", fontSize: "12px" }}>
            {cleanCode}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  // If code is JSON (LLM returned JSON instead of code), show as text — never send to Sandpack
  if (isJsonOutput) {
    return (
      <div className="w-full h-full bg-[#0d0d12] p-4 overflow-hidden">
        <div className="w-full h-full border border-white/10 rounded-xl overflow-hidden">
          <SyntaxHighlighter language="json" style={atomOneDark} customStyle={{ margin: 0, height: "100%", background: "#0d0d12", fontSize: "12px" }}>
            {cleanCode}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  // If no JSX at all, show syntax highlighter instead of trying to render it
  if (!hasJsx && !isFrontend) {
    return (
      <div className="w-full h-full bg-[#0d0d12] p-4 overflow-hidden">
        <div className="w-full h-full border border-white/10 rounded-xl overflow-hidden">
          <SyntaxHighlighter language={isTypeScript ? "typescript" : "javascript"} style={atomOneDark} customStyle={{ margin: 0, height: "100%", background: "#0d0d12", fontSize: "12px" }}>
            {cleanCode}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  // Frontend / UI blocks using Sandpack
  const parsedFiles = parseFilesFromCode(cleanCode);
  const activeFile = Object.keys(parsedFiles).find(k => parsedFiles[k].active) || "/App.tsx";
  
  // Auto-detect template based on active file
  const isTypeScriptFile = activeFile.endsWith(".ts") || activeFile.endsWith(".tsx") || isTypeScript;
  const template = isTypeScriptFile ? "react-ts" : "react";

  // Create a dynamic App.tsx to safely render the active file regardless of whether it uses default or named exports
  const hasAppEntry = parsedFiles["/App.tsx"] || parsedFiles["/App.js"] || parsedFiles["/index.tsx"] || parsedFiles["/index.js"];
  const dynamicAppEntry = !hasAppEntry ? {
    "/App.tsx": {
      code: `import React from "react";
import * as Module from ".${activeFile.replace(/\.(tsx|ts|jsx|js)$/, "")}";

export default function App() {
  // Try default export first
  let Component = Module.default;
  
  // If no default, find the first exported function
  if (!Component) {
    const exports = Object.values(Module);
    Component = exports.find(exp => typeof exp === "function" || typeof exp === "object");
  }

  if (!Component) {
    return (
      <div className="p-6 text-red-400 font-mono text-sm bg-red-500/10 rounded-lg border border-red-500/20 m-4">
        Error: Could not find a valid React component exported from <strong>${activeFile}</strong>.
        <br/><br/>
        Ensure you are exporting a component (e.g., \`export default function MyComponent() { ... }\`)
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-transparent">
      <Component />
    </div>
  );
}`
    }
  } : {};

  // Provide mocks for Next.js and Clerk inside Sandpack filesystem
  const nextLinkMock = `import React from 'react';
export default function Link({ href, children, ...props }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); console.log('Navigate to:', href); }} {...props}>
      {children}
    </a>
  );
}`;

  const nextNavigationMock = `import { useState } from 'react';
export const useRouter = () => ({
  push: (url) => console.log('router.push to:', url),
  replace: (url) => console.log('router.replace to:', url),
  prefetch: () => {},
  back: () => console.log('router.back'),
  forward: () => console.log('router.forward'),
  refresh: () => {},
});
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();`;

  const nextImageMock = `import React from 'react';
export default function Image({ src, alt, width, height, ...props }) {
  const imageSrc = typeof src === 'object' ? src.src || '' : src;
  return <img src={imageSrc} alt={alt} width={width} height={height} {...props} />;
}`;

  const clerkMock = `import React, { createContext, useContext } from 'react';

const ClerkContext = createContext({
  user: {
    id: 'mock_user_123',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
    primaryEmailAddress: { emailAddress: 'john.doe@example.com' },
  },
  isSignedIn: true,
});

export const ClerkProvider = ({ children }) => {
  return (
    <ClerkContext.Provider value={{
      user: {
        id: 'mock_user_123',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
        primaryEmailAddress: { emailAddress: 'john.doe@example.com' },
      },
      isSignedIn: true,
    }}>
      {children}
    </ClerkContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(ClerkContext);
  return {
    isSignedIn: context.isSignedIn,
    user: context.user,
    isLoaded: true,
  };
};

export const useAuth = () => {
  return {
    isSignedIn: true,
    userId: 'mock_user_123',
    isLoaded: true,
    signOut: () => console.log('Clerk signOut called'),
  };
};

export const SignedIn = ({ children }) => {
  const { isSignedIn } = useUser();
  return isSignedIn ? <>{children}</> : null;
};

export const SignedOut = ({ children }) => {
  const { isSignedIn } = useUser();
  return !isSignedIn ? <>{children}</> : null;
};

export const SignInButton = ({ children, mode, ...props }) => {
  return <button {...props}>{children || 'Sign In'}</button>;
};

export const SignUpButton = ({ children, mode, ...props }) => {
  return <button {...props}>{children || 'Sign Up'}</button>;
};

export const UserButton = () => {
  const { user } = useUser();
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
      <img
        src={user?.imageUrl}
        alt="User Profile"
        style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #ccc' }}
      />
    </div>
  );
};

export const UserProfile = () => {
  return <div>Mock User Profile View</div>;
};

export const ClerkLoaded = ({ children }) => <>{children}</>;
export const ClerkLoading = ({ children }) => null;
`;

  // Provide basic tailwind support via public/index.html & custom mocks
  const customFiles: Record<string, any> = {
    ...parsedFiles,
    ...dynamicAppEntry,
    "/node_modules/next/link.js": { code: nextLinkMock },
    "/node_modules/next/navigation.js": { code: nextNavigationMock },
    "/node_modules/next/image.js": { code: nextImageMock },
    "/node_modules/@clerk/nextjs/index.js": { code: clerkMock },
    "/public/index.html": {
      code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>Live Preview</title>
  </head>
  <body class="bg-white">
    <div id="root"></div>
  </body>
</html>`
    }
  };

  return (
    <div className="w-full h-full bg-[#08080f] overflow-hidden sandpack-container relative flex p-2">
      <div className="w-full h-full border border-white/5 bg-[#111118] rounded-xl overflow-hidden shadow-[0_0_40px_rgba(124,111,238,0.05)] relative flex flex-col">
        {/* Glow effect matching Lovable premium feel */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50 z-20"></div>
        <SandpackProvider 
          template={template} 
          theme="dark" 
          files={customFiles}
          customSetup={{
            dependencies: extractDependenciesFromFiles(parsedFiles)
          }}
          options={{
            activeFile: activeFile,
            classes: {
              "sp-wrapper": "h-full w-full flex flex-col",
              "sp-layout": "h-full w-full border-none rounded-none bg-transparent flex flex-col",
              "sp-pane": "bg-[#111118] flex-1 overflow-hidden",
              "sp-editor": "h-full border-r border-white/5 flex-1",
              "sp-preview": "h-full bg-white relative flex-1 overflow-hidden"
            }
          }}
        >
          <div className="flex w-full h-full flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <SandpackCodeEditor showLineNumbers showTabs={false} style={{ height: "100%", width: "100%" }} />
            </div>
            <div className="flex-1 bg-[#ffffff] relative h-full overflow-hidden">
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1.5 bg-[#111118]/80 backdrop-blur-md rounded-full flex items-center gap-1.5 text-[11px] font-semibold text-[#f0effe] shadow-sm border border-white/10 transition-all hover:scale-105">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live
              </div>
              <SandpackPreview showNavigator={false} showOpenInCodeSandbox={false} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </SandpackProvider>
      </div>
    </div>
  );
}
