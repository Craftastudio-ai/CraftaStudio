"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronDown, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

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

const faqs = [
  {
    q: "When will CraftaStudio launch?",
    a: "We're targeting a public launch in late 2026. Everyone on the waitlist gets access before anyone else — in order of signup.",
  },
  {
    q: "Is it free to join the waitlist?",
    a: "Completely free. No credit card, no commitment.",
  },
  {
    q: "What do I get as an early access member?",
    a: "Full platform access at launch, priority support, and early-adopter pricing locked in before we go public.",
  },
  {
    q: "Who is CraftaStudio built for?",
    a: "Developers and small engineering teams who want to scaffold complex multi-layer systems — frontend, backend, DB, APIs — without starting from scratch every time.",
  },
  {
    q: "What AI models does it use?",
    a: "Claude (Anthropic) as the primary model, with Llama, Gemini, and Groq as fallbacks depending on task type.",
  },
  {
    q: "Can I own the generated code?",
    a: "Yes. All generated code is yours — no lock-in, export anytime as a ZIP.",
  },
];

export default function FAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 border-b border-[#1e1e38] bg-[#0a0a12]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-14">
          {/* Left label */}
          <FadeUp>
            <span className="text-[11px] font-mono text-[#7c6fee] uppercase tracking-widest">FAQ</span>
            <h2 className="text-[28px] font-black tracking-tight text-[#f0effe] mt-2 mb-4">
              Common questions.
            </h2>
            <p className="text-[13px] text-[#9896b8] leading-relaxed mb-6">
              Still have questions? Reach out directly.
            </p>
            <a
              href="mailto:hello@craftastudio.ai"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7c6fee] hover:text-[#9d8ff5] transition-colors"
            >
              <Mail size={12} /> hello@craftastudio.ai
            </a>
          </FadeUp>

          {/* Accordion */}
          <FadeUp delay={0.05}>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-[#1e1e38] rounded-xl overflow-hidden bg-[#0d0d1a]"
                >
                  <button
                    id={`faq-btn-${i}`}
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-panel-${i}`}
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-[13px] font-semibold text-[#f0effe] hover:bg-[#111120] transition-colors bg-transparent border-none cursor-pointer"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {faq.q}
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-[#5c5a7a] shrink-0 ml-3 transition-transform duration-200",
                        openFaq === i && "rotate-180"
                      )}
                    />
                  </button>
                  {openFaq === i && (
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-btn-${i}`}
                      className="px-5 pb-4 text-[12px] text-[#9896b8] leading-relaxed border-t border-[#1e1e38] pt-3"
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
