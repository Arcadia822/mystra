import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { SkillFailure } from "@/lib/skills/skill-errors";
import { createSkillServices } from "@/lib/skills/skill-service-factory";
import { POST as archiveSkill } from "./[skillId]/archive/route";
import { GET as getSkill } from "./[skillId]/route";
import { GET as downloadRevision } from "./[skillId]/revisions/[revisionId]/download/route";
import { GET as previewFile } from "./[skillId]/revisions/[revisionId]/file/route";
import { GET as getRevision } from "./[skillId]/revisions/[revisionId]/route";
import { GET as listRevisions, POST as publishRevision } from "./[skillId]/revisions/route";
import { GET as listSkills, POST as createSkill } from "./route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/skills/skill-service-factory", () => ({ createSkillServices: vi.fn() }));

const teamId = randomUUID();
const userId = randomUUID();
const skillId = randomUUID();
const revisionId = randomUUID();
const timestamp = "2026-08-24T00:00:00.000Z";
const sha256 = "a".repeat(64);

const revision = {
  id: revisionId,
  skillId,
  baseRevisionId: null,
  sequence: 1,
  publicationStatus: "ready" as const,
  description: "Review evidence",
  manifest: [{ path: "SKILL.md", sizeBytes: 42, sha256, mediaType: "text/markdown", previewability: "text" as const }],
  compressedSizeBytes: 3,
  uncompressedSizeBytes: 42,
  zipSha256: sha256,
  contentSha256: "b".repeat(64),
  createdByUserId: userId,
  createdAt: timestamp,
  readyAt: timestamp,
};
const skill = {
  id: skillId,
  teamId,
  name: "review-evidence",
  description: "Review evidence",
  status: "active" as const,
  currentRevisionId: revisionId,
  resourceRevision: 1,
  createdByUserId: userId,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedByUserId: null,
  archivedAt: null,
  currentRevision: revision,
};

function authenticated(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: { authorization: "Bearer skill-route-token", ...(init.headers ?? {}) },
  });
}

function database(role: "owner" | "admin" | "member" = "owner") {
  return {
    getAuthSessionByTokenHash: vi.fn(async () => ({
      id: randomUUID(), userId, tokenHash: "digest", activeTeamId: teamId,
      expiresAt: "2027-08-24T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp,
    })),
    getUserById: vi.fn(async () => ({
      id: userId, username: "owner", displayUsername: "owner", displayName: "Owner",
      status: "active", requirePasswordChange: false, createdAt: timestamp, updatedAt: timestamp,
    })),
    resolveActiveTeam: vi.fn(async () => ({
      team: { id: teamId, displayName: "Team", status: "active", createdAt: timestamp, updatedAt: timestamp },
      role,
    })),
  };
}

