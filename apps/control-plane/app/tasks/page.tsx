"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "../_components/states";
import { filterTasks } from "../_components/shell-model";
import { useShellTasks } from "../_components/shell-resources";
import { TaskTable } from "../_components/task-table";

export default function TasksPage() {
  const resource = useShellTasks();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterTasks(resource.data?.tasks ?? [], query), [query, resource.data?.tasks]);

  return (
    <div className="pageContent">
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.error ? (
        <TaskTable
          emptyDescription="Create a Task through API, CLI, MCP, or Issue dispatch."
          emptyTitle="No matching tasks"
          isLoading={resource.isLoading}
          onQueryChange={setQuery}
          onRefresh={() => void resource.refresh()}
          query={query}
          rows={filtered}
        />
      ) : null}
    </div>
  );
}
