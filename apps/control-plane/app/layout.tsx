import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystra Control Plane",
  description: "Codex-inspired operator workspace for Mystra jobs, runners, and MCP access.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme-id="notion" data-theme-preset="notion-light" data-theme-variant="light" lang="en" suppressHydrationWarning>
      <body className="appBody">{children}</body>
    </html>
  );
}
