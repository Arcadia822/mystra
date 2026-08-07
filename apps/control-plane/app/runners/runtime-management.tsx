"use client";

import type { RuntimeView } from "@mystra/shared";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../_components/states";
import { controlPlaneRequest } from "../_lib/control-plane-api";
import { relativeTime } from "../_lib/format";
import { useResource } from "../_lib/use-resource";
import {
  availableProviders,
  type RuntimeRenameResponse,
  type RuntimesResponse,
} from "./runtime-management-model";

function RuntimeStatusBadge({ status }: { status: RuntimeView["status"] }) {
  return <span className={`statusBadge ${status === "online" ? "good" : "bad"}`}>{status}</span>;
}

function ProviderList({ runtime }: { runtime: RuntimeView }) {
  const providers = availableProviders(runtime);
  if (providers.length === 0) return <span className="quietCell">None available</span>;

  return (
    <span className="toolbarActions">
      {providers.map((provider) => (
        <span className="statusBadge good" key={provider.provider}>
          {provider.provider}{provider.version ? ` · ${provider.version}` : ""}
        </span>
      ))}
    </span>
  );
}

export function RuntimeManagement() {
  const resource = useResource<RuntimesResponse>("/api/runtimes", 5_000);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const runtimes = resource.data?.runtimes ?? [];
  const selectedRuntime = runtimes.find((runtime) => runtime.id === selectedRuntimeId) ?? null;

  useEffect(() => {
    if (selectedRuntimeId && !selectedRuntime) {
      setSelectedRuntimeId(null);
    }
  }, [selectedRuntime, selectedRuntimeId]);

  function startRename(runtime: RuntimeView) {
    setName(runtime.name);
    setRenameError(null);
    setIsRenaming(true);
  }

  async function renameRuntime(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRuntime) return;

    setIsSubmitting(true);
    setRenameError(null);
    try {
      await controlPlaneRequest<RuntimeRenameResponse>(
        `/api/runtimes/${encodeURIComponent(selectedRuntime.id)}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      setIsRenaming(false);
      await resource.refresh();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <p className="pageDescription">
          Runtimes are enrolled execution backends. Status is derived from the latest host heartbeat.
        </p>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>
          Refresh
        </button>
      </div>

      {resource.isLoading ? <LoadingState label="Loading runtimes" /> : null}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.isLoading && !resource.error && runtimes.length === 0 ? (
        <EmptyState
          title="No runtimes enrolled"
          description="Start mystra-runner on a host to register its Runtime and available Providers."
        />
      ) : null}
      {runtimes.length > 0 ? (
        <div className="detailStack">
          <section className="panel" aria-label="Enrolled runtimes">
            <div className="tableHeader runnerColumns">
              <span>Runtime</span><span>Type</span><span>Status</span><span>Available Providers</span><span />
            </div>
            <div className="dataList">
              {runtimes.map((runtime) => (
                <div className="dataRow runnerColumns" key={runtime.id}>
                  <span className="primaryCell">
                    <strong>{runtime.name}</strong>
                    <small className="mono">{runtime.id}</small>
                  </span>
                  <span>{runtime.type}</span>
                  <RuntimeStatusBadge status={runtime.status} />
                  <ProviderList runtime={runtime} />
                  <button
                    aria-pressed={selectedRuntimeId === runtime.id}
                    className="secondaryButton"
                    type="button"
                    onClick={() => setSelectedRuntimeId(runtime.id)}
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>
          </section>

          {selectedRuntime ? (
            <section className="panel" aria-labelledby="runtime-detail-heading">
              <div className="panelHeader">
                <div>
                  <h2 id="runtime-detail-heading">{selectedRuntime.name}</h2>
                  <span className="mono">{selectedRuntime.id}</span>
                </div>
                <div className="toolbarActions">
                  <RuntimeStatusBadge status={selectedRuntime.status} />
                  <button className="secondaryButton" type="button" onClick={() => startRename(selectedRuntime)}>
                    Rename runtime
                  </button>
                </div>
              </div>
              {isRenaming ? (
                <form className="formStack" onSubmit={renameRuntime}>
                  <label htmlFor="runtime-name">Runtime name</label>
                  <input
                    autoFocus
                    id="runtime-name"
                    maxLength={255}
                    minLength={1}
                    name="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  {renameError ? <p className="formError" role="alert">{renameError}</p> : null}
                  <div className="toolbarActions">
                    <button className="primaryButton" disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Saving…" : "Save name"}
                    </button>
                    <button
                      className="secondaryButton"
                      disabled={isSubmitting}
                      type="button"
                      onClick={() => setIsRenaming(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              <dl className="definitionList">
                <div><dt>Runtime id</dt><dd className="mono">{selectedRuntime.id}</dd></div>
                <div><dt>Runner id</dt><dd className="mono">{selectedRuntime.metadata.runnerId}</dd></div>
                <div><dt>Name</dt><dd>{selectedRuntime.name}</dd></div>
                <div><dt>Type</dt><dd>{selectedRuntime.type}</dd></div>
                <div><dt>Status</dt><dd><RuntimeStatusBadge status={selectedRuntime.status} /></dd></div>
                <div>
                  <dt>Last heartbeat</dt>
                  <dd>{selectedRuntime.lastSeenAt ? `${relativeTime(selectedRuntime.lastSeenAt)} · ${selectedRuntime.lastSeenAt}` : "Not received"}</dd>
                </div>
              </dl>
              <div className="panelHeader">
                <h2>Available Providers</h2>
              </div>
              <div className="dataList">
                {availableProviders(selectedRuntime).length > 0 ? availableProviders(selectedRuntime).map((provider) => (
                  <div className="dataRow compactRow" key={provider.provider}>
                    <span className="primaryCell">
                      <strong>{provider.provider}</strong>
                      <small className="mono">{provider.resolvedPath ?? "No resolved path"}</small>
                    </span>
                    <span className="statusBadge good">{provider.version ?? "Available"}</span>
                  </div>
                )) : (
                  <EmptyState title="No Providers available" description="The Runtime has not reported an available Provider." />
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
