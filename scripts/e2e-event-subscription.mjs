#!/usr/bin/env node
/**
 * Feature 058 end-to-end harness.
 *
 * Runs the real production Control Plane server bundle and the real
 * `mystra-agent` binary, then drives an Integration webhook through the unified
 * ingress to an online subscription. Nothing is stubbed: the Linear and GitHub
 * connections are created through the real management API with real
 * credentials, and the Issue source binding is resolved against the real Linear
 * GraphQL API.
 *
 * Linear itself is read-only here: the harness never mutates Linear data. The
 * webhook POST is issued locally with a Linear-schema payload, so this run
 * proves the Mystra chain, not Linear-originated delivery.
 *
 * Usage:
 *   node scripts/e2e-event-subscription.mjs [--keep] [--port <n>]
 *
 * Requires LINEAR_API_KEY and GITHUB_PAT in the environment.
 * Residual-subscription accounting after SIGTERM (SC-010) is covered by
 * `apps/control-plane/src/lib/events/ws-transport.test.ts`, not by this harness,
 * because the server exposes no subscription-count endpoint.
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const controlPlaneDir = path.join(repoRoot, "apps/control-plane");
const cliBin = path.join(repoRoot, "packages/agent-cli/bin/mystra-agent");
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const requireFromControlPlane = createRequire(path.join(controlPlaneDir, "package.json"));

const argv = process.argv.slice(2);
const keep = argv.includes("--keep");
const portIndex = argv.indexOf("--port");
const PORT = portIndex >= 0 ? Number(argv[portIndex + 1]) : 3457;
const SERVER_ENV = {
  NODE_ENV: "production",
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
  MYSTRA_PUBLIC_URL: "https://e2e.mystra.test",
  MYSTRA_SKILL_STORAGE_ENDPOINT: "https://s3.e2e.test",
  MYSTRA_SKILL_STORAGE_REGION: "us-east-1",
  MYSTRA_SKILL_STORAGE_BUCKET: "e2e-bucket",
  MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID: "e2e-access-key",
  MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY: "e2e-secret-key",
};

const results = [];
let serverProcess;
let workspaceDir;
let sessionToken;
let teamId;
let projectId;
let linearConnectionId;
let endpointId;
const cliChildren = new Set();

function record(name, detail, ok = true) {
  results.push({ name, ok, detail });
  const suffix = detail === undefined ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${suffix}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        // A fresh socket per request: pooled keep-alive sockets race with the
        // server's connection: close and surface as spurious ECONNRESET.
        agent: false,
        method,
        path: pathname,
        headers: {
          ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          ...(options.headers ?? {}),
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

/**
 * Attempts a WebSocket Upgrade and reports the HTTP status without completing
 * the handshake. Transport failures are reported, never thrown, so one
 * unexpected case cannot abort the whole credential matrix.
 */
function upgradeStatus(pathname, { token, subprotocol = "mystra.events.v1" } = {}) {
  return new Promise((resolve) => {
    const req = http.request({
      host: "127.0.0.1",
      port: PORT,
      agent: false,
      method: "GET",
      path: pathname,
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        // RFC 6455 requires a 16-byte nonce; ws rejects any other length.
        "sec-websocket-key": randomBytes(16).toString("base64"),
        ...(subprotocol ? { "sec-websocket-protocol": subprotocol } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode });
    });
    req.on("response", (res) => {
      res.resume();
      resolve({ status: res.statusCode });
    });
    req.on("error", (error) => resolve({ status: null, error: error.code ?? error.message }));
    req.end();
  });
}

