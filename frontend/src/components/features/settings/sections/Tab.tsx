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
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${enabled ? "right-1" : "left-1"}`} />
    </button>
  );
}

export function TabSection() {
  const [defaultTab, setDefaultTab] = useState<"canvas" | "code" | "preview">("canvas");
  const [rememberTab, setRememberTab] = useState(true);
  const [splitView, setSplitView] = useState(false);
  const [showTabLabels, setShowTabLabels] = useState(true);

  const tabs = [
    { id: "canvas" as const, label: "Canvas", description: "Visual architecture builder" },
    { id: "code" as const, label: "Code", description: "Monaco code editor" },
    { id: "preview" as const, label: "Preview", description: "Live browser preview" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Default Tab */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Default Tab on Launch</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] mb-4">
            Choose which tab opens when you launch the editor. This is overridden when "Remember Last Tab" is enabled.
          </div>
          <div className="grid grid-cols-3 gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDefaultTab(tab.id)}
                className={`p-4 rounded-xl text-left transition-all border ${
                  defaultTab === tab.id
                    ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--primary-accent)]/30"
                }`}
              >
                <div className={`text-sm font-semibold mb-1 ${defaultTab === tab.id ? "text-[var(--primary-accent)]" : "text-[var(--foreground)]"}`}>
                  {tab.label}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)]">{tab.description}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Behavior */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Tab Behavior</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Remember Last Tab</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                When reopening the app, restore the last active tab instead of using the default.
              </div>
            </div>
            <Toggle enabled={rememberTab} onToggle={() => setRememberTab(!rememberTab)} />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Split View</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Enable side-by-side split view for Canvas + Code or Code + Preview simultaneously.
              </div>
            </div>
            <Toggle enabled={splitView} onToggle={() => setSplitView(!splitView)} />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Show Tab Labels</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Display text labels alongside icons in the top navigation tabs.
              </div>
            </div>
            <Toggle enabled={showTabLabels} onToggle={() => setShowTabLabels(!showTabLabels)} />
          </div>
        </div>
      </section>
    </div>
  );
}
