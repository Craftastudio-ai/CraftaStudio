"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "error" | "duplicate";

interface WaitlistFormProps {
  variant?: "hero" | "section";
}

interface ApiSuccessResponse {
  success: true;
  position?: number;
  duplicate?: boolean;
}

interface ApiErrorResponse {
  success: false;
  error: string;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaitlistForm({ variant = "section" }: WaitlistFormProps) {
  const [email, setEmail]       = useState<string>("");
  const [status, setStatus]     = useState<Status>("idle");
  const [position, setPosition] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const isHero    = variant === "hero";
  const inputSize = isHero ? "px-3.5 py-2.5 text-[13px]" : "px-4 py-3 text-[14px]";
  const btnSize   = isHero ? "px-4 py-2.5 text-[13px]"   : "px-5 py-3 text-[14px]";

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: trimmed }),
      });

      const data: ApiResponse = await res.json() as ApiResponse;

      if (!data.success) {
        setErrorMsg((data as ApiErrorResponse).error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      const ok = data as ApiSuccessResponse;
      if (ok.duplicate) {
        setStatus("duplicate");
        return;
      }

      setPosition(ok.position ?? 1);
      setStatus("success");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void submit();
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-3 rounded-xl px-5 py-4"
          style={{ border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}
        >
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(34,197,94,0.2)" }}>
            <span className="text-[11px]" style={{ color: "#22c55e" }}>✓</span>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#f0effe]">
              You&apos;re #{position} on the list.
            </p>
            <p className="mt-0.5 text-[12px] text-[#9896b8]">
              We&apos;ll email you the moment we launch.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Duplicate state ────────────────────────────────────────────────────────
  if (status === "duplicate") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-xl px-5 py-4"
          style={{ border: "1px solid rgba(124,111,238,0.3)", background: "rgba(124,111,238,0.08)" }}
        >
          <span className="text-[20px]">👍</span>
          <p className="text-[13px]" style={{ color: "#c4bcfa" }}>
            You&apos;re already on the list!
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Default (idle / loading / error) ──────────────────────────────────────
  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          onKeyDown={handleKeyDown}
          placeholder="you@example.com"
          disabled={status === "loading"}
          aria-label="Email address"
          className={`${inputSize} flex-1 rounded-xl border bg-[#0d0d1a] text-[#f0effe] placeholder-[#3a3858] outline-none transition-all duration-150`}
          style={{
            borderColor: status === "error" ? "rgba(239,68,68,0.6)" : "#1e1e38",
            opacity: status === "loading" ? 0.6 : 1,
            cursor: status === "loading" ? "not-allowed" : "auto",
          }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={status === "loading" || !email.trim()}
          className={`${btnSize} group inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all duration-150 border-none cursor-pointer`}
          style={{
            background: "#7c6fee",
            opacity: (status === "loading" || !email.trim()) ? 0.6 : 1,
            cursor: (status === "loading" || !email.trim()) ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { if (status !== "loading" && email.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#6a5de0"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7c6fee"; }}
          aria-label="Join the waitlist"
        >
          {status === "loading" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              Join the Waitlist
              <ArrowRight size={13} className="transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      {/* Inline error */}
      <AnimatePresence>
        {status === "error" && errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-[11px]"
            style={{ color: "#f87171" }}
            role="alert"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
