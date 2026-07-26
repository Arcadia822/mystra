const ACTIVE_STATES = new Set(["assigned", "starting", "running"]);
const TERMINAL_STATES = new Set([
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
]);

export function relativeTime(value?: string): string {
  if (!value) return "unknown";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function stateTone(state: string): "good" | "warning" | "bad" | "active" | "muted" {
  if (["succeeded", "waiting_for_review"].includes(state)) return "good";
  if (["failed", "canceled", "timed_out"].includes(state)) return "bad";
  if (ACTIVE_STATES.has(state)) return "active";
  if (state === "queued") return "warning";
  return "muted";
}

export function isTerminalState(state: string): boolean {
  return TERMINAL_STATES.has(state);
}

export function runnerStatus(
  lastHeartbeatAt: string,
  staleAfterSeconds: number,
): "online" | "stale" {
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  return ageMs <= staleAfterSeconds * 1_000 ? "online" : "stale";
}

export function taskLabel(taskId: string, issueIdentifier?: string): string {
  return issueIdentifier ?? taskId;
}
