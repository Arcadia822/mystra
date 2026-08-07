"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface RegisteredShellRightPanel {
  ariaLabel: string;
  content: ReactNode;
  header: ReactNode;
  id: string;
}

interface ShellRightPanelRegistry {
  register: (panel: RegisteredShellRightPanel) => void;
  unregister: (id: string) => void;
}

const ShellRightPanelContext = createContext<ShellRightPanelRegistry | null>(null);

export function ShellRightPanelProvider({
  children,
}: {
  children: (rightPanel: RegisteredShellRightPanel | null) => ReactNode;
}) {
  const [rightPanel, setRightPanel] = useState<RegisteredShellRightPanel | null>(null);
  const register = useCallback((panel: RegisteredShellRightPanel) => setRightPanel(panel), []);
  const unregister = useCallback((id: string) => {
    setRightPanel((current) => current?.id === id ? null : current);
  }, []);
  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <ShellRightPanelContext.Provider value={registry}>
      {children(rightPanel)}
    </ShellRightPanelContext.Provider>
  );
}

export function ShellRightPanel({
  ariaLabel,
  children,
  header,
}: {
  ariaLabel: string;
  children: ReactNode;
  header: ReactNode;
}) {
  const registry = useContext(ShellRightPanelContext);
  const id = useId();

  if (!registry) throw new Error("ShellRightPanel must render inside AppShell");

  useEffect(() => {
    registry.register({ ariaLabel, content: children, header, id });
  }, [ariaLabel, children, header, id, registry]);

  useEffect(() => () => registry.unregister(id), [id, registry]);

  return null;
}
