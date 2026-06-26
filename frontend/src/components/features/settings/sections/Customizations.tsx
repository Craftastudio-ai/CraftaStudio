"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const accentColors = [
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
];

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

export function CustomizationsSection() {
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [accentColor, setAccentColor] = useState("indigo");
  const [animations, setAnimations] = useState(true);

  const themes = [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Appearance</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">Theme</div>
            <div className="flex gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    theme === t.id
                      ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 text-[var(--primary-accent)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-accent)]/30 hover:text-[var(--foreground)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Accent Color */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Accent Color</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted-foreground)] mb-4">Choose the primary accent color for interactive elements.</div>
          <div className="flex gap-3 flex-wrap">
            {accentColors.map((color) => (
              <button
                key={color.id}
                onClick={() => setAccentColor(color.id)}
                className="flex flex-col items-center gap-1.5 group"
                title={color.label}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ring-2 ring-offset-2 ring-offset-[var(--surface)]",
                    accentColor === color.id ? "ring-[var(--primary-accent)]" : "ring-transparent"
                  )}
                  style={{
                    backgroundColor: color.hex,
                  }}
                >
                  {accentColor === color.id && <Check className="size-3.5 text-white stroke-[3]" />}
                </div>
                <span className="text-[10px] text-[var(--muted-foreground)]">{color.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Font Size */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Typography & Layout</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          <div className="p-4">
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">Font Size</div>
            <div className="flex gap-2">
              {(["sm", "md", "lg"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all border ${
                    fontSize === size
                      ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 text-[var(--primary-accent)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-accent)]/30"
                  }`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">UI Density</div>
            <div className="flex gap-2">
              {(["compact", "comfortable"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all border capitalize ${
                    density === d
                      ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 text-[var(--primary-accent)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-accent)]/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="pr-12">
              <div className="text-sm font-medium text-[var(--foreground)]">Animations</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">Enable smooth transitions and micro-animations throughout the UI.</div>
            </div>
            <Toggle enabled={animations} onToggle={() => setAnimations(!animations)} />
          </div>
        </div>
      </section>
    </div>
  );
}
