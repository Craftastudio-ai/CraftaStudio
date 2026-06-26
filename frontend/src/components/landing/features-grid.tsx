"use client";

import { useRef } from "react";
import { m, useInView } from "framer-motion";
import { Layers, Cpu, GitBranch, Shield, Box, Terminal } from "lucide-react";

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

const features = [
  {
    icon:  <Layers size={18} className="text-[#7c6fee]" />,
    title: "Visual Canvas",
    desc:  "React Flow canvas with drag-and-drop blocks. Draw connections, detect cycles, and auto-wire dependencies — all before any code runs.",
    label: "Planning",
  },
  {
    icon:  <Cpu size={18} className="text-[#7c6fee]" />,
    title: "Multi-Model AI",
    desc:  "Claude Haiku as primary with Groq, OpenRouter, and Gemini fallbacks. Near-100% availability across providers with automatic switching.",
    label: "AI",
  },
  {
    icon:  <GitBranch size={18} className="text-[#7c6fee]" />,
    title: "Dependency Scheduler",
    desc:  "Blocks are generated in topological order. Auth API waits for the DB schema. The UI waits for the service layer. Zero manual ordering.",
    label: "Orchestration",
  },
  {
    icon:  <Shield size={18} className="text-[#7c6fee]" />,
    title: "Human-in-the-Loop",
    desc:  "Every block requires explicit approval before generation. Review the spec, confirm the files, then watch code stream in real time via WebSocket.",
    label: "Control",
  },
  {
    icon:  <Box size={18} className="text-[#7c6fee]" />,
    title: "Memory Layer",
    desc:  "Your architecture decisions persist across blocks. Choose PostgreSQL once — every subsequent block knows your ORM, schema, and type conventions.",
    label: "Context",
  },
  {
    icon:  <Terminal size={18} className="text-[#7c6fee]" />,
    title: "Export & Download",
    desc:  "Download the full project as a ZIP with proper folder structure, ready to git push. All generated files use the exact paths you specified.",
    label: "Export",
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="py-24 border-b border-[#1e1e38]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="mb-14 w-full flex flex-col items-center text-center">
          <span className="text-[11px] font-mono text-[#7c6fee] uppercase tracking-widest">
            Features
          </span>
          <h2 className="text-[40px] font-black tracking-tight text-[#f0effe] mt-2 mb-3">
            Everything an architect needs.
          </h2>
          <p className="text-[#9896b8] max-w-[480px] text-[15px] text-center">
            Six powerful primitives. One canvas. Ship architecture that actually runs.
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FadeUp key={i} delay={i * 0.07}>
              <div className="border border-[#1e1e38] rounded-2xl bg-[#0d0d1a] p-6 group hover:border-[#7c6fee]/20 hover:shadow-[0_0_0_1px_rgba(124,111,238,0.06)] transition-all h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl border border-[#1e1e38] bg-[#111120] flex items-center justify-center group-hover:border-[#7c6fee]/25 group-hover:shadow-[0_0_12px_rgba(124,111,238,0.08)] transition-all">
                    {f.icon}
                  </div>
                  <span className="text-[9px] font-mono text-[#2a2a48] uppercase tracking-wider border border-[#1e1e38] px-2 py-0.5 rounded">
                    {f.label}
                  </span>
                </div>
                <h3 className="font-bold text-[15px] text-[#f0effe] mb-2">{f.title}</h3>
                <p className="text-[12px] text-[#9896b8] leading-relaxed">{f.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
