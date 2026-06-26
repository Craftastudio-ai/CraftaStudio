"use client";

import { createContext, useContext } from "react";

const Ctx = createContext<{ open: () => void }>({ open: () => {} });

export function useWaitlist() {
  return useContext(Ctx);
}

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  return (
    <Ctx.Provider value={{ open: () => window.dispatchEvent(new CustomEvent("open-waitlist-modal")) }}>
      {children}
    </Ctx.Provider>
  );
}
