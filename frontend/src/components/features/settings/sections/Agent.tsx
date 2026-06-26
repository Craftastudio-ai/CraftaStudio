"use client";

import { useState } from "react";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-10 h-6 shrink-0 rounded-full relative transition-colors duration-200 cursor-pointer focus:outline-none ${
        enabled ? "bg-[var(--primary-accent)]" : "bg-[var(--muted)]"
      }`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${
          enabled ? "right-1" : "left-1"
        }`}
      />
    </button>
  );
}

export function AgentSection() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are CraftaStudio AI, an expert full-stack architect. Help users design, plan, and build applications by generating architecture blocks, code scaffolds, and deployment configs."
  );
  const [contextWindow, setContextWindow] = useState(64);

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* System Prompt */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">System Prompt</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none leading-relaxed"
            placeholder="Define the agent's behavior and personality..."
          />
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-foreground)]">{systemPrompt.length} characters</span>
            <button className="px-4 py-1.5 text-xs font-medium bg-[var(--primary-accent)] text-white rounded-lg hover:bg-[var(--primary-accent)]/90 transition-colors">
              Save
            </button>
          </div>
        </div>
      </section>

      {/* Memory & Context */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Memory & Context</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Enable Memory</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Allow the agent to remember context from previous conversations across sessions.
              </div>
            </div>
            <Toggle enabled={memoryEnabled} onToggle={() => setMemoryEnabled(!memoryEnabled)} />
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">Context Window</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Maximum tokens for context: {contextWindow}K</div>
              </div>
              <span className="text-sm font-mono text-[var(--primary-accent)] font-bold">{contextWindow}K</span>
            </div>
            <input
              type="range"
              min={8}
              max={128}
              step={8}
              value={contextWindow}
              onChange={(e) => setContextWindow(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--primary-accent)] bg-[var(--muted)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
              <span>8K</span>
              <span>128K</span>
            </div>
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Behavior</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Auto-Approve Actions</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Automatically approve file creation and modifications without confirmation prompts.
              </div>
            </div>
            <Toggle enabled={autoApprove} onToggle={() => setAutoApprove(!autoApprove)} />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Verbose Logging</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Show detailed reasoning and step-by-step logs for every agent action in the console.
              </div>
            </div>
            <Toggle enabled={verboseLogging} onToggle={() => setVerboseLogging(!verboseLogging)} />
          </div>
        </div>
      </section>
    </div>
  );
}
