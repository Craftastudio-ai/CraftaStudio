"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Layers, GitBranch, Code2, Zap } from "lucide-react";

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
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const steps = [
  {
    n: "01",
    icon: <Layers size={20} className="text-[#7c6fee]" />,
    title: "Describe your system",
    desc: "Type a plain-English description. Our AI asks clarifying questions about scale, stack, and constraints — then generates a full architectural plan.",
    tag: "~30 seconds",
  },
  {
    n: "02",
    icon: <GitBranch size={20} className="text-[#7c6fee]" />,
    title: "Review the visual plan",
    desc: "Every component appears as a block on an interactive canvas. See connections, dependencies, and data flows. Edit anything before a single line is written.",
    tag: "Your control",
  },
  {
    n: "03",
    icon: <Code2 size={20} className="text-[#7c6fee]" />,
    title: "Generate block by block",
    desc: "Approve each block and watch production-ready code stream in real time. Each block sees the output of its dependencies for type-safe generation.",
    tag: "~5 min total",
  },
];

export default function Steps() {
  return (
    <section id="how-it-works" className="py-24 border-b border-[#1e1e38]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="mb-14">
          <span className="text-[11px] font-mono text-[#7c6fee] uppercase tracking-widest">
            How it works
          </span>
          <h2 className="text-[40px] font-black tracking-tight text-[#f0effe] mt-2 mb-3">
            From prompt to
            <br />production in three steps.
          </h2>
          <p className="text-[#9896b8] text-[16px] max-w-[500px]">
            No hidden magic. Every decision is visible, reviewable, and yours to control.
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className="relative border border-[#1e1e38] rounded-2xl bg-[#0d0d1a] p-7 group hover:border-[#7c6fee]/20 hover:bg-[#0d0d1e] transition-all h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl border border-[#1e1e38] bg-[#111120] flex items-center justify-center group-hover:border-[#7c6fee]/30 group-hover:shadow-[0_0_16px_rgba(124,111,238,0.08)] transition-all">
                    {s.icon}
                  </div>
                  <span className="text-[11px] font-mono text-[#2a2a48]">{s.n}</span>
                </div>
                <h3 className="font-bold text-[16px] text-[#f0effe] mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#9896b8] leading-relaxed mb-4">{s.desc}</p>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#7c6fee] border border-[#7c6fee]/20 bg-[#7c6fee]/8 px-2 py-0.5 rounded">
                  <Zap size={10} />
                  {s.tag}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
