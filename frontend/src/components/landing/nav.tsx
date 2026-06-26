"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Nav() {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#13131f] bg-[#07070d]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <img src="/logocrafta.png" alt="CraftaStudio Logo" className="w-11 h-11 rounded-xl object-contain transition-transform duration-200 group-hover:scale-105" />
          <span className="font-bold tracking-tight text-[#f0effe] text-[21px]">
            Crafta<span className="text-[#7c6fee]">Studio</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "How it works", id: "how-it-works" },
            { label: "Features",     id: "features" },
            { label: "FAQ",          id: "faq" },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-[13px] text-[#5a5878] hover:text-[#f0effe] transition-colors duration-150 bg-transparent border-none cursor-pointer"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-4 py-1.5 rounded-lg border border-[#1e1e38] hover:border-[#2a2a48] hover:bg-[#0d0d1a] text-[#9896b8] hover:text-[#f0effe] font-medium text-[13px] transition-all"
          >
            Sign In
          </Link>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-waitlist-modal"))}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#7c6fee] hover:bg-[#6a5de0] text-white font-medium text-[13px] transition-colors border-none cursor-pointer"
          >
            Join Waitlist <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
