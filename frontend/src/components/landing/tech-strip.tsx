"use client";

const items = [
  "Visual Canvas", "✦", "AI Codegen", "✦", "Dependency Graph",
  "✦", "Human Review", "✦", "Live Preview", "✦", "Export ZIP",
  "✦", "Block Memory", "✦", "Multi-Model AI", "✦",
];

function Strip() {
  return (
    <div className="flex items-center shrink-0">
      {items.map((item, i) => (
        <span
          key={i}
          className={
            item === "✦"
              ? "text-[#2a2848] px-4 select-none text-[11px]"
              : "text-[12px] font-semibold text-[#f0effe]/45 tracking-wide px-4 whitespace-nowrap uppercase"
          }
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function TechStrip() {
  return (
    <section className="border-b border-[#1e1e38] bg-[#0a0a12] overflow-hidden py-[14px]">
      <style>{`
        @keyframes marquee-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-left 32s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      {/* Fade edges for centered feel */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
          style={{ background: "linear-gradient(to right, #0a0a12, transparent)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
          style={{ background: "linear-gradient(to left, #0a0a12, transparent)" }} />
        <div className="marquee-track">
          <Strip /><Strip /><Strip /><Strip />
        </div>
      </div>
    </section>
  );
}
