"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-14 w-full rounded-xl border border-[#1e1e38] bg-[#0d0d1a] px-5 py-2 text-[15px] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#7a7898] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7c6fee]/50 focus-visible:border-[#7c6fee]/50 transition-all hover:border-[#3a3858] disabled:cursor-not-allowed disabled:opacity-50 text-[#f0effe] ${className}`}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[15px] font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6fee] disabled:pointer-events-none disabled:opacity-50 bg-[#7c6fee] text-white hover:bg-[#6a5de0] h-14 px-4 py-2 active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(124,111,238,0.4)] ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export default function WaitlistModal() {
  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-waitlist-modal", handleOpen);
    return () => window.removeEventListener("open-waitlist-modal", handleOpen);
  }, []);

  const onClose = () => setIsOpen(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("");
  const [excitement, setExcitement] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "duplicate" | "survey_loading" | "survey_success">("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok || !data.success) {
        setErrorMessage((data.error as string) || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      if (data.duplicate) {
        setStatus("duplicate");
        return;
      }
      setPosition((data.position as number) || 1);
      setStatus("success");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("survey_loading");
    try {
      await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          mobile: mobile.trim() || undefined,
          role,
          excitement,
        }),
      });
    } catch {
      // Non-fatal
    }
    setStatus("survey_success");
  };

  React.useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setStatus("idle");
        setName("");
        setEmail("");
        setMobile("");
        setRole("");
        setExcitement("");
        setErrorMessage("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#07070d]/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[480px] bg-[#0d0d1a]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(124,111,238,0.15)] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#7c6fee]/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#7c6fee] to-transparent opacity-70" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#111120] hover:bg-[#1e1e38] text-[#9896b8] hover:text-[#f0effe] transition-colors z-10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="p-8 lg:p-10">
              {(status === "idle" || status === "loading" || status === "error") && (
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 text-[11px] font-mono text-[#7c6fee] uppercase tracking-[0.2em] mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7c6fee] animate-pulse" />
                    Priority Access
                  </span>
                  <h3 className="text-[32px] font-black text-[#f0effe] tracking-tight leading-[1.1] mb-4">
                    Join the waitlist
                  </h3>
                  <p className="text-[#7a7898] text-[15px] leading-relaxed mb-8">
                    Secure your spot. We are rolling out access to developers in batches before our public launch.
                  </p>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <Input
                      type="text"
                      placeholder="Full Name *"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (status === "error") setStatus("idle"); }}
                      required
                      disabled={status === "loading"}
                    />
                    <Input
                      type="email"
                      placeholder="Email Address *"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                      required
                      disabled={status === "loading"}
                    />
                    <Button type="submit" disabled={status === "loading"} className="mt-2">
                      {status === "loading" ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        "Secure My Spot →"
                      )}
                    </Button>
                    {status === "error" && (
                      <p className="text-[#ff5f57] text-[13px] mt-1 text-center">{errorMessage}</p>
                    )}
                  </form>
                </div>
              )}

              {(status === "success" || status === "survey_loading") && (
                <div className="flex flex-col animate-in fade-in duration-500">
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 mb-6 rounded-full bg-gradient-to-tr from-[#7c6fee]/20 to-[#5a4fd4]/20 flex items-center justify-center border border-[#7c6fee]/30">
                      <svg className="w-7 h-7 text-[#7c6fee]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-[28px] font-black text-[#f0effe] mb-2 tracking-tight">You&apos;re #{position}!</h3>
                    <p className="text-[#9896b8] text-[15px]">We&apos;ve reserved your spot.</p>
                  </div>
                  <hr className="border-[#1e1e38] mb-8" />
                  <div className="text-left">
                    <h4 className="text-[#f0effe] font-semibold text-[16px] mb-2">Help us build for you</h4>
                    <p className="text-[#5a5878] text-[13px] mb-6">Optional — takes 30 seconds.</p>
                    <form onSubmit={handleSurveySubmit} className="flex flex-col gap-6">
                      <Input
                        type="tel"
                        placeholder="Mobile Number (Optional)"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        disabled={status === "survey_loading"}
                      />
                      <div>
                        <label className="block text-[#9896b8] text-[14px] font-medium mb-3">What best describes you?</label>
                        <div className="flex flex-col gap-2">
                          {["Solo developer", "Small team (2–10)", "Startup / founding engineer", "Other"].map((opt) => (
                            <label key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-[#1e1e38] hover:border-[#7c6fee]/50 cursor-pointer transition-colors bg-[#0a0a14]">
                              <input
                                type="radio"
                                name="role"
                                value={opt}
                                checked={role === opt}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-4 h-4 text-[#7c6fee] focus:ring-[#7c6fee] bg-transparent border-[#3a3858]"
                              />
                              <span className="text-[#f0effe] text-[14px]">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[#9896b8] text-[14px] font-medium mb-3">What are you most excited about?</label>
                        <div className="flex flex-col gap-2">
                          {["Architecture planning", "Code generation", "Both"].map((opt) => (
                            <label key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-[#1e1e38] hover:border-[#7c6fee]/50 cursor-pointer transition-colors bg-[#0a0a14]">
                              <input
                                type="radio"
                                name="excitement"
                                value={opt}
                                checked={excitement === opt}
                                onChange={(e) => setExcitement(e.target.value)}
                                className="w-4 h-4 text-[#7c6fee] focus:ring-[#7c6fee] bg-transparent border-[#3a3858]"
                              />
                              <span className="text-[#f0effe] text-[14px]">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={status === "survey_loading"}
                        className="w-full mt-2 h-12 rounded-xl bg-[#f0effe] text-[#07070d] hover:bg-white font-bold text-[14px] transition-transform active:scale-[0.98] disabled:opacity-50"
                      >
                        {status === "survey_loading" ? "Saving..." : "Submit Answers"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {status === "survey_success" && (
                <div className="flex flex-col items-center text-center animate-in fade-in duration-500 py-6">
                  <div className="w-20 h-20 mb-8 rounded-full bg-gradient-to-tr from-[#7c6fee]/20 to-[#5a4fd4]/20 flex items-center justify-center border border-[#7c6fee]/30 shadow-[0_0_50px_rgba(124,111,238,0.2)]">
                    <span className="text-3xl">🎉</span>
                  </div>
                  <h3 className="text-[32px] font-black text-[#f0effe] mb-4 tracking-tight leading-none">Thank you!</h3>
                  <p className="text-[#7a7898] text-[16px] leading-relaxed mb-8">
                    Your feedback helps us shape CraftaStudio into the perfect tool for you. We&apos;ll be in touch soon.
                  </p>
                  <button onClick={onClose} className="text-[#5a5878] hover:text-[#f0effe] font-medium text-[14px] transition-colors">
                    Close window
                  </button>
                </div>
              )}

              {status === "duplicate" && (
                <div className="flex flex-col items-center text-center animate-in fade-in duration-500 py-6">
                  <div className="w-20 h-20 mb-8 rounded-full bg-[#1e1e38]/30 flex items-center justify-center border border-[#1e1e38]">
                    <span className="text-4xl">👋</span>
                  </div>
                  <h3 className="text-[32px] font-black text-[#f0effe] mb-4 tracking-tight leading-none">Welcome back!</h3>
                  <p className="text-[#7a7898] text-[16px] leading-relaxed mb-8">
                    <strong className="text-[#f0effe] font-medium">{email}</strong> is already on our waitlist.
                  </p>
                  <button onClick={onClose} className="text-[#5a5878] hover:text-[#f0effe] font-medium text-[14px] transition-colors">
                    Close window
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
