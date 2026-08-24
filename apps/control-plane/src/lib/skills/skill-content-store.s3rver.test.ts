import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import S3rver from "s3rver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { S3SkillContentStore } from "./s3-skill-content-store";

describe("S3 Skill content store against a non-AWS S3-compatible implementation", () => {
  let directory = "";
  let server: S3rver;
  let store: S3SkillContentStore;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "mystra-s3rver-"));
    server = new S3rver({ address: "127.0.0.1", port: 0, directory, silent: true, allowMismatchedSignatures: true });
    const address = await server.run();
    const client = new S3Client({
      endpoint: `http://127.0.0.1:${address.port}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
    await client.send(new CreateBucketCommand({ Bucket: "private-skills" }));
    store = new S3SkillContentStore({ client, bucket: "private-skills" });
  });

  afterAll(async () => {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("round-trips Put, Head and streaming Get with application-owned integrity metadata", async () => {
    const objectKey = "teams/00000000-0000-4000-8000-000000000001/skills/00000000-0000-4000-8000-000000000002/revisions/00000000-0000-4000-8000-000000000003/bundle.zip";
    const body = Buffer.from("PK\u0003\u0004s3-compatible-contract");
    const zipSha256 = createHash("sha256").update(body).digest("hex");

    await store.putRevisionArchive({ objectKey, body, contentLength: body.length, zipSha256 });
    await expect(store.headRevisionArchive({ objectKey })).resolves.toEqual({
      contentLength: body.length,
      zipSha256Metadata: zipSha256,
    });
    const downloaded = await store.getRevisionArchive({ objectKey });
    const chunks: Buffer[] = [];
    for await (const chunk of downloaded.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(body);
    expect(downloaded).toMatchObject({ contentLength: body.length, zipSha256Metadata: zipSha256 });
    await expect(store.headRevisionArchive({ objectKey: `${objectKey}.missing` })).resolves.toBeNull();
  });
});
