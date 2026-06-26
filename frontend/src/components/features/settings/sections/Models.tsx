"use client";

import { useState } from "react";

const providers = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["GPT-4o", "GPT-4o Mini", "o1-preview"],
    color: "#10a37f",
    description: "Industry-standard models with strong reasoning and code generation.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["Claude Opus 4", "Claude Sonnet 4", "Claude Haiku"],
    color: "#d4a574",
    description: "Safety-focused models with excellent long-context and analysis capabilities.",
  },
  {
    id: "google",
    name: "Google",
    models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash", "Gemini Ultra"],
    color: "#4285f4",
    description: "Multimodal models with strong reasoning and integration with Google ecosystem.",
  },
];

export function ModelsSection() {
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("GPT-4o");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    google: "",
  });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Provider Selection */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">AI Provider</h3>
        <div className="grid grid-cols-3 gap-3">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
                setSelectedProvider(provider.id);
                setSelectedModel(provider.models[0]);
              }}
              className={`p-4 rounded-xl text-left transition-all border ${
                selectedProvider === provider.id
                  ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 ring-1 ring-[var(--primary-accent)]/20"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary-accent)]/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: provider.color }}
                />
                <span className="text-sm font-semibold text-[var(--foreground)]">{provider.name}</span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                {provider.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Model Selection */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">Default Model</h3>
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4">
          <div className="grid grid-cols-1 gap-2">
            {providers
              .find((p) => p.id === selectedProvider)
              ?.models.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`p-3 rounded-lg text-left text-sm transition-all border flex items-center justify-between ${
                    selectedModel === model
                      ? "border-[var(--primary-accent)] bg-[var(--primary-accent)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-accent)]/30"
                  }`}
                >
                  <span className="font-medium">{model}</span>
                  {selectedModel === model && (
                    <span className="text-[10px] font-bold text-[var(--primary-accent)] bg-[var(--primary-accent)]/10 px-2 py-0.5 rounded-full">
                      ACTIVE
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-wider uppercase mb-4">API Keys</h3>
        <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--surface)]">
          {providers.map((provider) => (
            <div key={provider.id} className="p-4">
              <div className="text-sm font-medium text-[var(--foreground)] mb-2">{provider.name} API Key</div>
              <div className="flex gap-2">
                <input
                  type={showKey[provider.id] ? "text" : "password"}
                  value={apiKeys[provider.id]}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                  placeholder={`sk-...`}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary-accent)] transition-colors placeholder:text-[var(--muted-foreground)]/50 font-mono"
                />
                <button
                  onClick={() => setShowKey((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                  className="px-3 py-2 rounded-lg text-xs bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showKey[provider.id] ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
