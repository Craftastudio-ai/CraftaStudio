import Image from "next/image";
import { Globe, MessageSquare, Mail } from "lucide-react";

export default function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features",     href: "#features" },
        { label: "How it works", href: "#how-it-works" },
        { label: "FAQ",          href: "#faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Blog",  href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "#" },
        { label: "Terms",   href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[#1e1e38] bg-[#08080f]">
      {/* Premium Giant Typography Design at the Top of Footer */}
      <div className="w-full overflow-hidden select-none border-b border-[#1e1e38]/20 pt-16 pb-12 bg-gradient-to-b from-[#05050a]/10 to-transparent">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
          {/* Giant Typography "CraftaStudio" */}
          <h2 className="text-[12.5vw] font-bold text-center leading-[0.75] tracking-[-0.05em] select-none pointer-events-none w-full font-sans antialiased">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#d0cdfb] to-[#121224]">Crafta</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#c0baff] via-[#7c6fee] to-[#1c164a]">Studio</span>
          </h2>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
        {/* Brand col */}
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-4 group">
            <Image src="/logocrafta.png" alt="CraftaStudio" width={32} height={32} className="rounded-lg shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-bold text-[#f0effe] text-[18px]">Crafta<span className="text-[#7c6fee]">Studio</span></span>
          </div>
          <p className="text-[12px] text-[#5c5a7a] max-w-[200px] leading-relaxed mb-5">
            Architecture-first AI code generation for professional software teams.
          </p>
          <div className="flex gap-3">
            {[Globe, MessageSquare, Mail].map((Icon, i) => (
              <button
                key={i}
                aria-label="Social link"
                className="w-8 h-8 rounded-lg border border-[#1e1e38] bg-[#111120] flex items-center justify-center text-[#5c5a7a] hover:text-[#7c6fee] hover:border-[#7c6fee]/40 transition-colors cursor-pointer"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Nav cols */}
        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11px] font-mono font-bold text-[#f0effe] uppercase tracking-wider mb-4">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-[12px] text-[#5c5a7a] hover:text-[#9896b8] transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 border-t border-[#1e1e38] flex items-center justify-between">
        <span className="text-[11px] text-[#3a3858]">
          &copy; {new Date().getFullYear()} Crafta<span className="text-[#7c6fee]">Studio</span>. All rights reserved.
        </span>
        <span className="text-[11px] font-mono text-[#3a3858]">v0.1.0</span>
      </div>
    </footer>
  );
}

