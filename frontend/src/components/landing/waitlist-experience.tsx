"use client";

export function WaitlistExperience({ count = 0 }: { count?: number }) {
  return (
    <section id="waitlist" className="relative min-h-screen bg-[#07070d] w-full border-t border-[#1e1e38] flex flex-col items-center justify-center py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,111,238,0.06)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center">
        <span className="flex items-center gap-2 text-[12px] font-mono text-[#5a5878] uppercase tracking-[0.2em] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7c6fee]" />
          Early Access
        </span>

        <h2 className="text-[40px] lg:text-[56px] font-black text-[#f0effe] tracking-tight leading-[1.05] mb-6">
          Be the first to<br />
          <span className="text-[#7c6fee]">build with it.</span>
        </h2>

        <p className="text-[#7a7898] text-[18px] lg:text-[20px] leading-[1.6] max-w-[560px] mb-12 font-light">
          Join the waitlist to secure your spot. We are rolling out access to developers in batches before our public launch.
        </p>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-waitlist-modal"))}
          className="group inline-flex items-center gap-2 px-10 py-4 rounded-full bg-[#f0effe] hover:bg-white text-[#0a0a12] font-semibold text-[16px] transition-transform active:scale-95 shadow-[0_0_30px_-5px_rgba(240,239,254,0.3)] mb-14"
        >
          Join the Waitlist →
        </button>

        <div className="flex items-center gap-4 mb-24">
          <div className="flex -space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#7c6fee] border-2 border-[#07070d] flex items-center justify-center text-white text-[11px] font-bold z-30">P</div>
            <div className="w-9 h-9 rounded-full bg-[#28c840] border-2 border-[#07070d] flex items-center justify-center text-white text-[11px] font-bold z-20">A</div>
            <div className="w-9 h-9 rounded-full bg-[#ff5f57] border-2 border-[#07070d] flex items-center justify-center text-white text-[11px] font-bold z-10">D</div>
          </div>
          <span className="text-[#5a5878] text-[15px] font-medium">
            Join <strong className="text-[#c4bcfa]">{count > 0 ? count : 10}+</strong> developers already on the list
          </span>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="text-[11px] font-mono text-[#5a5878] uppercase tracking-[0.2em] mb-6">
            Coming Soon
          </div>
          <div className="flex flex-col items-center gap-4 rounded-[28px] border border-[#1e1e38] bg-[#0d0d1a] px-8 py-10 shadow-[0_0_40px_-20px_rgba(124,111,238,0.35)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#7c6fee]/30 bg-[#7c6fee]/10 px-4 py-2 text-[12px] font-mono uppercase tracking-[0.2em] text-[#c4bcfa]">
              <span className="h-2 w-2 rounded-full bg-[#7c6fee]" />
              Coming Soon
            </span>
            <p className="max-w-[420px] text-[16px] lg:text-[18px] leading-[1.7] text-[#7a7898]">
              The next batch is not live yet. The same architecture-first experience is on the way.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
