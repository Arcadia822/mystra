import { Readable } from "node:stream";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  SkillContentStoreError,
  type GetRevisionArchiveResult,
  type HeadRevisionArchiveResult,
  type PutRevisionArchiveInput,
  type SkillContentStore,
} from "./skill-content-store";
import type { SkillStorageConfiguration } from "./skill-storage-config";

interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

interface ProviderFailure {
  name?: string;
  $metadata?: { httpStatusCode?: number };
}

function providerFailure(error: unknown): ProviderFailure {
  return error !== null && typeof error === "object" ? error as ProviderFailure : {};
}

function isMissing(error: unknown): boolean {
  const failure = providerFailure(error);
  return failure.$metadata?.httpStatusCode === 404 || failure.name === "NotFound" || failure.name === "NoSuchKey";
}

function mapProviderError(error: unknown, missingIsIntegrity = false): SkillContentStoreError {
  const failure = providerFailure(error);
  const status = failure.$metadata?.httpStatusCode;
  if (isMissing(error) && missingIsIntegrity) {
    return new SkillContentStoreError("skill_storage_integrity_error", "Stored Skill content is missing");
  }
  if (status === 401 || status === 403 || failure.name === "AccessDenied" || failure.name === "CredentialsProviderError") {
    return new SkillContentStoreError("skill_storage_misconfigured", "Skill storage is not configured for this operation");
  }
  return new SkillContentStoreError("skill_storage_unavailable", "Skill storage is temporarily unavailable");
}

function metadataHash(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) return undefined;
  return metadata["mystra-zip-sha256"] ?? metadata["MYSTRA-ZIP-SHA256"];
}

export class S3SkillContentStore implements SkillContentStore {
  readonly #client: S3ClientLike;
  readonly #bucket: string;

  constructor(input: { client: S3ClientLike; bucket: string }) {
    this.#client = input.client;
    this.#bucket = input.bucket;
  }

  async putRevisionArchive(input: PutRevisionArchiveInput): Promise<void> {
    try {
      await this.#client.send(new PutObjectCommand({
        Bucket: this.#bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentLength: input.contentLength,
        ContentType: "application/zip",
        Metadata: { "mystra-zip-sha256": input.zipSha256 },
      }));
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  async headRevisionArchive(input: { objectKey: string }): Promise<HeadRevisionArchiveResult | null> {
    try {
      const output = await this.#client.send(new HeadObjectCommand({
        Bucket: this.#bucket,
        Key: input.objectKey,
      })) as { ContentLength?: number; Metadata?: Record<string, string> };
      if (output.ContentLength === undefined) {
        throw new SkillContentStoreError("skill_storage_integrity_error", "Stored Skill content has no length metadata");
      }
      const zipSha256Metadata = metadataHash(output.Metadata);
      return {
        contentLength: output.ContentLength,
        ...(zipSha256Metadata === undefined ? {} : { zipSha256Metadata }),
      };
    } catch (error) {
      if (isMissing(error)) return null;
      if (error instanceof SkillContentStoreError) throw error;
      throw mapProviderError(error);
    }
  }

  async getRevisionArchive(input: { objectKey: string }): Promise<GetRevisionArchiveResult> {
    try {
      const output = await this.#client.send(new GetObjectCommand({
        Bucket: this.#bucket,
        Key: input.objectKey,
      })) as { Body?: unknown; ContentLength?: number; Metadata?: Record<string, string> };
      if (!(output.Body instanceof Readable) || output.ContentLength === undefined) {
        throw new SkillContentStoreError("skill_storage_integrity_error", "Stored Skill content response is incomplete");
      }
      const zipSha256Metadata = metadataHash(output.Metadata);
      return {
        body: output.Body,
        contentLength: output.ContentLength,
        ...(zipSha256Metadata === undefined ? {} : { zipSha256Metadata }),
      };
    } catch (error) {
      if (error instanceof SkillContentStoreError) throw error;
      throw mapProviderError(error, true);
    }
  }
}

export function createS3SkillContentStore(configuration: SkillStorageConfiguration): S3SkillContentStore {
  return new S3SkillContentStore({
    client: new S3Client({
      endpoint: configuration.endpoint,
      region: configuration.region,
      forcePathStyle: configuration.forcePathStyle,
      credentials: configuration.credentials,
    }),
    bucket: configuration.bucket,
  });
}
