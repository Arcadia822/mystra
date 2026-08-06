"use client";

import { useMemo, useState } from "react";

import { InboxMasterDetail } from "../_components/inbox-master-detail";
import { filterTasks, inboxTasks } from "../_components/shell-model";
import { useShellTasks } from "../_components/shell-resources";
import { ErrorState } from "../_components/states";

export default function InboxPage() {
  const resource = useShellTasks();
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => filterTasks(inboxTasks(resource.data?.tasks ?? []), query),
    [query, resource.data?.tasks],
  );

  return (
    <div className="inboxPage">
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.error ? (
        <InboxMasterDetail
          isLoading={resource.isLoading}
          onQueryChange={setQuery}
          onRefresh={() => void resource.refresh()}
          query={query}
          rows={rows}
        />
      ) : null}
    </div>
  );
}
