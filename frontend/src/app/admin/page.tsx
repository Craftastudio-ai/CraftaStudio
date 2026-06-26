import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Dot } from "lucide-react";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-[#06060e] text-[#f0effe] font-sans">

      {/* ── Premium header ── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#06060e]/80 backdrop-blur-xl">
        {/* Subtle top accent line */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#7c6fee]/60 to-transparent" />

        <div className="flex items-center justify-between px-8 h-16">
          {/* Left: back + breadcrumb */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="group flex items-center gap-1.5 text-[#4a4870] hover:text-[#9896b8] transition-all duration-200 text-[12px] font-medium"
            >
              <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              Dashboard
            </Link>

            <span className="text-white/10 text-lg font-thin">/</span>

            {/* Admin brand */}
            <div className="flex items-center gap-2.5">
              {/* Premium shield icon */}
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-[#7c6fee]/30 blur-[6px]" />
                <div
                  className="relative w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #9d8ff5 0%, #6355d4 50%, #4a3fb5 100%)",
                    boxShadow: "0 0 0 1px rgba(124,111,238,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  <Shield className="size-3.5 text-white" fill="rgba(255,255,255,0.15)" />
                </div>
              </div>
              <div>
                <span className="text-[14px] font-semibold text-white tracking-tight leading-none">Admin Panel</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_4px_#22c55e]" />
                  <span className="text-[10px] text-[#4a4870] font-mono">system online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: admin identity */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-[11px] text-[#3a3858] font-mono">pranavgawai1518@gmail.com</span>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
              style={{
                background: "linear-gradient(135deg, rgba(124,111,238,0.15), rgba(99,85,212,0.08))",
                border: "1px solid rgba(124,111,238,0.25)",
                color: "#b8aef8",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Shield className="size-3" />
              Super Admin
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-10">
        <AdminDashboard />
      </main>
    </div>
  );
}
