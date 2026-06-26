"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

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

export function AccountSection() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [telemetry, setTelemetry] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* General Section */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">General</h3>

        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Enable Telemetry</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                When toggled on, CraftaStudio collects anonymous usage data to help improve performance and features.
              </div>
            </div>
            <Toggle enabled={telemetry} onToggle={() => setTelemetry(!telemetry)} />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Marketing Emails</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Receive product updates, tips, and promotions from CraftaStudio via email.
              </div>
            </div>
            <Toggle enabled={marketingEmails} onToggle={() => setMarketingEmails(!marketingEmails)} />
          </div>
        </div>
      </section>

      {/* Account Section */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Account</h3>

        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Your Plan: CraftaStudio Pro</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                You can upgrade to the Ultra plan to receive the highest rate limits and priority support.
              </div>
            </div>
            <button className="px-5 py-2 shrink-0 bg-[var(--primary-accent)] hover:bg-[var(--primary-accent)]/90 text-white text-sm font-medium rounded-lg transition-colors">
              Upgrade
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">Email</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                {user?.primaryEmailAddress?.emailAddress || "user@example.com"}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="px-5 py-2 shrink-0 bg-[var(--surface)] hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors border border-[var(--border)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <div className="text-xs text-[var(--muted-foreground)] text-center pt-8 opacity-60">
        By using this app, you agree to its{" "}
        <a href="#" className="underline hover:text-[var(--foreground)] transition-colors">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
