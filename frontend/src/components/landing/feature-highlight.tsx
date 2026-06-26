"use client";

import { useRef } from "react";
import { m, useInView } from "framer-motion";
import { CheckCircle } from "lucide-react";

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </m.div>
  );
}

// ─── Code Mockup ──────────────────────────────────────────────────────────────

function CodeMockup() {
  const lines = [
    { tokens: [{ t: "// FILE: src/routes/auth.ts", c: "#5c5a7a" }] },
    { tokens: [] },
    { tokens: [{ t: "import ", c: "#c4bcfa" }, { t: "fastify", c: "#9d8ff5" }, { t: " from ", c: "#c4bcfa" }, { t: "'fastify'", c: "#9bd9a8" }] },
    { tokens: [{ t: "import ", c: "#c4bcfa" }, { t: "{ clerkPlugin }", c: "#f0effe" }, { t: " from ", c: "#c4bcfa" }, { t: "'@clerk/fastify'", c: "#9bd9a8" }] },
    { tokens: [] },
    { tokens: [{ t: "export ", c: "#c4bcfa" }, { t: "async function ", c: "#c4bcfa" }, { t: "authRoutes", c: "#9d8ff5" }, { t: "(app) {", c: "#f0effe" }] },
    { tokens: [{ t: "  app.", c: "#f0effe" }, { t: "register", c: "#9d8ff5" }, { t: "(clerkPlugin)", c: "#f0effe" }] },
    { tokens: [] },
    { tokens: [{ t: "  app.", c: "#f0effe" }, { t: "post", c: "#9d8ff5" }, { t: "(", c: "#f0effe" }, { t: "'/auth/verify'", c: "#9bd9a8" }, { t: ", async (req) => {", c: "#f0effe" }] },
    { tokens: [{ t: "    const ", c: "#c4bcfa" }, { t: "{ userId } ", c: "#f0effe" }, { t: "= ", c: "#5c5a7a" }, { t: "req.auth", c: "#f0effe" }] },
    { tokens: [{ t: "    if ", c: "#c4bcfa" }, { t: "(!userId) return ", c: "#f0effe" }, { t: "{ error: ", c: "#5c5a7a" }, { t: "'Unauthorized'", c: "#9bd9a8" }, { t: " }", c: "#5c5a7a" }] },
    { tokens: [{ t: "    return ", c: "#c4bcfa" }, { t: "{ userId, ", c: "#f0effe" }, { t: "status: ", c: "#5c5a7a" }, { t: "'active'", c: "#9bd9a8" }, { t: " }", c: "#5c5a7a" }] },
    { tokens: [{ t: "  })", c: "#f0effe" }] },
    { tokens: [{ t: "}", c: "#f0effe" }] },
  ] as { tokens: { t: string; c: string }[] }[];

  return (
    <div className="rounded-xl border border-[#1e1e38] bg-[#0d0d1a] overflow-hidden w-full max-w-[480px]">
      {/* Chrome */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-[#1e1e38]">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ff5f57]/50" />
          <div className="w-2 h-2 rounded-full bg-[#febc2e]/50" />
          <div className="w-2 h-2 rounded-full bg-[#28c840]/50" />
        </div>
        <span className="text-[9px] font-mono text-[#3a3858]">src/routes/auth.ts</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
          <span className="text-[9px] font-mono text-[#7c6fee]">generating</span>
        </div>
      </div>

      {/* Code */}
      <div className="p-4 font-mono text-[11px] leading-[1.7]">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-5 text-[#2a2a48] shrink-0 text-right mr-3 select-none">{i + 1}</span>
            <span>
              {line.tokens.map((tok, j) => (
                <span key={j} style={{ color: tok.c }}>{tok.t}</span>
              ))}
              {line.tokens.length === 0 && " "}
            </span>
          </div>
        ))}
        {/* Cursor blink */}
        <div className="flex mt-0.5">
          <span className="w-5 text-[#2a2a48] text-right mr-3 select-none">15</span>
          <span className="inline-block w-2 h-[14px] bg-[#7c6fee] animate-pulse rounded-sm" />
        </div>
      </div>

      {/* Status */}
      <div className="px-4 py-2 border-t border-[#1e1e38] flex items-center justify-between">
        <span className="text-[9px] font-mono text-[#9896b8]">Auth &amp; JWT API</span>
        <span className="text-[9px] font-mono text-[#22c55e]">✓ 2 / 5 blocks done</span>
      </div>
    </div>
  );
}

// ─── Feature Highlight ────────────────────────────────────────────────────────

export default function FeatureHighlight() {
  const bullets = [
    "Correct import paths across all files",
    "Types match between services automatically",
    "No hallucinated function signatures",
    "5-minute timeout per block, not per project",
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <FadeUp>
          <span className="text-[11px] font-mono text-[#7c6fee] uppercase tracking-widest mb-3 block">
            Live generation
          </span>
          <h3 className="text-[30px] font-black tracking-tight text-[#f0effe] mb-4">
            Dependency-aware code.
            <br />Every time.
          </h3>
          <p className="text-[#9896b8] text-[15px] leading-relaxed mb-6">
            When generating your Auth API, CraftaStudio already knows the exact
            PostgreSQL schema shape, Prisma models, and User Service interfaces
            — injecting them as context so the output is always consistent.
          </p>
          <ul className="space-y-2.5">
            {bullets.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px] text-[#9896b8]">
                <CheckCircle size={13} className="text-[#22c55e] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </FadeUp>
        <FadeUp delay={0.15} className="flex justify-center">
          <CodeMockup />
        </FadeUp>
      </div>
    </div>
  );
}
