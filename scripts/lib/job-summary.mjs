export const defaults = {
  controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
  timeoutSeconds: Number(process.env.MYSTRA_WAIT_TIMEOUT_SECONDS ?? 1800),
  pollSeconds: Number(process.env.MYSTRA_POLL_SECONDS ?? 5),
};

const successTerminalStatus = "succeeded";

export function parseArgs(argv, { booleanFlags = [] } = {}) {
  const out = {};
  const booleans = new Set(booleanFlags);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      throw new Error(`Invalid argument: ${key ?? "<missing>"}`);
    }

    const normalizedKey = key.slice(2);
    if (booleans.has(normalizedKey)) {
      out[normalizedKey] = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`Missing value for --${normalizedKey}`);
    }
    out[normalizedKey] = value;
    index += 1;
  }
  return out;
}

export async function readJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

export async function fetchJobSummary(controlPlaneUrl, jobId) {
  const url = new URL(`/api/jobs/${encodeURIComponent(jobId)}/summary`, controlPlaneUrl);
  const response = await fetch(url);
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};

  if (response.status === 404 && payload?.error === "job_not_found") {
    return { kind: "not_found", payload };
  }
  if (!response.ok) {
    throw new Error(`GET ${url} failed ${response.status}: ${text}`);
  }

  return { kind: "ok", payload };
}

export function exitCodeForSummary(summary) {
  return summary.terminal?.status === successTerminalStatus ? 0 : 1;
}

export function parsePositiveNumber(value, flagName, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${flagName} must be a positive number`);
  }
  return parsed;
}

export async function waitForJobSummary({
  controlPlaneUrl,
  jobId,
  pollSeconds = defaults.pollSeconds,
  timeoutSeconds = defaults.timeoutSeconds,
  onUpdate,
}) {
  const startedAt = Date.now();
  let lastMarker;

  while (true) {
    const result = await fetchJobSummary(controlPlaneUrl, jobId);
    if (result.kind !== "ok") {
      return result;
    }

    const marker = JSON.stringify({
      runState: result.payload.summary.runState,
      phase: result.payload.summary.phase,
      currentNodeId: result.payload.summary.currentNodeId ?? null,
      milestoneKey: result.payload.summary.milestone.key,
    });
    if (marker !== lastMarker) {
      lastMarker = marker;
      onUpdate?.(result.payload.summary);
    }

    if (result.payload.summary.phase === "terminal") {
      return result;
    }

    if ((Date.now() - startedAt) / 1000 > timeoutSeconds) {
      return { kind: "timeout" };
    }

    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }
}
