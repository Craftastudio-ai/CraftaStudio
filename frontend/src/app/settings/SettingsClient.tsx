"use client";

import { useState } from "react";
import { SettingsPanel } from "@/components/features/settings/settings-panel";

export default function SettingsClient() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="h-screen bg-[var(--background)]">
      <SettingsPanel
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          window.history.back();
        }}
      />
      {!isOpen && (
        <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
          Redirecting...
        </div>
      )}
    </div>
  );
}
