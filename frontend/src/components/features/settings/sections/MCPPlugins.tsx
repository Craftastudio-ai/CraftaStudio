"use client";

import { useState } from "react";
import { Puzzle, Plus, ExternalLink } from "lucide-react";

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  category: string;
}

const defaultPlugins: Plugin[] = [
  {
    id: "mcp-github",
    name: "GitHub MCP",
    description: "Fetch repos, create issues, manage PRs and branches directly through the AI agent.",
    version: "2.1.0",
    author: "CraftaStudio",
    enabled: true,
    category: "Version Control",
  },
  {
    id: "mcp-figma",
    name: "Figma MCP",
    description: "Import Figma designs and automatically generate React component scaffolds.",
    version: "1.4.2",
    author: "CraftaStudio",
    enabled: true,
    category: "Design",
  },
  {
    id: "mcp-vercel",
    name: "Vercel MCP",
    description: "Deploy projects, manage environments, and inspect build logs from within the canvas.",
    version: "1.0.5",
    author: "CraftaStudio",
    enabled: false,
    category: "Deployment",
  },
  {
    id: "mcp-supabase",
    name: "Supabase MCP",
    description: "Query your Supabase database, manage tables, and generate migration scripts with AI.",
    version: "0.9.1",
    author: "Community",
    enabled: false,
    category: "Database",
  },
  {
    id: "mcp-stripe",
    name: "Stripe MCP",
    description: "Inspect payments, manage products, and scaffold billing integrations automatically.",
    version: "1.2.0",
    author: "Community",
    enabled: true,
    category: "Payments",
  },
];

const categoryColors: Record<string, string> = {
  "Version Control": "bg-blue-500/10 text-blue-400",
  "Design": "bg-purple-500/10 text-purple-400",
  "Deployment": "bg-emerald-500/10 text-emerald-400",
  "Database": "bg-amber-500/10 text-amber-400",
  "Payments": "bg-rose-500/10 text-rose-400",
};

export function MCPPluginsSection() {
  const [plugins, setPlugins] = useState<Plugin[]>(defaultPlugins);

  const togglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Summary Bar */}
      <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-[var(--primary-accent)]/10 flex items-center justify-center">
            <Puzzle className="size-4 text-[var(--primary-accent)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">{plugins.length} Plugins Installed</div>
            <div className="text-xs text-[var(--muted-foreground)]">{enabledCount} active</div>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary-accent)] text-white hover:bg-[var(--primary-accent)]/90 transition-colors">
          <Plus className="size-3.5" />
          Add Plugin
        </button>
      </div>

      {/* Plugin List */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Installed Plugins</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{plugin.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColors[plugin.category] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                    {plugin.category}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                    v{plugin.version}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{plugin.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-[var(--muted-foreground)]">by {plugin.author}</span>
                  <button className="flex items-center gap-1 text-[10px] text-[var(--primary-accent)] hover:underline transition-colors">
                    <ExternalLink className="size-2.5" />
                    Docs
                  </button>
                </div>
              </div>
              <button
                onClick={() => togglePlugin(plugin.id)}
                className={`mt-0.5 w-10 h-6 shrink-0 rounded-full relative transition-colors duration-200 cursor-pointer focus:outline-none ${
                  plugin.enabled ? "bg-[var(--primary-accent)]" : "bg-[var(--muted)]"
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${plugin.enabled ? "right-1" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
