import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "./_components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystra Control Plane",
  description: "Operate Mystra control-plane, runner, and task objects.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme-id="notion" data-theme-preset="notion-light" data-theme-variant="light" lang="en" suppressHydrationWarning>
      <body className="appBody"><AppShell>{children}</AppShell></body>
    </html>
  );
}
