"use client";

import { useMemo, useState } from "react";
import type { Project } from "@mystra/shared";

import { ErrorState } from "../_components/states";
import { filterTasks } from "../_components/shell-model";
import { useShellTasks } from "../_components/shell-resources";
import { TaskTable } from "../_components/task-table";
import { useResource } from "../_lib/use-resource";

export default function TasksPage() {
  const resource = useShellTasks();
  const [query, setQuery] = useState("");
  const projects = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const projectNames = useMemo(() => new Map((projects.data?.projects ?? []).map((project) => [project.id, project.name])), [projects.data?.projects]);
  const filtered = useMemo(() => filterTasks(resource.data?.tasks ?? [], query), [query, resource.data?.tasks]);

  return (
    <div className="pageContent">
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.error ? (
        <TaskTable
          emptyDescription="Create a Task through the Web client, API, CLI, or MCP."
          emptyTitle="No matching tasks"
          isLoading={resource.isLoading}
          onQueryChange={setQuery}
          onRefresh={() => void resource.refresh()}
          query={query}
          rows={filtered}
          projectNames={projectNames}
        />
      ) : null}
    </div>
  );
}
