#!/usr/bin/env node
// Publishes the Mystra flow presets (Agent Profiles and the `mystra-flow` Skill)
// to a Mystra Control Plane through the canonical management API.
//
// The canonical assets live under `presets/`; this script never invents content.
// It reuses the operator CLI's human session store so no second credential
// format exists for repository maintenance.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

import { createSessionStore } from "./operator-cli.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const presetsRoot = path.join(repoRoot, "presets");

/** Deterministic ZIP timestamps keep published revisions byte-reproducible. */
const ZIP_EPOCH = new Date("2026-09-22T00:00:00.000Z");

export function readAgentPresets(root = presetsRoot) {
  const directory = path.join(root, "agents");
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => ({
      name: path.basename(entry, ".md"),
      systemPrompt: readFileSync(path.join(directory, entry), "utf8"),
    }));
}

export function readSkillPresets(root = presetsRoot) {
  const directory = path.join(root, "skills");
  return readdirSync(directory)
    .filter((entry) => statSync(path.join(directory, entry)).isDirectory())
    .sort()
    .map((entry) => {
      const skillDirectory = path.join(directory, entry);
      return { name: entry, files: collectFiles(skillDirectory, "") };
    });
}

function collectFiles(directory, prefix) {
  const files = [];
  for (const entry of readdirSync(directory).sort()) {
    const absolute = path.join(directory, entry);
    const logical = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) {
      files.push(...collectFiles(absolute, logical));
    } else {
      files.push({ path: logical, content: readFileSync(absolute) });
    }
  }
  return files;
}

/**
 * Builds a stored/deflate ZIP without a runtime dependency. The canonical
 * control-plane validator is the authority on whether the result is valid.
 */
export function buildSkillZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  let entryCount = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.path, "utf8");
    const raw = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const deflated = deflateRawSync(raw);
    const stored = deflated.length >= raw.length;
    const payload = stored ? raw : deflated;
    const method = stored ? 0 : 8;
    const checksum = crc32(raw);
    const { time, date } = dosDateTime(ZIP_EPOCH);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    localChunks.push(local, payload);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralChunks.push(central);

    offset += local.length + payload.length;
    entryCount += 1;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirectory, end]);
}

function dosDateTime(value) {
  const time = ((value.getUTCHours() << 11) | (value.getUTCMinutes() << 5) | (value.getUTCSeconds() >> 1)) & 0xffff;
  const date = (((value.getUTCFullYear() - 1980) << 9) | ((value.getUTCMonth() + 1) << 5) | value.getUTCDate()) & 0xffff;
  return { time, date };
}

export async function publishPresets(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sessionStore = options.sessionStore ?? createSessionStore();
  const only = options.only ?? "all";
  if (!["all", "agents", "skills"].includes(only)) {
    throw new Error(`Unsupported preset section: ${only}`);
  }
  const session = await sessionStore.read();
  const baseUrl = new URL(session.controlPlaneUrl);
  const headers = { authorization: `Bearer ${session.sessionToken}` };
  const report = { only, agents: [], skills: [] };

  for (const agent of only === "skills" ? [] : readAgentPresets(options.presetsRoot)) {
    const list = await requestJson(fetchImpl, new URL("/api/agents", baseUrl), { headers });
    const existing = (list.agents ?? []).find((candidate) => candidate.name === agent.name);
    if (!existing) {
      const created = await requestJson(fetchImpl, new URL("/api/agents", baseUrl), {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(agent),
      });
      report.agents.push({ name: agent.name, id: created.agent.id, outcome: "created" });
      continue;
    }
    if (existing.systemPrompt === agent.systemPrompt) {
      report.agents.push({ name: agent.name, id: existing.id, outcome: "unchanged" });
      continue;
    }
    const updated = await requestJson(fetchImpl, new URL(`/api/agents/${existing.id}`, baseUrl), {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: existing.revision, systemPrompt: agent.systemPrompt }),
    });
    report.agents.push({ name: agent.name, id: updated.agent.id, outcome: "updated" });
  }

  for (const skill of only === "agents" ? [] : readSkillPresets(options.presetsRoot)) {
    const zip = buildSkillZip(skill.files);
    const listing = await requestJson(
      fetchImpl,
      new URL(`/api/skills?query=${encodeURIComponent(skill.name)}`, baseUrl),
      { headers },
    );
    const existing = (listing.items ?? []).find((candidate) => candidate.name === skill.name);
    const zipHeaders = {
      ...headers,
      "content-type": "application/zip",
      "content-length": String(zip.byteLength),
    };
    if (!existing) {
      const created = await requestJson(fetchImpl, new URL("/api/skills", baseUrl), {
        method: "POST",
        headers: zipHeaders,
        body: zip,
      });
      report.skills.push({
        name: skill.name,
        id: created.skill.id,
        revision: created.revision.sequence,
        outcome: "created",
      });
      continue;
    }
    if (manifestsMatch(existing.currentRevision.manifest, skill.files)) {
      report.skills.push({
        name: skill.name,
        id: existing.id,
        revision: existing.currentRevision.sequence,
        outcome: "unchanged",
      });
      continue;
    }
    const published = await requestJson(
      fetchImpl,
      new URL(`/api/skills/${existing.id}/revisions`, baseUrl),
      {
        method: "POST",
        headers: { ...zipHeaders, "if-match": `"${existing.resourceRevision}"` },
        body: zip,
      },
    );
    report.skills.push({
      name: skill.name,
      id: published.skill.id,
      revision: published.revision.sequence,
      outcome: "published",
    });
  }

  return report;
}

function manifestsMatch(manifest, files) {
  if (!Array.isArray(manifest) || manifest.length !== files.length) return false;
  const expected = new Map(files.map((file) => {
    const raw = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    return [file.path, { sizeBytes: raw.length, sha256: sha256(raw) }];
  }));
  return manifest.every((entry) => {
    const wanted = expected.get(entry.path);
    return Boolean(wanted) && wanted.sizeBytes === entry.sizeBytes && wanted.sha256 === entry.sha256;
  });
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function requestJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url.pathname} failed with ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const onlyArgument = process.argv.find((argument) => argument.startsWith("--only="));
  const report = await publishPresets(onlyArgument ? { only: onlyArgument.slice("--only=".length) } : {});
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
