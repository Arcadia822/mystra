export const defaultHostRuntimeStaleAfterSeconds = 180;

export class HostLivenessRegistry {
  readonly #lastSeenByRunnerId = new Map<string, string>();

  markSeen(runnerId: string, at: Date): void {
    this.#lastSeenByRunnerId.set(runnerId, at.toISOString());
  }

  getLastSeen(runnerId: string): string | null {
    return this.#lastSeenByRunnerId.get(runnerId) ?? null;
  }
}

export function resolveRuntimeStatus(
  lastSeenAt: string | null,
  now: Date,
  staleAfterSeconds = defaultHostRuntimeStaleAfterSeconds,
): "online" | "offline" {
  if (lastSeenAt === null) {
    return "offline";
  }

  return now.getTime() - Date.parse(lastSeenAt) <= staleAfterSeconds * 1_000
    ? "online"
    : "offline";
}
