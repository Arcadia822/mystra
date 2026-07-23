type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type SleepLike = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export interface PreviewProbeOptions {
  fetchImpl?: FetchLike;
  sleepImpl?: SleepLike;
  maxAttempts?: number;
  intervalMs?: number;
  requiredConsecutive?: number;
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      resolve();
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function probePreview(
  url: string,
  signal: AbortSignal,
  options: PreviewProbeOptions = {},
): Promise<number> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 500;
  const requiredConsecutive = options.requiredConsecutive ?? 2;
  let consecutive = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal.aborted) {
      throw new Error("Preview probe aborted");
    }
    try {
      const response = await fetchImpl(url, { signal });
      consecutive = response.ok ? consecutive + 1 : 0;
      if (consecutive >= requiredConsecutive) {
        return consecutive;
      }
    } catch {
      consecutive = 0;
    }
    await sleepImpl(intervalMs, signal);
  }
  throw new Error(`Preview did not become reachable at ${url}`);
}
