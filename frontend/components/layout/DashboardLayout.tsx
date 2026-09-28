"use client";

import type { ReactNode } from "react";

type DashboardLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export default function DashboardLayout({
  sidebar,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F7F8]">
      {sidebar}

      <main className="min-w-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}