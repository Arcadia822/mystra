#!/usr/bin/env node
/**
 * Feature 060 T012 harness: publish the Mystra flow presets to a real Control
 * Plane and read them back.
 *
 * Two targets:
 *   - local (default): boots the real production server bundle on a throwaway
 *     SQLite database and registers a throwaway operator.
 *   - external (`--control-plane-url` + `--session-token`): runs the same checks
 *     against an already-running Mystra, so a deployed host can be verified
 *     without standing up a second server.
 *
 * Nothing about the publish path is stubbed in either mode: the presets go out
 * through the canonical management API and are read back from the same API.
 *
 * Scope: Agent Profiles. Skill publication additionally needs a reachable
 * S3-compatible endpoint with valid credentials; pass `--with-skills` once one
 * is provisioned.
 *
 * Usage:
 *   node scripts/e2e-publish-presets.mjs [--with-skills] [--port <n>]
 *   node scripts/e2e-publish-presets.mjs --control-plane-url http://host:3000 --session-token <token>
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { publishPresets, readAgentPresets } from "./publish-presets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const controlPlaneDir = path.join(repoRoot, "apps/control-plane");
const requireFromControlPlane = createRequire(path.join(controlPlaneDir, "package.json"));

const argv = process.argv.slice(2);
const withSkills = argv.includes("--with-skills");
const flagValue = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const externalUrl = flagValue("--control-plane-url");
const externalToken = flagValue("--session-token");
const PORT = Number(flagValue("--port") ?? 3471);

const SERVER_ENV = {
  NODE_ENV: "production",
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
  MYSTRA_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
  MYSTRA_SKILL_STORAGE_ENDPOINT: "https://s3.publish-presets.test",
  MYSTRA_SKILL_STORAGE_REGION: "us-east-1",
  MYSTRA_SKILL_STORAGE_BUCKET: "publish-presets",
  MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID: "publish-presets-access",
  MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY: "publish-presets-secret",
};

const results = [];
let serverProcess;
let workspaceDir;

function record(name, detail, ok = true) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(target, method, pathname, options = {}) {
  const url = new URL(pathname, target);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        host: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        // Fresh socket per request: pooled keep-alive sockets race the server's
        // connection: close and surface as spurious ECONNRESET.
        agent: false,
        method,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitFor(predicate, { timeoutMs = 60_000, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(20);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function bootstrapSchema(databasePath) {
  const migrationsDir = path.join(controlPlaneDir, "prisma/sqlite/migrations");
  const names = readdirSync(migrationsDir)
    .filter((name) => statSync(path.join(migrationsDir, name)).isDirectory())
    .sort();
  const Database = requireFromControlPlane("better-sqlite3");
  const database = new Database(databasePath);
  for (const name of names) {
    database.exec(readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  }
  database.close();
  return names.length;
}

/** Local mode boots the real production bundle; external mode uses a running server. */
async function resolveTarget() {
  if (externalUrl) {
    if (!externalToken) throw new Error("--control-plane-url requires --session-token");
    const baseUrl = new URL(externalUrl);
    const health = await request(baseUrl, "GET", "/api/agents", { token: externalToken });
    if (health.status !== 200) {
      throw new Error(`external control plane rejected the session: ${health.status} ${health.text.slice(0, 200)}`);
    }
    record("external control plane reachable", { url: baseUrl.origin, agents: (health.json?.agents ?? []).length });
    return { baseUrl, sessionToken: externalToken, local: false };
  }

  const serverBundle = path.join(controlPlaneDir, "dist/server.js");
  if (!existsSync(serverBundle)) {
    throw new Error(`Missing ${serverBundle}. Build it first: pnpm --filter @mystra/control-plane run build:server`);
  }
  const databasePath = path.join(workspaceDir, "mystra.db");
  record("schema bootstrap", { migrations: bootstrapSchema(databasePath) });

  serverProcess = spawn(process.execPath, ["dist/server.js"], {
    cwd: controlPlaneDir,
    env: { ...process.env, ...SERVER_ENV, MYSTRA_DB_PATH: databasePath },
  });
  let serverLog = "";
  serverProcess.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  await waitFor(() => serverLog.includes("ready on http"), { label: "server readiness" });
  const baseUrl = new URL(`http://127.0.0.1:${PORT}`);
  record("production server start", { port: PORT, bundle: "apps/control-plane/dist/server.js" });

  const username = `t012_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const registration = await request(baseUrl, "POST", "/api/auth/register", {
    body: { username, password: "T012-Harness-Passw0rd" },
  });
  if (registration.status !== 201) throw new Error(`registration failed: ${registration.status} ${registration.text}`);
  const cookieHeader = (registration.headers["set-cookie"] ?? []).join("; ");
  const tokenMatch = /mystra_session=([A-Za-z0-9_-]{16,})/u.exec(cookieHeader);
  if (!tokenMatch) throw new Error("registration did not return a session cookie");
  record("operator registration and session", { username });
  return { baseUrl, sessionToken: tokenMatch[1], local: true };
}

async function main() {
  workspaceDir = mkdtempSync(path.join(tmpdir(), "mystra-060-t012-"));
  const target = await resolveTarget();

  // The publisher reads the same operator session store the CLI writes, so the
  // harness supplies it in that exact format rather than a private one.
  const sessionStore = {
    read: async () => ({ controlPlaneUrl: target.baseUrl.origin, sessionToken: target.sessionToken }),
  };

  const first = await publishPresets({ sessionStore, only: "agents" });
  record("publish creates both Agent Profiles", {
    agents: first.agents.map((entry) => `${entry.name}:${entry.outcome}`),
  }, first.agents.every((entry) => ["created", "unchanged"].includes(entry.outcome)) && first.agents.length === 2);

  const second = await publishPresets({ sessionStore, only: "agents" });
  record("re-publish is a no-op", {
    agents: second.agents.map((entry) => `${entry.name}:${entry.outcome}`),
  }, second.agents.every((entry) => entry.outcome === "unchanged"));

  const listed = await request(target.baseUrl, "GET", "/api/agents", { token: target.sessionToken });
  const stored = new Map((listed.json?.agents ?? []).map((agent) => [agent.name, agent]));
  const expected = readAgentPresets();
  record("read-back matches the preset bytes", {
    names: [...stored.keys()].sort(),
    revisions: [...stored.values()].map((agent) => agent.revision),
  }, expected.every((agent) => stored.get(agent.name)?.systemPrompt === agent.systemPrompt)
    && expected.length === stored.size);

  // A drifted preset must publish a new revision rather than silently pass.
  const driftedRoot = path.join(workspaceDir, "drifted-presets");
  mkdirSync(path.join(driftedRoot, "agents"), { recursive: true });
  for (const agent of expected) {
    const body = agent.name === "coordinator" ? `${agent.systemPrompt}\n\nDRIFT PROBE\n` : agent.systemPrompt;
    writeFileSync(path.join(driftedRoot, "agents", `${agent.name}.md`), body);
  }
  const before = stored.get("coordinator")?.revision;
  const third = await publishPresets({ sessionStore, only: "agents", presetsRoot: driftedRoot });
  const thirdOutcomes = third.agents.map((entry) => `${entry.name}:${entry.outcome}`).sort();
  record("drifted preset publishes a new revision", { agents: thirdOutcomes }, (
    thirdOutcomes.includes("coordinator:updated") && thirdOutcomes.includes("requirement-designer:unchanged")
  ));

  const revised = await request(target.baseUrl, "GET", "/api/agents", { token: target.sessionToken });
  const coordinator = (revised.json?.agents ?? []).find((agent) => agent.name === "coordinator");
  record("revision advanced and new text persisted", {
    before,
    after: coordinator?.revision,
    hasProbe: coordinator?.systemPrompt.includes("DRIFT PROBE"),
  }, coordinator?.revision === before + 1 && coordinator?.systemPrompt.includes("DRIFT PROBE"));

  // Restore the canonical text so the target is left matching `presets/`.
  const restored = await publishPresets({ sessionStore, only: "agents" });
  const restoredOutcomes = restored.agents.map((entry) => `${entry.name}:${entry.outcome}`).sort();
  record("canonical text restored", { agents: restoredOutcomes }, (
    restoredOutcomes.includes("coordinator:updated") && restoredOutcomes.includes("requirement-designer:unchanged")
  ));

  const settled = await request(target.baseUrl, "GET", "/api/agents", { token: target.sessionToken });
  const settledCoordinator = (settled.json?.agents ?? []).find((agent) => agent.name === "coordinator");
  const canonical = expected.find((agent) => agent.name === "coordinator").systemPrompt;
  record("target left matching presets/", {
    revision: settledCoordinator?.revision,
    matchesPreset: settledCoordinator?.systemPrompt === canonical,
  }, settledCoordinator?.systemPrompt === canonical);

  if (withSkills) {
    const skills = await publishPresets({ sessionStore, only: "skills" });
    const skillEntries = skills.skills ?? [];
    const skillOk = skillEntries.length > 0
      && skillEntries.every((entry) => ["created", "published", "unchanged"].includes(entry.outcome));
    record("skill publish", { skills: skillEntries }, skillOk);
  }

  const report = {
    executedAt: new Date().toISOString(),
    node: process.version,
    target: { url: target.baseUrl.origin, mode: target.local ? "local" : "external" },
    withSkills,
    checks: results,
    passed: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
  };
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  writeFileSync(path.join(workspaceDir, "t012-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.join(workspaceDir, "t012-report.json")}`);
  return report.failed === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error(`HARNESS ERROR: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (serverProcess) serverProcess.kill("SIGTERM");
  if (workspaceDir && exitCode === 0) rmSync(workspaceDir, { recursive: true, force: true });
  else if (workspaceDir) console.error(`Workspace kept for inspection: ${workspaceDir}`);
}
process.exit(exitCode);
