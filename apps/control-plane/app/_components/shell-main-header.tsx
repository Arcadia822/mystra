"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { UiBreadcrumbItem } from "@mystra/ui";

export interface RegisteredShellMainHeader {
  actions?: ReactNode;
  breadcrumbItems?: readonly UiBreadcrumbItem[];
  id: string;
  title?: ReactNode;
}

interface ShellMainHeaderRegistry {
  register: (header: RegisteredShellMainHeader) => void;
  unregister: (id: string) => void;
}

const ShellMainHeaderContext = createContext<ShellMainHeaderRegistry | null>(null);

export function ShellMainHeaderProvider({ children }: { children: (header: RegisteredShellMainHeader | null) => ReactNode }) {
  const [header, setHeader] = useState<RegisteredShellMainHeader | null>(null);
  const register = useCallback((next: RegisteredShellMainHeader) => setHeader(next), []);
  const unregister = useCallback((id: string) => setHeader((current) => current?.id === id ? null : current), []);
  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);
  return <ShellMainHeaderContext.Provider value={registry}>{children(header)}</ShellMainHeaderContext.Provider>;
}

export function ShellMainHeader({ actions, breadcrumbItems, title }: Omit<RegisteredShellMainHeader, "id">) {
  const registry = useContext(ShellMainHeaderContext);
  const id = useId();
  if (!registry) throw new Error("ShellMainHeader must render inside AppShell");
  useEffect(() => {
    registry.register({ id, ...(actions ? { actions } : {}), ...(breadcrumbItems ? { breadcrumbItems } : {}), ...(title ? { title } : {}) });
  }, [actions, breadcrumbItems, id, registry, title]);
  useEffect(() => () => registry.unregister(id), [id, registry]);
  return null;
}
