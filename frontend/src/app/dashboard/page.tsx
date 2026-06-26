"use client";

import nextDynamic from "next/dynamic";

const DashboardClient = nextDynamic(
  () => import("./DashboardClient").then((m) => m.DashboardClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary-accent)] border-t-transparent animate-spin" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardClient />;
}
