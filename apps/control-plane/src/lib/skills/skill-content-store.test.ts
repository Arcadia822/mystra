import { Readable } from "node:stream";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { SkillContentStoreError } from "./skill-content-store";
import { S3SkillContentStore } from "./s3-skill-content-store";

const objectKey = "teams/00000000-0000-4000-8000-000000000001/skills/00000000-0000-4000-8000-000000000002/revisions/00000000-0000-4000-8000-000000000003/bundle.zip";
const zipSha256 = "a".repeat(64);

describe("S3 Skill content store", () => {
  it("writes immutable archive metadata without ACL, ETag or version coupling", async () => {
    const send = vi.fn().mockResolvedValue({});
    const store = new S3SkillContentStore({ client: { send }, bucket: "private-skills" });
    const body = Buffer.from("zip");

    await store.putRevisionArchive({ objectKey, body, contentLength: body.length, zipSha256 });

    const command = send.mock.calls[0]![0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: "private-skills",
      Key: objectKey,
      Body: body,
      ContentLength: body.length,
      ContentType: "application/zip",
      Metadata: { "mystra-zip-sha256": zipSha256 },
    });
  });

  it("maps Head found/missing and returns application-owned integrity metadata", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ ContentLength: 3, Metadata: { "mystra-zip-sha256": zipSha256 } })
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    const store = new S3SkillContentStore({ client: { send }, bucket: "private-skills" });

    await expect(store.headRevisionArchive({ objectKey })).resolves.toEqual({
      contentLength: 3,
      zipSha256Metadata: zipSha256,
    });
    await expect(store.headRevisionArchive({ objectKey })).resolves.toBeNull();
    expect(send.mock.calls[0]![0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("returns the provider stream and preserves downstream cancellation", async () => {
    const body = Readable.from([Buffer.from("zip")]);
    const destroy = vi.spyOn(body, "destroy");
    const send = vi.fn().mockResolvedValue({
      Body: body,
      ContentLength: 3,
      Metadata: { "mystra-zip-sha256": zipSha256 },
    });
    const store = new S3SkillContentStore({ client: { send }, bucket: "private-skills" });

    const result = await store.getRevisionArchive({ objectKey });
    result.body.destroy();

    expect(send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand);
    expect(destroy).toHaveBeenCalled();
  });

  it.each([
    [Object.assign(new Error("timeout"), { name: "TimeoutError" }), "skill_storage_unavailable"],
    [Object.assign(new Error("throttled"), { name: "SlowDown", $metadata: { httpStatusCode: 503 } }), "skill_storage_unavailable"],
    [Object.assign(new Error("denied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } }), "skill_storage_misconfigured"],
  ])("maps provider failures without leaking raw details", async (providerError, code) => {
    const store = new S3SkillContentStore({
      client: { send: vi.fn().mockRejectedValue(providerError) },
      bucket: "private-skills",
    });
    try {
      await store.putRevisionArchive({ objectKey, body: Buffer.from("zip"), contentLength: 3, zipSha256 });
      throw new Error("Expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SkillContentStoreError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain(providerError.message);
    }
  });
});
