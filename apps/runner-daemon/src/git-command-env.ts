export function sanitizeGitCommandEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, GIT_TERMINAL_PROMPT: "0" };
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

export function withGitProxyBypass(args: string[]): string[] {
  return [
    "-c",
    "http.proxy=",
    "-c",
    "https.proxy=",
    ...args,
  ];
}
