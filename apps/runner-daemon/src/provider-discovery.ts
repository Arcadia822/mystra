import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type {
  ProviderCapability,
  ProviderUnavailableReason,
} from "@mystra/shared";

import {
  supportedHostProviderKeys,
  type SupportedHostProviderKey,
} from "./provider-keys.js";

const execFile = promisify(execFileCallback);

export const PROVIDER_PROBE_TIMEOUT_MS = 3_000;
export const LOGIN_SHELL_CACHE_TTL_MS = 30 * 60 * 1_000;
export const LOGIN_SHELL_ALLOWED_NAMES = new Set(["bash", "zsh", "sh", "dash", "ksh"]);

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface ProviderProbeResult {
  available: boolean;
  version?: string;
  unavailableReason?: ProviderUnavailableReason;
}

export interface ProviderDiscoveryDependencies {
  resolvePath(provider: string, environment: Environment): Promise<string | null>;
  resolveLoginShellPaths(
    providerKeys: readonly string[],
    environment: Environment,
  ): Promise<Map<string, string>>;
  isExecutable(filePath: string): Promise<boolean>;
  probe(filePath: string): Promise<ProviderProbeResult>;
}

interface LoginShellCacheEntry {
  expiresAt: number;
  paths: Map<string, string>;
}

const loginShellPathCache = new Map<string, LoginShellCacheEntry>();

function environmentValue(environment: Environment, name: string): string | undefined {
  return environment[name];
}

function environmentOverrideName(provider: string): string {
  return `MYSTRA_${provider.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}_PATH`;
}

function pathEntries(environment: Environment): string[] {
  return (environmentValue(environment, "PATH") ?? "")
    .split(path.delimiter)
    .filter(Boolean);
}

