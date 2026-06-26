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

const notificationItems = [
  {
    id: "email",
    title: "Email Notifications",
    description: "Receive email updates for important events like build completions, errors, and team invites.",
  },
  {
    id: "agent-complete",
    title: "Agent Completion Alerts",
    description: "Get notified when the AI agent finishes generating architecture blocks or code scaffolds.",
  },
  {
    id: "error-alerts",
    title: "Error & Failure Alerts",
    description: "Immediately receive alerts when builds fail, deployments error, or runtime exceptions occur.",
  },
  {
    id: "weekly-digest",
    title: "Weekly Digest",
    description: "Receive a weekly summary of your project activity, credit usage, and AI interactions.",
  },
  {
    id: "collab",
    title: "Collaboration Updates",
    description: "Get notified when team members make changes to shared projects or leave comments.",
  },
];

export function NotificationsSection() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    email: true,
    "agent-complete": true,
    "error-alerts": true,
    "weekly-digest": false,
    collab: true,
  });

  const toggle = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Notification Preferences</h3>

        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          {notificationItems.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div className="pr-12">
                <div className="text-sm font-medium text-[var(--foreground)]">{item.title}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">{item.description}</div>
              </div>
              <Toggle enabled={enabled[item.id] ?? false} onToggle={() => toggle(item.id)} />
            </div>
          ))}
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Quiet Hours</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Do Not Disturb</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Pause all non-critical notifications. Error alerts will still be delivered.
              </div>
            </div>
            <Toggle enabled={false} onToggle={() => {}} />
          </div>
        </div>
      </section>
    </div>
  );
}
