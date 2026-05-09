import path from "node:path";

import { z } from "zod";

const forbiddenCachePaths = new Set(["/", "/root", "/home", "/Users", "/var/run/docker.sock"]);

const cachePathSchema = z
  .string()
  .min(1)
  .refine((value) => path.isAbsolute(value), {
    message: "Cache path must be absolute",
  })
  .refine((value) => !forbiddenCachePaths.has(path.resolve(value)), {
    message: "Cache path must not expose host home, root, or Docker socket",
  });

export const runnerCacheConfigSchema = z
  .object({
    repoCacheDir: cachePathSchema,
    pnpmStoreDir: cachePathSchema,
    uvCacheDir: cachePathSchema,
  })
  .strict();
export type RunnerCacheConfig = z.infer<typeof runnerCacheConfigSchema>;
