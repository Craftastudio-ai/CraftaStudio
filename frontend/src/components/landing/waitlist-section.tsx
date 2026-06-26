"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import WaitlistForm from "@/components/landing/waitlist-form";

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

interface WaitlistSectionProps {
  count: number;
}

export default function WaitlistSection({ count }: WaitlistSectionProps) {
  return (
    <section
      id="waitlist"
      className="py-24 border-b border-[#1e1e38] bg-[#0a0a12]"
    >
      <div className="max-w-3xl mx-auto px-6">
        <FadeUp>
          <div className="relative border border-[#7c6fee]/20 rounded-3xl overflow-hidden bg-[#0d0d1a] p-10 md:p-14 text-center"
            style={{ boxShadow: "0 0 80px rgba(124,111,238,0.06), 0 0 0 1px rgba(124,111,238,0.08)" }}>

            {/* Dot grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(rgba(124,111,238,0.08) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-px h-24 bg-[#7c6fee]/40" />
            <div className="absolute top-0 left-0 w-24 h-px bg-[#7c6fee]/40" />
            <div className="absolute bottom-0 right-0 w-px h-24 bg-[#7c6fee]/40" />
            <div className="absolute bottom-0 right-0 w-24 h-px bg-[#7c6fee]/40" />

            <div className="relative">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#7c6fee]/30 bg-[#7c6fee]/8 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
                <span className="text-[11px] font-mono text-[#7c6fee] tracking-widest uppercase">
                  Early Access
                </span>
              </div>

              <h2 className="text-[36px] md:text-[44px] font-black tracking-[-1px] text-[#f0effe] leading-[1.1] mb-4">
                Be the first to build with it.
              </h2>
              <p className="text-[#9896b8] text-[16px] mb-4">
                Join the waitlist. Get early access before public launch.
              </p>

              {/* Social proof counter */}
              <p className="text-[13px] font-mono text-[#5a5878] mb-8">
                Join{" "}
                <span className="text-[#7c6fee] font-bold">{count}+</span>{" "}
                developers on the waitlist
              </p>

              {/* Form */}
              <div className="max-w-md mx-auto">
                <WaitlistForm variant="section" />
              </div>

              <p className="mt-5 text-[11px] text-[#3a3858]">
                No credit card. No spam. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
