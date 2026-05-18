#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const command = argv[0] ?? "list";
const target = argv[1];
const previewHost = process.env.MYSTRA_PREVIEW_HOST ?? detectPreviewHost();
const proxyMappings = readProxyMappings();

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout ?? "").trim();
}

function detectPreviewHost() {
  const result = spawnSync("node", [
    "-e",
    "const os=require('os'); for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family==='IPv4' && !a.internal) { console.log(a.address); process.exit(0); } console.log('localhost')",
  ], { encoding: "utf8" });
  return result.stdout.trim() || "localhost";
}

function readProxyMappings() {
  const result = spawnSync("sh", ["-lc", "test -f /tmp/mystra-preview-proxy.py && sed -n '1,40p' /tmp/mystra-preview-proxy.py || true"], {
    encoding: "utf8",
  });
  const mappings = new Map();
  const pattern = /\("0\.0\.0\.0",\s*(\d+),\s*"127\.0\.0\.1",\s*(\d+)\)/g;
  let match;
  while ((match = pattern.exec(result.stdout)) !== null) {
    mappings.set(match[2], match[1]);
  }
  return mappings;
}

function mystraContainers() {
  const output = runDocker([
    "ps",
    "-a",
    "--filter",
    "name=^/mystra-",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}",
  ]);
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, name, status, ports = ""] = line.split("\t");
      return { id, name, status, ports };
    });
}

function publishedPort(ports, containerPort) {
  const match = ports.match(new RegExp(`(0\\.0\\.0\\.0|127\\.0\\.0\\.1|\\[::\\]):(\\d+)->${containerPort}/tcp`));
  if (!match) {
    return null;
  }
  return { bindAddress: match[1], port: match[2] };
}

function previewUrls(portInfo) {
  if (!portInfo) {
    return { localUrl: null, remoteUrl: null };
  }
  const localUrl = `http://localhost:${portInfo.port}`;
  const proxyPort = proxyMappings.get(portInfo.port);
  const remoteUrl = proxyPort
    ? `http://${previewHost}:${proxyPort}`
    : portInfo.bindAddress === "127.0.0.1"
      ? null
      : `http://${previewHost}:${portInfo.port}`;
  return { localUrl, remoteUrl };
}

function list() {
  const containers = mystraContainers();
  if (containers.length === 0) {
    console.log("No Mystra preview containers.");
    return;
  }

  for (const container of containers) {
    const frontend = publishedPort(container.ports, 3000);
    const backend = publishedPort(container.ports, 8000);
    const frontendUrls = previewUrls(frontend);
    const backendUrls = previewUrls(backend);
    console.log(JSON.stringify({
      name: container.name,
      id: container.id,
      status: container.status,
      frontendLocalUrl: frontendUrls.localUrl,
      frontendRemoteUrl: frontendUrls.remoteUrl,
      backendLocalUrl: backendUrls.localUrl,
      backendRemoteUrl: backendUrls.remoteUrl,
      remoteReachable: Boolean(frontendUrls.remoteUrl || backendUrls.remoteUrl),
      ports: container.ports,
    }, null, 2));
  }
}

function stop(nameOrAll) {
  const containers = mystraContainers();
  const selected = nameOrAll === "--all"
    ? containers
    : containers.filter((container) => container.name === nameOrAll || container.id.startsWith(nameOrAll ?? ""));

  if (selected.length === 0) {
    throw new Error(nameOrAll ? `No Mystra container matched ${nameOrAll}` : "Usage: preview-containers.mjs stop <container|--all>");
  }

  for (const container of selected) {
    runDocker(["rm", "-f", container.id], { stdio: "inherit" });
    cleanupRunContextBundles(container.name);
    console.error(`stopped ${container.name}`);
  }
}

function cleanupRunContextBundles(containerName) {
  const runId = containerName.startsWith("mystra-") ? containerName.slice("mystra-".length) : null;
  if (!runId) {
    return;
  }

  const cacheRoot = process.env.MYSTRA_CACHE_ROOT ?? path.join(process.env.HOME ?? "/tmp", ".mystra", "cache");
  const bundleRoot = path.join(cacheRoot, "context-bundles");
  let entries = [];
  try {
    entries = readdirSync(bundleRoot, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(`-${runId}`)) {
      continue;
    }
    rmSync(path.join(bundleRoot, entry.name), { recursive: true, force: true });
  }
}

function logs(name) {
  if (!name) {
    throw new Error("Usage: preview-containers.mjs logs <container>");
  }
  runDocker(["exec", name, "sh", "-lc", "printf '== frontend ==\\n'; tail -120 /mystra/workspace/frontend-preview.log 2>/dev/null || true; printf '\\n== backend ==\\n'; tail -120 /mystra/workspace/backend-preview.log 2>/dev/null || true"], {
    stdio: "inherit",
  });
}

function quality(name) {
  if (!name) {
    throw new Error("Usage: preview-containers.mjs quality <container>");
  }
  runDocker(["exec", name, "sh", "-lc", "tail -240 /mystra/workspace/quality-gate.log 2>/dev/null || true"], {
    stdio: "inherit",
  });
}

try {
  if (command === "list") {
    list();
  } else if (command === "stop") {
    stop(target);
  } else if (command === "logs") {
    logs(target);
  } else if (command === "quality") {
    quality(target);
  } else {
    throw new Error("Usage: preview-containers.mjs list|stop|logs|quality [container|--all]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
