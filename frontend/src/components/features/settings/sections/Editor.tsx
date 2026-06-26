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

const fontFamilies = [
  { id: "geist-mono", label: "Geist Mono", preview: "const x = 42;" },
  { id: "fira-code", label: "Fira Code", preview: "const x = 42;" },
  { id: "jetbrains", label: "JetBrains Mono", preview: "const x = 42;" },
  { id: "cascadia", label: "Cascadia Code", preview: "const x = 42;" },
];

export function EditorSection() {
  const [fontFamily, setFontFamily] = useState("geist-mono");
  const [tabSize, setTabSize] = useState<2 | 4>(2);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [bracketPairs, setBracketPairs] = useState(true);
  const [fontSize, setFontSize] = useState(13);

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Font Settings */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Font</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">Font Family</div>
            <div className="grid grid-cols-2 gap-2">
              {fontFamilies.map((font) => (
                <button
                  key={font.id}
                  onClick={() => setFontFamily(font.id)}
                  className={`p-3 rounded-lg text-left transition-all border ${
                    fontFamily === font.id
                      ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--primary-accent)]/30"
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 ${fontFamily === font.id ? "text-[var(--primary-accent)]" : "text-[var(--foreground)]"}`}>
                    {font.label}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{font.preview}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-[var(--foreground)]">Font Size</div>
              <span className="text-sm font-mono text-[var(--primary-accent)] font-bold">{fontSize}px</span>
            </div>
            <input
              type="range" min={11} max={20} step={1} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--primary-accent)] bg-[var(--muted)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
              <span>11px</span><span>20px</span>
            </div>
          </div>
        </div>
      </section>

      {/* Indentation */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Indentation</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <div className="text-sm font-medium text-[var(--foreground)] mb-3">Tab Size</div>
          <div className="flex gap-2">
            {([2, 4] as const).map((size) => (
              <button
                key={size}
                onClick={() => setTabSize(size)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all border ${
                  tabSize === size
                    ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 text-[var(--primary-accent)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-accent)]/30"
                }`}
              >
                {size} Spaces
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Editor Features</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          {[
            { label: "Word Wrap", desc: "Wrap long lines to fit within the editor viewport.", value: wordWrap, set: setWordWrap },
            { label: "Show Minimap", desc: "Display a miniaturized overview of the file on the right side.", value: minimap, set: setMinimap },
            { label: "Line Numbers", desc: "Show line numbers in the editor gutter.", value: lineNumbers, set: setLineNumbers },
            { label: "Auto Save", desc: "Automatically save changes after a short delay.", value: autoSave, set: setAutoSave },
            { label: "Bracket Pair Colorization", desc: "Highlight matching brackets with colors for better readability.", value: bracketPairs, set: setBracketPairs },
          ].map((item) => (
            <div key={item.label} className="p-4 flex items-center justify-between">
              <div className="pr-12">
                <div className="text-sm font-medium text-[var(--foreground)]">{item.label}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">{item.desc}</div>
              </div>
              <Toggle enabled={item.value} onToggle={() => item.set(!item.value)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
