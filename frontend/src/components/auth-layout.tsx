"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070d] text-[#f0effe] flex flex-col relative overflow-hidden font-sans selection:bg-[#7c6fee]/30">

      {/* Grid background */}
      <div className="hero-grid absolute inset-0 pointer-events-none opacity-60" />

      {/* Logo */}
      <header className="relative z-10 px-8 pt-7 flex items-center">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/logocrafta.png" alt="CraftaStudio" width={40} height={40} className="rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105" />
          <span className="text-[20px] font-bold tracking-tight">
            Crafta<span className="text-[#7c6fee]">Studio</span>
          </span>
        </Link>
      </header>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[420px] mx-auto"
        >
          {children}
        </motion.div>
      </main>

      <footer className="relative z-10 pb-7 text-center">
        <p className="text-[11px] text-[#5c5a7a]">
          &copy; {new Date().getFullYear()} Crafta<span className="text-[#7c6fee]">Studio</span>. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
