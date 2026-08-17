import { Suspense, type ReactNode } from "react";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "@fontsource/fira-code/700.css";
import { ControlPlaneGate } from "./_components/control-plane-gate";
import { ScrollbarActivity } from "./_components/scrollbar-activity";
import { siteMetadata } from "./site-metadata";
import { buildThemeBootstrapScript } from "./theme-system";
import "./globals.css";
import "./feature-054.css";

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme-id="graphite-signal" data-theme-preset="graphite-signal" data-theme-variant="dark" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }} />
      </head>
      <body className="appBody">
        <ScrollbarActivity />
        <Suspense fallback={<main aria-busy="true" className="accessGate" role="status">Loading Mystra…</main>}>
          <ControlPlaneGate>{children}</ControlPlaneGate>
        </Suspense>
      </body>
    </html>
  );
}
