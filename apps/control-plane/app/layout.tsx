import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "@fontsource/fira-code/700.css";
import { AppShell } from "./_components/app-shell";
import { buildThemeBootstrapScript } from "./theme-system";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystra Control Plane",
  description: "Operate Mystra control-plane, runner, and task objects.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme-id="graphite-signal" data-theme-preset="graphite-signal" data-theme-variant="dark" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }} />
      </head>
      <body className="appBody"><AppShell>{children}</AppShell></body>
    </html>
  );
}
