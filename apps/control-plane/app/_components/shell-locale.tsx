"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ShellLocale } from "./shell-copy";

const ShellLocaleContext = createContext<ShellLocale>("en");

export function ShellLocaleProvider({ children, locale }: { children: ReactNode; locale: ShellLocale }) {
  return <ShellLocaleContext.Provider value={locale}>{children}</ShellLocaleContext.Provider>;
}

export function useShellLocale(): ShellLocale {
  return useContext(ShellLocaleContext);
}
