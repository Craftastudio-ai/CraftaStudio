"use client";

import {
  RotateCw, ChevronLeft, ChevronRight,
  ShieldCheck, Monitor, Smartphone, Tablet, Loader2,
  ZapIcon, Layers, ExternalLink,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, Component } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Error boundary
// ─────────────────────────────────────────────────────────────────────────────

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#08080f] text-center p-8">
          <div className="w-full max-w-md p-8 rounded-2xl bg-[#111118] border border-red-500/10 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />
            <div className="size-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
              <ZapIcon size={24} className="text-red-400 relative z-10" />
            </div>
            <h3 className="text-lg text-[#f0effe] font-semibold tracking-tight mb-2">Preview Crashed</h3>
            <p className="text-[13px] text-[#9896b8] leading-relaxed mb-6">
              The sandboxed component threw an error. Try refreshing the preview.
            </p>
            <button
              onClick={() => this.setState({ crashed: false })}
              className="px-5 py-2 rounded-xl bg-red-500/10 text-red-400 text-[13px] font-semibold hover:bg-red-500/20 transition-all border border-red-500/20 active:scale-95"
            >
              Restart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewTabProps {
  projectId?: string | null;
  runId?: string | null;
  generationVersion?: number;
}

interface SandboxState {
  status: "idle" | "provisioning" | "ready" | "error";
  // FIX-1: previewUrl is stored WITHOUT the token appended.
  // Token is kept separately and passed to the proxy via a dedicated param.
  // This prevents the token being doubled (once in url param, once as &token=).
  previewUrl: string | null;
  previewToken: string | null;
  sandboxId: string | null;
  blockCount: number;
  error: string | null;
  detail: string | null;
}

