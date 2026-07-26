#!/usr/bin/env node

const args = process.argv.slice(2);
let target = "overview";
let id;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--target") {
    target = args[index + 1];
    index += 1;
  } else if (arg === "--id") {
    id = args[index + 1];
    index += 1;
  } else {
    process.stderr.write(`Unknown argument: ${arg}\n`);
    process.exit(2);
  }
}

if (!["overview", "runner", "task"].includes(target)) {
  process.stderr.write(`Unsupported target: ${target}\n`);
  process.exit(2);
}

if (target !== "overview" && !id) {
  process.stderr.write(`--id is required for target ${target}\n`);
  process.exit(2);
}

const baseUrl = new URL(
  process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://127.0.0.1:3000",
);
const path = target === "overview"
  ? "/"
  : target === "runner"
    ? `/runners/${encodeURIComponent(id)}`
    : `/tasks/${encodeURIComponent(id)}`;
const targetUrl = new URL(path, baseUrl);

try {
  const response = await fetch(new URL("/api/control-plane", baseUrl), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new Error(`health check returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.controlPlane?.status) {
    throw new Error("health check returned an invalid control-plane response");
  }
  process.stdout.write(`${JSON.stringify({
    browserHandoff: {
      url: targetUrl.href,
      openStrategy: "codex-internal-browser",
      target,
      ...(id ? { id } : {}),
    },
    controlPlane: {
      status: payload.controlPlane.status,
      checkedAt: payload.controlPlane.checkedAt,
    },
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `Mystra control plane is unavailable at ${baseUrl.origin}: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
