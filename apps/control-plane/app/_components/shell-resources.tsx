"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { TaskWorkbenchPage } from "@mystra/shared";
import type { ResourceState } from "../_lib/use-resource";

export type ShellTasksResource = ResourceState<TaskWorkbenchPage>;

const ShellTasksContext = createContext<ShellTasksResource | null>(null);

export function ShellTasksProvider({ children, resource }: { children: ReactNode; resource: ShellTasksResource }) {
  return <ShellTasksContext.Provider value={resource}>{children}</ShellTasksContext.Provider>;
}

export function useShellTasks(): ShellTasksResource {
  const resource = useContext(ShellTasksContext);
  if (!resource) throw new Error("useShellTasks must be used within AppShell.");
  return resource;
}
