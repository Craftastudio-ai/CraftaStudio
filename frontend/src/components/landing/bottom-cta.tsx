"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";

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

export default function BottomCta() {

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp>
          <div className="relative border border-[#1e1e38] rounded-3xl overflow-hidden bg-[#0d0d1a] p-14 md:p-20">
            {/* Dot grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(rgba(124,111,238,0.08) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-px h-32 bg-[#7c6fee]/40" />
            <div className="absolute top-0 left-0 w-32 h-px bg-[#7c6fee]/40" />
            <div className="absolute bottom-0 right-0 w-px h-32 bg-[#7c6fee]/40" />
            <div className="absolute bottom-0 right-0 w-32 h-px bg-[#7c6fee]/40" />

            <div className="relative text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#7c6fee]/30 bg-[#7c6fee]/8 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
                <span className="text-[11px] font-mono text-[#7c6fee] tracking-widest uppercase">
                  No credit card required
                </span>
              </div>
              <h2 className="text-[44px] md:text-[56px] font-black tracking-[-1.5px] text-[#f0effe] leading-[1.1] mb-5">
                Build your first
                <br />architecture in minutes.
              </h2>
              <p className="text-[#9896b8] text-[16px] mb-8">
                Join architects who plan systems visually and generate production code without the boilerplate.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-waitlist-modal"))}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#7c6fee] hover:bg-[#6355d4] text-white font-bold text-[15px] transition-all border-none cursor-pointer"
                >
                  Join the Waitlist →
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
