import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Package identity is resolved from the package that is actually installed next to this
// module. No version may ever be asserted that this process cannot read from disk; an
// unresolvable manifest is a real failure, not an "unknown" label.
const AGENTOS_CORE_PACKAGE = '@rivet-dev/agentos-core';
const PI_PACKAGE = '@agentos-software/pi';

export function installedPackageIdentity(specifier) {
  const require = createRequire(import.meta.url);
  let directory = path.dirname(require.resolve(specifier));
  for (;;) {
    const manifestPath = path.join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
        throw new Error(`Installed package ${specifier} declares no version`);
      }
      return { name: typeof manifest.name === 'string' ? manifest.name : specifier, version: manifest.version };
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot locate the installed manifest for ${specifier}`);
    directory = parent;
  }
}

/**
 * Identity of the AgentOS runtime this process is linked against. Pi cross-VM restore is
 * documented for openSession (restoring an unloaded durable session) and confirmed by the
 * Runtime probe; it is deliberately not claimed here.
 */
export function agentosRuntimeIdentity() {
  return {
    agentosCore: installedPackageIdentity(AGENTOS_CORE_PACKAGE),
    pi: installedPackageIdentity(PI_PACKAGE),
  };
}
