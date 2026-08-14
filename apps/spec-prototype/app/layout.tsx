import type { ReactNode } from "react";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "@mystra/ui/styles.css";
import "./prototype.css";

export const metadata = {
  title: "Mystra Spec Prototype",
  description: "Independent, production-component-backed Mystra prototypes",
};

export default function PrototypeRootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme-id="graphite-signal" data-theme-preset="graphite-signal" data-theme-variant="dark" lang="en">
      <body className="appBody">{children}</body>
    </html>
  );
}