const INITIAL_SANDBOX: SandboxState = {
  status: "idle",
  previewUrl: null,
  previewToken: null,
  sandboxId: null,
  blockCount: 0,
  error: null,
  detail: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORT_WIDTHS = {
  desktop: "w-full",
  tablet:  "w-[768px]",
  mobile:  "w-[390px]",
};

const PROVISION_MESSAGES = [
  "Creating sandbox workspace…",
  "Installing dependencies…",
  "Starting Vite dev server…",
  "Waiting for port 3000…",
  "Finalising build…",
  "Almost ready…",
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PreviewTab({ projectId, runId, generationVersion }: PreviewTabProps) {
  const { getToken } = useAuth();
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [sandbox, setSandbox] = useState<SandboxState>(INITIAL_SANDBOX);
  const [msgIdx, setMsgIdx] = useState(0);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Refs — stable across renders, never trigger re-renders ───────────────
  const provisionLock    = useRef<boolean>(false);
  const pendingForceRef  = useRef<boolean>(false);
  const lastProvisionKey = useRef<string | null>(null);
  // Ref copy of sandbox.status so provision() can read it without being a dep
  // (avoids the infinite-loop bug where status change recreates the callback).
  const sandboxStatusRef    = useRef<SandboxState["status"]>("idle");
  const wsRef               = useRef<WebSocket | null>(null);
  const msgTimerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const reprovisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref so the finally block can call the latest provision()
  const provisionRef = useRef<(force?: boolean) => Promise<void>>(() => Promise.resolve());

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  // Keep sandboxStatusRef in sync
  useEffect(() => {
    sandboxStatusRef.current = sandbox.status;
  }, [sandbox.status]);

  // ── Provision ─────────────────────────────────────────────────────────────
  // sandbox.status intentionally NOT in deps — reading via sandboxStatusRef
  // avoids recreating this callback on every status change (infinite loop fix).

  const provision = useCallback(async (force = false) => {
    if (!projectId) return;

    const currentKey = `${projectId}:${runId ?? ""}`;
    if (!force && lastProvisionKey.current === currentKey && sandboxStatusRef.current !== "error") {
      return;
    }
    if (provisionLock.current) {
      // Queue force reprovision — runs after current provision finishes
      if (force) pendingForceRef.current = true;
      return;
    }
    provisionLock.current = true;
    pendingForceRef.current = false;

    setSandbox(prev => ({ ...prev, status: "provisioning", error: null }));
    setMsgIdx(0);
    setIframeBlocked(false);
    lastProvisionKey.current = currentKey;

    if (msgTimerRef.current) clearInterval(msgTimerRef.current);
    msgTimerRef.current = setInterval(() => {
      setMsgIdx(i => Math.min(i + 1, PROVISION_MESSAGES.length - 1));
    }, 20000); // spread across ~2min npm install window

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/sandbox/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          JSON.stringify({ message: data.error || `HTTP ${res.status} occurred while provisioning.`, detail: data.detail ?? null })
        );
      }

      // FIX-1: Store previewUrl WITHOUT appending the token.
      // The iframe builds the proxy URL separately, passing previewToken
      // as a dedicated query param — this prevents the token appearing twice.
      setSandbox({
        status: "ready",
        previewUrl: data.previewUrl,          // clean URL, no token appended
        previewToken: data.previewToken ?? null,
        sandboxId: data.sandboxId,
        blockCount: data.blockCount ?? 0,
        error: null,
        detail: null,
      });
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : String(err);
      let detail: string | null = null;
      try {
        const parsed = JSON.parse(errorMsg);
        errorMsg = parsed.message ?? errorMsg;
        detail = parsed.detail ?? null;
      } catch { /* plain string error */ }
      setSandbox(prev => ({ ...prev, status: "error", error: errorMsg, detail }));
    } finally {
      provisionLock.current = false;
      if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null; }
      // If a force reprovision was requested while we were locked, run it now
      if (pendingForceRef.current) {
        pendingForceRef.current = false;
        setTimeout(() => provisionRef.current(true), 0);
      }
    }
  }, [projectId, runId, getToken, apiUrl]);

  // Keep provisionRef pointing at the latest provision callback
  useEffect(() => { provisionRef.current = provision; }, [provision]);

  // ── Auto-provision when projectId / runId changes ─────────────────────────

  useEffect(() => {
    if (!projectId) return;
    provision(false);
  }, [projectId, runId, provision]);

  // ── Re-provision when code generation completes ────────────────────────────
  // WebSocket re-provision is unreliable in production (serverless drops WS
  // connections). generationVersion is incremented by the dashboard whenever
  // onGenerationComplete fires, giving us a reliable signal to pick up new code.
  const generationVersionRef = useRef(generationVersion ?? 0);
  useEffect(() => {
    const prev = generationVersionRef.current;
    generationVersionRef.current = generationVersion ?? 0;
    if ((generationVersion ?? 0) > prev && projectId) {
      provision(true);
    }
  }, [generationVersion, projectId, provision]);

  // ── WebSocket: re-provision when blocks finish, with reconnect ────────────
  // FIX-2: Added reconnect logic (matching canvas-tab.tsx pattern).
  //        Without this, if WS drops mid-generation the auto-reprovision
  //        on block completion silently stops working.
  // FIX-3: Debounced reprovision — fires once 2s after the LAST block:done,
  //        preventing N concurrent provision calls for N parallel blocks.

  useEffect(() => {
    if (!projectId) return;

    const wsBase = apiUrl.replace(/^http/, "ws");
    const wsUrl  = `${wsBase}/api/ws/${projectId}`;
    let shouldReconnect = true;
    let ws: WebSocket;

    const connect = () => {
      if (!shouldReconnect) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === "block:status_update" && msg.status === "done") {
            // Debounce: reset on every block:done, fire once after the last one
            if (reprovisionTimerRef.current) clearTimeout(reprovisionTimerRef.current);
            reprovisionTimerRef.current = setTimeout(() => {
              reprovisionTimerRef.current = null;
              provision(true);
            }, 2000);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => console.warn("[PreviewTab WS] Connection error");

      // FIX-2: Reconnect on close (was missing — canvas-tab already does this)
      ws.onclose = () => {
        if (shouldReconnect) setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reprovisionTimerRef.current) { clearTimeout(reprovisionTimerRef.current); reprovisionTimerRef.current = null; }
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [projectId, apiUrl, provision]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (msgTimerRef.current) clearInterval(msgTimerRef.current);
      if (reprovisionTimerRef.current) clearTimeout(reprovisionTimerRef.current);
    };
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isProvisioning = sandbox.status === "provisioning";
  const isReady        = sandbox.status === "ready" && !!sandbox.previewUrl;
  const isError        = sandbox.status === "error";
  const isIdle         = sandbox.status === "idle";

  // FIX-1: Build the proxy URL here, in one place, with token passed cleanly
  // as a separate param — not embedded in the url param.
  // This means: preview-proxy receives ?url=<clean>&token=<token>
  // and appends token to targetUrl ONCE. No duplication.
  const proxyIframeSrc = sandbox.previewUrl
    ? `${apiUrl}/api/sandbox/preview-proxy?url=${encodeURIComponent(sandbox.previewUrl)}${
        sandbox.previewToken ? `&token=${encodeURIComponent(sandbox.previewToken)}` : ""
      }`
    : null;

  // Address bar shows the clean URL (no token, no proxy wrapper)
  const addressBarUrl = sandbox.previewUrl ?? `craftastudio://preview/${projectId ?? "sandbox"}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col bg-[#08080f] pt-2 px-2 pb-2 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(rgba(124,111,238,0.05) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#7c6fee]/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="flex-1 flex flex-col bg-[#111120]/80 backdrop-blur-2xl border border-[#2a2a48] rounded-[20px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative z-10">

        {/* ── Browser chrome ────────────────────────────────────────────────── */}
        <div className="bg-[#111120]/60 backdrop-blur-md border-b border-[#1e1e38] flex flex-col shrink-0">

          {/* Top bar */}
          <div className="h-11 flex items-center px-4 gap-4">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 w-16">
              <div className="size-3 rounded-full bg-[#ff5f57] border border-[#ff5f57]/50 shadow-[0_0_8px_rgba(255,95,87,0.3)]" />
              <div className="size-3 rounded-full bg-[#febc2e] border border-[#febc2e]/50 shadow-[0_0_8px_rgba(254,188,46,0.3)]" />
              <div className="size-3 rounded-full bg-[#28c840] border border-[#28c840]/50 shadow-[0_0_8px_rgba(40,200,64,0.3)]" />
            </div>

            {/* Status badge */}
            <div className={cn(
              "h-7 px-3 flex items-center gap-2 rounded-xl border text-[11px] font-medium",
              isReady
                ? "bg-[#0d2e1a] border-[#22c55e]/30 text-[#22c55e]"
                : isProvisioning
                ? "bg-[#1a1a2e] border-[#7c6fee]/30 text-[#9896b8]"
                : isError
                ? "bg-[#2e0d0d] border-red-500/30 text-red-400"
                : "bg-[#16162a] border-[#2a2a48] text-[#5c5a7a]"
            )}>
              {isReady && (
                <>
                  <span className="size-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  <span>Live — {sandbox.blockCount} block{sandbox.blockCount !== 1 ? "s" : ""}</span>
                </>
              )}
              {isProvisioning && (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  <span>{PROVISION_MESSAGES[msgIdx]}</span>
                </>
              )}
              {isError && (
                <>
                  <ZapIcon size={10} />
                  <span>Error</span>
                </>
              )}
              {isIdle && (
                <>
                  <Layers size={10} />
                  <span>Waiting</span>
                </>
              )}
            </div>

            <div className="flex-1" />

            {/* Open in new tab */}
            {isReady && sandbox.previewUrl && (
              <a
                href={sandbox.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-[#2a2a48] bg-[#16162a] text-[#5c5a7a] hover:text-[#f0effe] hover:border-[#3a3858] text-[11px] font-medium transition-all"
              >
                <ExternalLink size={12} />
                <span>Open</span>
              </a>
            )}

            {/* Refresh / Re-provision */}
            <button
              onClick={() => provision(true)}
              disabled={isProvisioning}
              title="Re-provision sandbox"
              className="size-7 flex items-center justify-center rounded-lg hover:bg-[#16162a] text-[#5c5a7a] hover:text-[#9896b8] transition-colors disabled:opacity-40"
            >
              <RotateCw size={13} className={isProvisioning ? "animate-spin text-[#7c6fee]" : ""} />
            </button>

            {/* Viewport switcher */}
            <div className="flex items-center gap-1 bg-[#0d0d1a] p-1 rounded-xl border border-[#1e1e38] shadow-inner">
              {(["desktop", "tablet", "mobile"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewport(v)}
                  className={cn("p-1.5 rounded-lg transition-all duration-200",
                    viewport === v
                      ? "bg-[#7c6fee] text-white shadow-[0_0_10px_rgba(124,111,238,0.4)]"
                      : "text-[#5c5a7a] hover:text-[#f0effe] hover:bg-[#16162a]"
                  )}
                >
                  {v === "desktop" && <Monitor size={14} />}
                  {v === "tablet"  && <Tablet size={14} />}
                  {v === "mobile"  && <Smartphone size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Address bar */}
          <div className="h-12 border-t border-[#1e1e38] flex items-center px-4 gap-4 bg-[#111120]/40">
            <div className="flex items-center gap-3 text-[#5c5a7a]">
              <ChevronLeft size={16} className="opacity-30 cursor-not-allowed" />
              <ChevronRight size={16} className="opacity-30 cursor-not-allowed" />
            </div>
            <div className="flex-1 flex items-center h-8 bg-[#0d0d1a] border border-[#2a2a48] focus-within:border-[#7c6fee]/50 rounded-lg px-3 gap-2 transition-all duration-300">
              <ShieldCheck size={14} className={cn("shrink-0", isReady ? "text-[#22c55e]" : "text-[#5c5a7a]")} />
              {/* FIX-1: Show the clean URL (no proxy wrapper, no token) */}
              <span className="text-[11px] font-mono text-[#9896b8] truncate select-all">
                {addressBarUrl}
              </span>
            </div>
          </div>
        </div>

        {/* ── Preview area ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex justify-center bg-[#08080f] relative overflow-auto p-6 scrollbar-hide">
          <div className={cn(
            "h-full transition-all duration-500 relative rounded-lg border border-[#1e1e38] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden shrink-0",
            VIEWPORT_WIDTHS[viewport],
            isReady ? "bg-white" : "bg-[#111120]",
          )}>

            {/* ── Provisioning overlay ──────────────────────────────────────── */}
            {isProvisioning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#08080f] z-50 p-8">
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-20 rounded-full border border-[#7c6fee]/20 animate-[spin_4s_linear_infinite]" />
                  <div className="absolute size-14 rounded-full border-2 border-transparent border-t-[#7c6fee] animate-spin" />
                  <div className="absolute size-8 rounded-full border border-[#7c6fee]/40 animate-[spin_2s_linear_infinite_reverse]" />
                  <Loader2 size={20} className="text-[#9d8ff5] animate-pulse" />
                </div>

                <div className="text-center max-w-xs">
                  <p className="text-[13px] font-semibold text-[#f0effe] mb-1">
                    {PROVISION_MESSAGES[msgIdx]}
                  </p>
                  <p className="text-[11px] text-[#5c5a7a]">
                    Spinning up a real Vite dev server in Daytona
                  </p>
                </div>

                {/* Progress dots */}
                <div className="flex items-center gap-2">
                  {PROVISION_MESSAGES.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-full transition-all duration-500",
                        i <= msgIdx
                          ? "size-2 bg-[#7c6fee]"
                          : "size-1.5 bg-[#2a2a48]"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Error state ───────────────────────────────────────────────── */}
            {isError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="size-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2">
                  <ZapIcon size={22} className="text-red-400" />
                </div>
                <p className="text-[14px] text-[#f0effe] font-semibold">Provisioning Failed</p>
                <p className="text-[11px] text-[#9896b8] max-w-sm font-mono bg-[#0d0d1a] rounded-lg p-3 text-left border border-[#1e1e38]">
                  {sandbox.error}
                </p>
                {sandbox.detail && (
                  <details className="w-full max-w-sm">
                    <summary className="text-[10px] text-[#5c5a7a] cursor-pointer hover:text-[#9896b8] transition-colors select-none">
                      Show crash log
                    </summary>
                    <pre className="mt-2 text-[10px] text-[#9896b8] font-mono bg-[#0d0d1a] rounded-lg p-3 border border-[#1e1e38] overflow-auto max-h-48 whitespace-pre-wrap break-all">
                      {sandbox.detail.slice(0, 2000)}
                    </pre>
                  </details>
                )}
                <button
                  onClick={() => provision(true)}
                  className="mt-2 px-5 py-2 rounded-xl bg-[#2a2a48] text-[#f0effe] text-[12px] hover:bg-[#3a3858] transition-colors border border-[#1e1e38]"
                >
                  Try again
                </button>
              </div>
            )}

            {/* ── Idle / no project ─────────────────────────────────────────── */}
            {isIdle && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="size-16 rounded-2xl bg-[#7c6fee]/10 border border-[#7c6fee]/20 flex items-center justify-center mb-2">
                  <Monitor size={28} className="text-[#7c6fee]" />
                </div>
                <p className="text-[15px] font-semibold text-[#f0effe]">Nothing to Preview Yet</p>
                <p className="text-[12px] text-[#5c5a7a] max-w-xs leading-relaxed">
                  Generate a plan and implement blocks first.
                </p>
              </div>
            )}

            {/* ── Live Daytona iframe ───────────────────────────────────────── */}
            {isReady && proxyIframeSrc && (
              <PreviewErrorBoundary>
                {iframeBlocked && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#08080f] text-center p-8">
                    <div className="size-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
                      <ZapIcon size={22} className="text-amber-400" />
                    </div>
                    <p className="text-[14px] text-[#f0effe] font-semibold">Preview Blocked by Browser</p>
                    <p className="text-[11px] text-[#9896b8] max-w-sm text-center leading-relaxed">
                      The preview server returned X-Frame-Options headers that prevent embedding.<br />
                      Click <strong>Re-provision</strong> to rebuild the sandbox with updated headers.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => provision(true)}
                        className="px-5 py-2 rounded-xl bg-[#7c6fee] text-white text-[12px] hover:bg-[#6b5fda] transition-colors font-semibold"
                      >
                        Re-provision Sandbox
                      </button>
                      <a
                        href={sandbox.previewUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2 rounded-xl bg-[#2a2a48] text-[#f0effe] text-[12px] hover:bg-[#3a3858] transition-colors border border-[#1e1e38]"
                      >
                        Open in New Tab
                      </a>
                    </div>
                  </div>
                )}
                <iframe
                  key={proxyIframeSrc}
                  ref={iframeRef}
                  src={proxyIframeSrc}
                  title="CraftaStudio Live Preview"
                  className="w-full h-full border-0 bg-white"
                  referrerPolicy="no-referrer-when-downgrade"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
                  loading="eager"
                  onLoad={() => {
                    try {
                      const doc = iframeRef.current?.contentDocument;
                      if (doc && doc.body && doc.body.innerHTML.trim() === "") {
                        setIframeBlocked(true);
                      } else {
                        setIframeBlocked(false);
                      }
                    } catch {
                      setIframeBlocked(false);
                    }
                  }}
                />
              </PreviewErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}