function services() {
  const { manifest: _manifest, ...revisionSummary } = revision;
  return {
    publication: {
      create: vi.fn(async () => ({ skill: { ...skill, activeName: skill.name, currentRevision: undefined }, revision: { ...revision, objectKey: "private/key.zip", failedAt: null, failureCode: null } })),
      publishRevision: vi.fn(async () => ({ skill: { ...skill, activeName: skill.name, currentRevision: undefined }, revision: { ...revision, objectKey: "private/key.zip", failedAt: null, failureCode: null } })),
      archive: vi.fn(async () => ({ ...skill, activeName: null, status: "archived", resourceRevision: 2, archivedByUserId: userId, archivedAt: timestamp, currentRevision: undefined, description: undefined })),
    },
    query: {
      list: vi.fn(async () => ({ items: [{ ...skill, currentRevision: revisionSummary }], nextCursor: null })),
      get: vi.fn(async () => skill),
      listRevisions: vi.fn(async () => ({ items: [revisionSummary], nextCursor: null })),
      getRevision: vi.fn(async () => revision),
    },
    preview: {
      preview: vi.fn(async () => ({ revisionId, sequence: 1, file: revision.manifest[0], content: "text", truncated: false })),
      download: vi.fn(async () => ({
        skill: { ...skill, activeName: skill.name, currentRevision: undefined, description: undefined },
        revision: { ...revision, objectKey: "private/key.zip", failedAt: null, failureCode: null },
        body: Readable.from([Buffer.from("zip")]),
        contentLength: 3,
      })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue(database() as never);
  vi.mocked(createSkillServices).mockResolvedValue(services() as never);
});

describe("Skill management routes", () => {
  it("lists Team Skills through the shared query contract", async () => {
    const response = await listSkills(authenticated("https://control.example.test/api/skills?includeArchived=true&limit=25"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [expect.objectContaining({ id: skillId, currentRevision: expect.not.objectContaining({ manifest: expect.anything() }) })],
      nextCursor: null,
    });
    const service = await createSkillServices(await getDb());
    expect(service.query.list).toHaveBeenCalledWith({
      teamId,
      cursor: null,
      limit: 25,
      query: null,
      includeArchived: true,
    });
  });

  it("creates from a raw ZIP body and returns the first visible ETag", async () => {
    const response = await createSkill(authenticated("https://control.example.test/api/skills", {
      method: "POST",
      headers: { "content-type": "application/zip", "content-length": "3" },
      body: Buffer.from("zip"),
    }));
    expect(response.status).toBe(201);
    expect(response.headers.get("etag")).toBe('"1"');
    const service = await createSkillServices(await getDb());
    expect(service.publication.create).toHaveBeenCalledWith({
      teamId,
      createdByUserId: userId,
      zipBuffer: Buffer.from("zip"),
    });
  });

  it("rejects non-ZIP transport and Member writes before publication", async () => {
    expect((await createSkill(authenticated("https://control.example.test/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" },
      body: "{}",
    }))).status).toBe(400);

    vi.mocked(getDb).mockResolvedValueOnce(database("member") as never);
    expect((await createSkill(authenticated("https://control.example.test/api/skills", {
      method: "POST",
      headers: { "content-type": "application/zip", "content-length": "3" },
      body: Buffer.from("zip"),
    }))).status).toBe(403);
  });

  it("serves detail/history/revision/preview without storage-private fields", async () => {
    const params = { params: Promise.resolve({ skillId }) };
    expect((await getSkill(authenticated(`https://control.example.test/api/skills/${skillId}`), params)).status).toBe(200);
    expect((await listRevisions(authenticated(`https://control.example.test/api/skills/${skillId}/revisions`), params)).status).toBe(200);
    const revisionParams = { params: Promise.resolve({ skillId, revisionId }) };
    expect((await getRevision(authenticated(`https://control.example.test/api/skills/${skillId}/revisions/${revisionId}`), revisionParams)).status).toBe(200);
    const preview = await previewFile(authenticated(`https://control.example.test/api/skills/${skillId}/revisions/${revisionId}/file?path=SKILL.md`), revisionParams);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("x-content-type-options")).toBe("nosniff");
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
  });

  it("publishes and archives with quoted If-Match concurrency", async () => {
    const params = { params: Promise.resolve({ skillId }) };
    const publish = await publishRevision(authenticated(`https://control.example.test/api/skills/${skillId}/revisions`, {
      method: "POST",
      headers: { "content-type": "application/zip", "content-length": "3", "if-match": '"1"' },
      body: Buffer.from("zip"),
    }), params);
    expect(publish.status).toBe(201);
    const archive = await archiveSkill(authenticated(`https://control.example.test/api/skills/${skillId}/archive`, {
      method: "POST",
      headers: { "if-match": '"1"' },
    }), params);
    expect(archive.status).toBe(200);
    expect(archive.headers.get("etag")).toBe('"2"');

    vi.mocked(getDb).mockResolvedValueOnce(database("member") as never);
    const forbidden = await archiveSkill(authenticated(`https://control.example.test/api/skills/${skillId}/archive`, {
      method: "POST",
      headers: { "if-match": '"2"' },
    }), params);
    expect(forbidden.status).toBe(403);
  });

  it("streams authorized bytes with private headers and maps hidden resources identically", async () => {
    const params = { params: Promise.resolve({ skillId, revisionId }) };
    const download = await downloadRevision(authenticated(`https://control.example.test/api/skills/${skillId}/revisions/${revisionId}/download`), params);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("application/zip");
    expect(download.headers.get("content-disposition")).toContain("review-evidence-r1.zip");
    expect(download.headers.get("cache-control")).toBe("private, no-store");
    expect(await download.text()).toBe("zip");

    const hidden = services();
    hidden.query.get.mockRejectedValueOnce(new SkillFailure("skill_not_found", "Skill not found"));
    vi.mocked(createSkillServices).mockResolvedValueOnce(hidden as never);
    const response = await getSkill(authenticated(`https://control.example.test/api/skills/${randomUUID()}`), {
      params: Promise.resolve({ skillId: randomUUID() }),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: "skill_not_found", message: "Skill not found" } });
  });
});