async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      return false;
    }
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolvePath(provider: string, environment: Environment): Promise<string | null> {
  for (const directory of pathEntries(environment)) {
    const candidate = path.resolve(directory, provider);
    if (await isExecutableFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function probeProvider(filePath: string): Promise<ProviderProbeResult> {
  try {
    const { stdout, stderr } = await execFile(filePath, ["--version"], {
      timeout: PROVIDER_PROBE_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: 16 * 1024,
    });
    const version = `${stdout}\n${stderr}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "available";
    return { available: true, version };
  } catch {
    return { available: false, unavailableReason: "exec-failed" };
  }
}

function loginShellCacheKey(environment: Environment): string {
  return [
    environmentValue(environment, "PATH") ?? "",
    environmentValue(environment, "SHELL") ?? "",
    environmentValue(environment, "HOME") ?? "",
  ].join("\u0000");
}

function loginShellScript(providerKeys: readonly string[]): string {
  const commands = providerKeys
    .map((provider) => ` "${provider}"`)
    .join("");
  return [
    `for provider in${commands}; do`,
    "  unalias \"$provider\" 2>/dev/null || true",
    "  unset -f \"$provider\" 2>/dev/null || true",
    "  resolved=\"$(command -v \"$provider\" 2>/dev/null || true)\"",
    "  case \"$resolved\" in",
    "    /*)",
    "      directory=\"$(dirname \"$resolved\")\"",
    "      canonical=\"$(cd \"$directory\" 2>/dev/null && pwd -P)/$(basename \"$resolved\")\"",
    "      [ -x \"$canonical\" ] && printf '%s\\t%s\\n' \"$provider\" \"$canonical\"",
    "      ;;",
    "  esac",
    "done",
  ].join("\n");
}

async function resolveLoginShellPaths(
  providerKeys: readonly string[],
  environment: Environment,
): Promise<Map<string, string>> {
  const shell = environmentValue(environment, "SHELL");
  if (!shell || !LOGIN_SHELL_ALLOWED_NAMES.has(path.basename(shell))) {
    return new Map();
  }

  const cacheKey = loginShellCacheKey(environment);
  const cached = loginShellPathCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return new Map(cached.paths);
  }

  const paths = new Map<string, string>();
  try {
    const { stdout } = await execFile(shell, ["-ilc", loginShellScript(providerKeys)], {
      env: environment,
      timeout: PROVIDER_PROBE_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: 16 * 1024,
    });
    for (const line of stdout.split(/\r?\n/)) {
      const [provider, resolvedPath] = line.split("\t", 2);
      if (
        provider
        && resolvedPath
        && providerKeys.includes(provider)
        && path.isAbsolute(resolvedPath)
        && await isExecutableFile(resolvedPath)
      ) {
        paths.set(provider, resolvedPath);
      }
    }
  } catch {
    // A login shell is optional discovery assistance; direct PATH discovery remains valid.
  }

  loginShellPathCache.set(cacheKey, {
    expiresAt: Date.now() + LOGIN_SHELL_CACHE_TTL_MS,
    paths: new Map(paths),
  });
  return paths;
}

const defaultDependencies: ProviderDiscoveryDependencies = {
  resolvePath,
  resolveLoginShellPaths,
  isExecutable: isExecutableFile,
  probe: probeProvider,
};

function unavailableCapability(
  provider: SupportedHostProviderKey,
  source: ProviderCapability["source"],
  unavailableReason: ProviderUnavailableReason,
): ProviderCapability {
  return {
    provider,
    discovered: false,
    available: false,
    source,
    resolvedPath: null,
    version: null,
    unavailableReason,
  };
}

export async function discoverProviderCapabilities(options: {
  providerKeys?: readonly SupportedHostProviderKey[];
  environment?: Environment;
  dependencies?: ProviderDiscoveryDependencies;
} = {}): Promise<ProviderCapability[]> {
  const providerKeys = options.providerKeys ?? supportedHostProviderKeys;
  const environment = options.environment ?? process.env;
  const dependencies = options.dependencies ?? defaultDependencies;
  const pathMatches = new Map<SupportedHostProviderKey, string | null>();
  const lookupCandidates = new Map<
    SupportedHostProviderKey,
    { source: ProviderCapability["source"]; resolvedPath: string } | null
  >();
  const shellCandidates: SupportedHostProviderKey[] = [];

  for (const provider of providerKeys) {
    const override = environmentValue(environment, environmentOverrideName(provider));
    if (override) {
      if (!await dependencies.isExecutable(override)) {
        lookupCandidates.set(provider, null);
        pathMatches.set(provider, null);
        continue;
      }
      lookupCandidates.set(provider, { source: "env-override", resolvedPath: override });
      continue;
    }

    const resolvedPath = await dependencies.resolvePath(provider, environment);
    pathMatches.set(provider, resolvedPath);
    if (resolvedPath) {
      lookupCandidates.set(provider, { source: "path", resolvedPath });
    } else {
      shellCandidates.push(provider);
    }
  }

  if (shellCandidates.length > 0) {
    const shellPaths = await dependencies.resolveLoginShellPaths(shellCandidates, environment);
    for (const provider of shellCandidates) {
      const resolvedPath = shellPaths.get(provider);
      lookupCandidates.set(
        provider,
        resolvedPath ? { source: "login-shell", resolvedPath } : null,
      );
    }
  }

  return Promise.all(providerKeys.map(async (provider) => {
    const override = environmentValue(environment, environmentOverrideName(provider));
    const candidate = lookupCandidates.get(provider);
    if (!candidate) {
      return unavailableCapability(
        provider,
        override ? "env-override" : "path",
        override ? "override-path-missing" : "not-found",
      );
    }

    const probe = await dependencies.probe(candidate.resolvedPath);
    if (!probe.available) {
      return {
        provider,
        discovered: true,
        available: false,
        source: candidate.source,
        resolvedPath: candidate.resolvedPath,
        version: null,
        unavailableReason: probe.unavailableReason ?? "exec-failed",
      };
    }
    return {
      provider,
      discovered: true,
      available: true,
      source: candidate.source,
      resolvedPath: candidate.resolvedPath,
      version: probe.version ?? "available",
      unavailableReason: null,
    };
  }));
}

export function clearLoginShellPathCache(): void {
  loginShellPathCache.clear();
}