function startCli(args) {
  const child = spawn(process.execPath, [cliBin, ...args], { cwd: repoRoot, env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  cliChildren.add(child);
  return {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    done: new Promise((resolve) => child.on("close", (code) => resolve(code))),
  };
}

async function waitFor(predicate, { timeoutMs = 15_000, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(20);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function linearGraphql(query, variables) {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: { authorization: requireEnv("LINEAR_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors) throw new Error(`Linear GraphQL failed: ${JSON.stringify(body.errors)}`);
  return body.data;
}

function linearIssueBody({ from, to, issue, teamId, organizationId, createdAt }) {
  return {
    action: "update",
    type: "Issue",
    url: `https://linear.app/castrel/issue/${issue.identifier}`,
    createdAt,
    organizationId,
    webhookId: "e2e-webhook-id",
    updatedFrom: from,
    data: {
      id: issue.id,
      identifier: issue.identifier,
      teamId,
      stateId: to,
      title: "E2E subject",
    },
  };
}

function linearHeaders(deliveryId) {
  return {
    "content-type": "application/json",
    "linear-delivery": deliveryId,
    "linear-event": "Issue",
  };
}

function postWebhook(token, headers, body) {
  return request("POST", `/api/webhooks?token=${encodeURIComponent(token)}`, { headers, body });
}

async function bootstrapSchema(databasePath) {
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

async function main() {
  const migrationCount = await runPhases();
  const report = {
    executedAt: new Date().toISOString(),
    node: process.version,
    port: PORT,
    migrations: migrationCount,
    projectId,
    endpointId,
    checks: results,
    passed: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
  };
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  if (workspaceDir) {
    writeFileSync(path.join(workspaceDir, "e2e-report.json"), JSON.stringify(report, null, 2));
    console.log(`\nReport: ${path.join(workspaceDir, "e2e-report.json")}`);
  }
  return report.failed === 0 ? 0 : 1;
}

async function runPhases() {
  const serverBundle = path.join(controlPlaneDir, "dist/server.js");
  if (!existsSync(serverBundle)) {
    throw new Error(
      `Missing ${serverBundle}. Build it first: pnpm --filter @mystra/control-plane build`,
    );
  }
  const linearKey = requireEnv("LINEAR_API_KEY");
  const githubPat = requireEnv("GITHUB_PAT");

  workspaceDir = mkdtempSync(path.join(tmpdir(), "mystra-058-e2e-"));
  const databasePath = path.join(workspaceDir, "mystra.db");
  const migrationCount = await bootstrapSchema(databasePath);
  record("schema bootstrap", { migrations: migrationCount, databasePath });

  serverProcess = spawn(process.execPath, ["dist/server.js"], {
    cwd: controlPlaneDir,
    env: { ...process.env, ...SERVER_ENV, MYSTRA_DB_PATH: databasePath },
  });
  let serverLog = "";
  serverProcess.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  await waitFor(() => serverLog.includes("ready on http"), { label: "server readiness", timeoutMs: 60_000 });
  record("production server start", { nodeEnv: "production", port: PORT, bundle: "apps/control-plane/dist/server.js" });

  const username = `e2e_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const registration = await request("POST", "/api/auth/register", {
    body: { username, password: "E2e-Harness-Passw0rd" },
  });
  if (registration.status !== 201) throw new Error(`registration failed: ${registration.status} ${registration.text}`);
  const cookieHeader = (registration.headers["set-cookie"] ?? []).join("; ");
  const tokenMatch = /mystra_session=([A-Za-z0-9_-]{16,})/u.exec(cookieHeader);
  if (!tokenMatch) throw new Error("registration did not return a session cookie");
  sessionToken = tokenMatch[1];
  const teams = await request("GET", "/api/teams", { token: sessionToken });
  teamId = teams.json?.teams?.[0]?.id;
  if (!teamId) throw new Error(`team listing failed: ${teams.status} ${teams.text}`);
  record("operator registration and session", { username, teamId });

  const linearConnection = await request("POST", "/api/integration-connections/linear/api-key", {
    token: sessionToken,
    body: { apiKey: linearKey, displayName: "E2E Castrel" },
  });
  if (linearConnection.status >= 300) throw new Error(`linear connection failed: ${linearConnection.status} ${linearConnection.text}`);
  linearConnectionId = linearConnection.json.connection.id;
  record("real Linear connection via management API", { connectionId: linearConnectionId, status: linearConnection.status });

  const linearOrganizationId = (await linearGraphql("{ organization { id } }")).organization.id;

  const githubConnection = await request("POST", "/api/integration-connections/github/pat", {
    token: sessionToken,
    body: { token: githubPat, displayName: "E2E GitHub" },
  });
  if (githubConnection.status >= 300) throw new Error(`github connection failed: ${githubConnection.status} ${githubConnection.text}`);
  const githubConnectionId = githubConnection.json.connection.id;
  const repositories = await request("GET", "/api/integrations/github/repositories", { token: sessionToken });
  const repository = repositories.json?.items?.[0];
  if (!repository) throw new Error(`repository listing failed: ${repositories.status} ${repositories.text}`);
  const projectSlug = `e2e-058-${randomUUID().slice(0, 8)}`;
  const project = await request("POST", "/api/projects", {
    token: sessionToken,
    body: {
      name: `E2E 058 ${projectSlug}`,
      slug: projectSlug,
      repositoryConnectionId: githubConnectionId,
      repositoryExternalId: repository.externalId ?? repository.id,
      repositoryBaseBranch: repository.defaultBranch ?? "main",
    },
  });
  if (project.status !== 201) throw new Error(`project create failed: ${project.status} ${project.text}`);
  projectId = project.json.project.id;
  record("real GitHub connection and Project", { githubConnectionId, projectId, repository: repository.fullName ?? repository.name });

  const linearTeams = (await linearGraphql("{ teams(first: 50) { nodes { id key name } } }")).teams.nodes;
  const linearTeam = linearTeams.find((team) => team.key === "MYST") ?? linearTeams[0];
  const source = await request("PUT", `/api/projects/${projectSlug}/issue-sources/linear`, {
    token: sessionToken,
    body: { connectionId: linearConnectionId, linearTeamExternalId: linearTeam.id },
  });
  if (source.status !== 200) throw new Error(`issue source binding failed: ${source.status} ${source.text}`);
  record("Linear issue source binding via real API", { linearTeamId: linearTeam.id, linearTeamKey: linearTeam.key });

  const secondSlug = `${projectSlug}-b`;
  const secondProject = await request("POST", "/api/projects", {
    token: sessionToken,
    body: {
      name: `E2E 058 ${secondSlug}`,
      slug: secondSlug,
      repositoryConnectionId: githubConnectionId,
      repositoryExternalId: repository.externalId ?? repository.id,
      repositoryBaseBranch: repository.defaultBranch ?? "main",
    },
  });
  if (secondProject.status !== 201) throw new Error(`second project create failed: ${secondProject.status} ${secondProject.text}`);
  const conflict = await request("PUT", `/api/projects/${secondSlug}/issue-sources/linear`, {
    token: sessionToken,
    body: { connectionId: linearConnectionId, linearTeamExternalId: linearTeam.id },
  });
  record(
    "reverse-unique scope conflict returns 409",
    { status: conflict.status, code: conflict.json?.error?.code },
    conflict.status === 409 && conflict.json?.error?.code === "ISSUE_SOURCE_SCOPE_CONFLICT",
  );
  const preserved = await request("GET", `/api/projects/${projectSlug}/issue-sources`, { token: sessionToken });
  record(
    "original binding preserved after conflict",
    { linearTeamExternalId: preserved.json?.linear?.linearTeamExternalId },
    preserved.json?.linear?.linearTeamExternalId === linearTeam.id,
  );

  const webhook1 = await request("GET", `/api/integration-connections/${linearConnectionId}/webhook`, { token: sessionToken });
  const webhook2 = await request("GET", `/api/integration-connections/${linearConnectionId}/webhook`, { token: sessionToken });
  if (webhook1.status !== 200) throw new Error(`webhook read failed: ${webhook1.status} ${webhook1.text}`);
  endpointId = webhook1.json.endpoint.id;
  record(
    "stable trusted-origin webhook URL",
    { webhookUrl: webhook1.json.webhookUrl, repeatedIdentical: webhook1.json.webhookUrl === webhook2.json.webhookUrl },
    webhook1.json.webhookUrl === `https://e2e.mystra.test/api/webhooks?token=${endpointId}`,
  );

  const sessionFile = path.join(workspaceDir, "operator-session.json");
  writeFileSync(sessionFile, JSON.stringify({ version: 1, controlPlaneUrl: `http://127.0.0.1:${PORT}`, sessionToken }), { mode: 0o600 });
  chmodSync(sessionFile, 0o600);

  const catalogRun = startCli(["events", "list", "--team", teamId, "--session-file", sessionFile]);
  const catalogExit = await catalogRun.done;
  const catalog = JSON.parse(catalogRun.stdout().trim().split("\n").pop() ?? "{}");
  record(
    "CLI events list reads the catalog",
    { exit: catalogExit, eventTypes: catalog.events?.map((event) => event.eventType) },
    catalogExit === 0 && catalog.events?.some((event) => event.eventType === "linear.issue.state_changed"),
  );

  const states = (await linearGraphql(
    "query ($teamId: String!) { team(id: $teamId) { states(first: 20) { nodes { id name } } } }",
    { teamId: linearTeam.id },
  )).team.states.nodes;
  const reviewState = states.find((state) => state.name === "In Review");
  const progressState = states.find((state) => state.name === "In Progress");
  if (!reviewState || !progressState) throw new Error("Linear team is missing In Review or In Progress states");
  const issue = (await linearGraphql(
    "query ($teamId: String!) { team(id: $teamId) { issues(first: 1, orderBy: updatedAt) { nodes { id identifier } } } }",
    { teamId: linearTeam.id },
  )).team.issues.nodes[0];

  const subscriber = startCli([
    "events", "subscribe",
    "--team", teamId,
    "--project", projectId,
    "--integration", "linear",
    "--event-type", "linear.issue.state_changed",
    "--subscription-id", "e2e-review",
    "--filter", `changes.state.to=${reviewState.id}`,
    "--session-file", sessionFile,
  ]);
  await waitFor(() => subscriber.stdout().includes('"type":"subscribed"'), { label: "CLI subscribed frame" });
  record("CLI subscription established", { subscriptionId: "e2e-review", projectId });
  record(
    "stderr declares online-only delivery",
    { diagnostic: subscriber.stderr().trim().split("\n").pop() },
    subscriber.stderr().includes("online-only"),
  );

  const delivery = randomUUID();
  const startedAt = Date.now();
  const accepted = await postWebhook(
    endpointId,
    linearHeaders(delivery),
    linearIssueBody({
      from: { stateId: progressState.id },
      to: reviewState.id,
      issue,
      teamId: linearTeam.id,
      organizationId: linearOrganizationId,
      createdAt: new Date().toISOString(),
    }),
  );
  record(
    "ingress acknowledges immediately",
    { status: accepted.status, body: accepted.json },
    accepted.status === 200 && accepted.json?.received === true,
  );

  await waitFor(() => subscriber.stdout().includes('"type":"event"'), { label: "CLI event frame", timeoutMs: 10_000 });
  const latencyMs = Date.now() - startedAt;
  const frames = subscriber.stdout().trim().split("\n").map((line) => JSON.parse(line));
  const eventFrame = frames.find((frame) => frame.type === "event");
  record(
    "webhook to CLI delivery within 10s",
    {
      latencyMs,
      eventId: eventFrame?.event?.id,
      projectId: eventFrame?.event?.projectId,
      subject: eventFrame?.event?.subject,
      changes: eventFrame?.event?.changes,
      frames: frames.map((frame) => frame.type),
    },
    latencyMs < 10_000 && eventFrame?.event?.projectId === projectId && eventFrame?.event?.id.includes(delivery),
  );
  record(
    "no session token on stdout or stderr",
    undefined,
    !subscriber.stdout().includes(sessionToken) && !subscriber.stderr().includes(sessionToken),
  );

  const beforeMismatch = subscriber.stdout().length;
  const mismatch = await postWebhook(
    endpointId,
    linearHeaders(randomUUID()),
    linearIssueBody({
      from: { stateId: reviewState.id },
      to: progressState.id,
      issue,
      teamId: linearTeam.id,
      organizationId: linearOrganizationId,
      createdAt: new Date().toISOString(),
    }),
  );
  await sleep(700);
  record(
    "non-matching filter drops the event",
    { status: mismatch.status },
    mismatch.status === 200 && subscriber.stdout().length === beforeMismatch,
  );

  const duplicateDelivery = randomUUID();
  const duplicateBody = linearIssueBody({
    from: { stateId: progressState.id },
    to: reviewState.id,
    issue,
    teamId: linearTeam.id,
    organizationId: linearOrganizationId,
    createdAt: new Date().toISOString(),
  });
  const beforeDuplicate = subscriber.stdout().length;
  await postWebhook(endpointId, linearHeaders(duplicateDelivery), duplicateBody);
  await waitFor(() => subscriber.stdout().length !== beforeDuplicate, { label: "first delivery of duplicate id" });
  const afterFirstDuplicate = subscriber.stdout().length;
  const duplicateSecond = await postWebhook(endpointId, linearHeaders(duplicateDelivery), duplicateBody);
  await sleep(700);
  record(
    "same Delivery id is deduplicated",
    { status: duplicateSecond.status },
    duplicateSecond.status === 200 && subscriber.stdout().length === afterFirstDuplicate,
  );

  const beforeTitleOnly = subscriber.stdout().length;
  const titleOnly = await postWebhook(endpointId, linearHeaders(randomUUID()), linearIssueBody({
    from: { title: "previous title" },
    to: reviewState.id,
    issue,
    teamId: linearTeam.id,
    organizationId: linearOrganizationId,
    createdAt: new Date().toISOString(),
  }));
  await sleep(700);
  record(
    "title-only update is ignored",
    { status: titleOnly.status },
    titleOnly.status === 200 && subscriber.stdout().length === beforeTitleOnly,
  );

  const beforeOrganization = subscriber.stdout().length;
  const organizationMismatch = await postWebhook(endpointId, linearHeaders(randomUUID()), linearIssueBody({
    from: { stateId: progressState.id },
    to: reviewState.id,
    issue,
    teamId: linearTeam.id,
    organizationId: randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  await sleep(700);
  record(
    "organization mismatch dropped after 200",
    { status: organizationMismatch.status },
    organizationMismatch.status === 200 && subscriber.stdout().length === beforeOrganization,
  );

  const validBody = linearIssueBody({
    from: { stateId: progressState.id },
    to: reviewState.id,
    issue,
    teamId: linearTeam.id,
    organizationId: linearOrganizationId,
    createdAt: new Date().toISOString(),
  });
  const invalidToken = await postWebhook(randomUUID(), linearHeaders(randomUUID()), validBody);
  const missingToken = await request("POST", "/api/webhooks", { headers: linearHeaders(randomUUID()), body: validBody });
  const wrongMethod = await request("GET", `/api/webhooks?token=${endpointId}`);
  const wrongMedia = await request("POST", `/api/webhooks?token=${endpointId}`, {
    headers: { "content-type": "text/plain" },
    body: {},
  });
  const tooLarge = await request("POST", `/api/webhooks?token=${endpointId}`, {
    headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) },
    body: {},
  });
  record(
    "synchronous entry rejections",
    {
      invalidToken: invalidToken.status,
      missingToken: missingToken.status,
      wrongMethod: wrongMethod.status,
      wrongMedia: wrongMedia.status,
      tooLarge: tooLarge.status,
    },
    invalidToken.status === 401
      && missingToken.status === 401
      && wrongMethod.status === 405
      && wrongMedia.status === 415
      && tooLarge.status === 413,
  );

  const upgradeChecks = {
    noToken: await upgradeStatus(`/api/events/stream?teamId=${teamId}`),
    randomCredential: await upgradeStatus(`/api/events/stream?teamId=${teamId}`, { token: `ec_${randomUUID()}` }),
    endpointIdAsCredential: await upgradeStatus(`/api/events/stream?teamId=${teamId}`, { token: endpointId }),
    unknownTeam: await upgradeStatus(`/api/events/stream?teamId=${randomUUID()}`, { token: sessionToken }),
    valid: await upgradeStatus(`/api/events/stream?teamId=${teamId}`, { token: sessionToken }),
    wrongSubprotocol: await upgradeStatus(`/api/events/stream?teamId=${teamId}`, { token: sessionToken, subprotocol: "graphql-ws" }),
  };
  const expectedUpgrades = {
    noToken: 401,
    randomCredential: 401,
    endpointIdAsCredential: 401,
    unknownTeam: 403,
    valid: 101,
    wrongSubprotocol: 400,
  };
  const observedUpgrades = Object.fromEntries(
    Object.entries(upgradeChecks).map(([label, value]) => [label, value.status ?? value.error]),
  );
  record(
    "subscription credential matrix",
    observedUpgrades,
    Object.entries(expectedUpgrades).every(([label, status]) => upgradeChecks[label].status === status),
  );

  const healthyAfterStop = await postWebhook(endpointId, linearHeaders(randomUUID()), validBody);
  subscriber.child.kill("SIGTERM");
  const subscriberExit = await subscriber.done;
  record("CLI exits 143 on SIGTERM", { exit: subscriberExit }, subscriberExit === 143);
  record(
    "server healthy after CLI shutdown",
    { webhookStatus: healthyAfterStop.status },
    healthyAfterStop.status === 200,
  );

  const outsider = await request("POST", "/api/auth/register", { body: { username: `e2e_out_${randomUUID().replaceAll("-", "").slice(0, 8)}`, password: "E2e-Harness-Passw0rd" } });
  const outsiderToken = /mystra_session=([A-Za-z0-9_-]{16,})/u.exec((outsider.headers["set-cookie"] ?? []).join("; "))?.[1];
  const foreignRead = await request("GET", `/api/integration-connections/${linearConnectionId}/webhook`, { token: outsiderToken });
  record("cross-tenant webhook read is forbidden", { status: foreignRead.status }, foreignRead.status === 403);

  const blockedDelete = await request("DELETE", `/api/integration-connections/linear/api-key/${linearConnectionId}`, { token: sessionToken });
  const endpointBeforeUnbind = await postWebhook(endpointId, linearHeaders(randomUUID()), validBody);
  record(
    "referenced connection cannot be deleted",
    {
      deleteStatus: blockedDelete.status,
      code: blockedDelete.json?.error?.code,
      webhookStatus: endpointBeforeUnbind.status,
    },
    blockedDelete.status === 409
      && blockedDelete.json?.error?.code === "INTEGRATION_CONNECTION_IN_USE"
      && endpointBeforeUnbind.status === 200,
  );

  const unbind = await request("DELETE", `/api/projects/${projectSlug}/issue-sources/linear`, { token: sessionToken });
  const deletion = await request("DELETE", `/api/integration-connections/linear/api-key/${linearConnectionId}`, { token: sessionToken });
  const afterDelete = await postWebhook(endpointId, linearHeaders(randomUUID()), validBody);
  record(
    "connection delete invalidates the endpoint",
    { unbindStatus: unbind.status, deleteStatus: deletion.status, webhookAfterDelete: afterDelete.status },
    unbind.status === 204
      && (deletion.status === 204 || deletion.status === 200)
      && afterDelete.status === 401,
  );

  return migrationCount;
}

async function cleanup() {
  for (const child of cliChildren) {
    if (!child.killed) child.kill("SIGKILL");
  }
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    await sleep(1500);
    if (!serverProcess.killed) serverProcess.kill("SIGKILL");
  }
}

const exitCode = await main()
  .catch((error) => {
    console.error(`HARNESS ERROR: ${error instanceof Error ? error.stack : String(error)}`);
    return 1;
  })
  .finally(async () => {
    await cleanup();
    if (!keep && workspaceDir) rmSync(workspaceDir, { recursive: true, force: true });
  });

process.exit(exitCode);
