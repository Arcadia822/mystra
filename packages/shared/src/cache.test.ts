import { describe, expect, it } from "vitest";

import { runnerCacheConfigSchema } from "./cache.js";

describe("runnerCacheConfigSchema", () => {
  it("accepts controlled runner-local cache directories", () => {
    const parsed = runnerCacheConfigSchema.parse({
      repoCacheDir: "/var/lib/mystra/cache/repos",
      pnpmStoreDir: "/var/lib/mystra/cache/pnpm-store",
      uvCacheDir: "/var/lib/mystra/cache/uv",
    });

    expect(parsed.repoCacheDir).toBe("/var/lib/mystra/cache/repos");
  });

  it("rejects host home and Docker socket cache mounts", () => {
    expect(() =>
      runnerCacheConfigSchema.parse({
        repoCacheDir: "/root",
        pnpmStoreDir: "/var/lib/mystra/cache/pnpm-store",
        uvCacheDir: "/var/lib/mystra/cache/uv",
      }),
    ).toThrow();

    expect(() =>
      runnerCacheConfigSchema.parse({
        repoCacheDir: "/var/lib/mystra/cache/repos",
        pnpmStoreDir: "/var/run/docker.sock",
        uvCacheDir: "/var/lib/mystra/cache/uv",
      }),
    ).toThrow();
  });
});
