interface GitCommandProxyOptions {
  bypassProxy?: boolean;
}

export function shouldBypassGitProxy(repoUrl: string): boolean {
  if (repoUrl.startsWith("ssh://")) {
    return true;
  }

  try {
    return new URL(repoUrl).protocol === "ssh:";
  } catch {
    return /^[^/:\s]+@[^/:\s]+:.+$/.test(repoUrl);
  }
}

export function sanitizeGitCommandEnv(
  baseEnv: NodeJS.ProcessEnv,
  options: GitCommandProxyOptions = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, GIT_TERMINAL_PROMPT: "0" };
  if (!options.bypassProxy) {
    return env;
  }

  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
  ]) {
    delete env[key];
  }
  return env;
}

export function withGitProxyBypass(
  args: string[],
  options: GitCommandProxyOptions = {},
): string[] {
  if (!options.bypassProxy) {
    return args;
  }

  return [
    "-c",
    "http.proxy=",
    "-c",
    "https.proxy=",
    ...args,
  ];
}
