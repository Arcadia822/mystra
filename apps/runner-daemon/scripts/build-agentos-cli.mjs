#!/usr/bin/env node
/**
 * Build the AgentOS guest workload CLI.
 *
 * The guest gets ONE self-contained CJS bundle and executes it directly through its
 * `#!/usr/bin/env node` shebang. A `sh` wrapper cannot replace this: `node` is an AgentOS
 * kernel command, not a file, so a nested shell cannot resolve it (measured on host-c1:
 * `exec node ...` inside a script exits 127, while the read-only projected bundle with the
 * executable bit set runs and reaches the Control Plane).
 */
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(packageRoot, "dist", "agentos");
const bundleName = "mystra-agent.cjs";

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [path.resolve(packageRoot, "../../packages/agent-cli/bin/mystra-agent")],
  bundle: true,
  platform: "node",
  // CommonJS: bundling the CLI as ESM fails at runtime with
  // `Dynamic require of "..." is not supported`.
  format: "cjs",
  target: "node22",
  outfile: path.join(outputDirectory, bundleName),
  logLevel: "error",
});
// The bundle is executed directly through its own `#!/usr/bin/env node` shebang: the guest
// honours it for a read-only projection, but the executable bit must be set on the host
// before the runner mounts the directory (a non-executable file fails with ENOEXEC).
await chmod(path.join(outputDirectory, bundleName), 0o755);
console.log(`agentos guest CLI built: ${path.join(outputDirectory, bundleName)}`);
