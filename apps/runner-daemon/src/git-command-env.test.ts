import { describe, expect, it } from "vitest";

import { sanitizeGitCommandEnv, shouldBypassGitProxy, withGitProxyBypass } from "./git-command-env.js";

describe("git command environment", () => {
  it("removes proxy variables and forces non-interactive git prompts when bypassing", () => {
    const env = sanitizeGitCommandEnv({
      PATH: "/usr/bin",
      HTTP_PROXY: "http://127.0.0.1:7899",
      HTTPS_PROXY: "http://127.0.0.1:7899",
      ALL_PROXY: "socks5://127.0.0.1:7898",
      NO_PROXY: "localhost",
      CUSTOM_FLAG: "1",
    }, { bypassProxy: true });

    expect(env).toMatchObject({
      PATH: "/usr/bin",
      CUSTOM_FLAG: "1",
      GIT_TERMINAL_PROMPT: "0",
    });
    expect(env.HTTP_PROXY).toBeUndefined();
    expect(env.HTTPS_PROXY).toBeUndefined();
    expect(env.ALL_PROXY).toBeUndefined();
    expect(env.NO_PROXY).toBeUndefined();
  });

  it("preserves proxy variables when bypass is disabled", () => {
    const env = sanitizeGitCommandEnv({
      PATH: "/usr/bin",
      HTTPS_PROXY: "http://proxy.internal:8080",
    });

    expect(env).toMatchObject({
      PATH: "/usr/bin",
      HTTPS_PROXY: "http://proxy.internal:8080",
      GIT_TERMINAL_PROMPT: "0",
    });
  });

  it("prepends empty git proxy overrides to command args when bypassing", () => {
    expect(withGitProxyBypass(["clone", "--mirror", "repo", "mirror.git"], { bypassProxy: true })).toEqual([
      "-c",
      "http.proxy=",
      "-c",
      "https.proxy=",
      "clone",
      "--mirror",
      "repo",
      "mirror.git",
    ]);
  });

  it("leaves git command args unchanged when bypass is disabled", () => {
    expect(withGitProxyBypass(["clone", "--mirror", "repo", "mirror.git"])).toEqual([
      "clone",
      "--mirror",
      "repo",
      "mirror.git",
    ]);
  });

  it("bypasses proxy only for ssh remotes", () => {
    expect(shouldBypassGitProxy("ssh://git@git.cloudwise.com:36000/castrel/castrel-ai.git")).toBe(true);
    expect(shouldBypassGitProxy("git@github.com:Arcadia822/mystra.git")).toBe(true);
    expect(shouldBypassGitProxy("https://github.com/Arcadia822/mystra.git")).toBe(false);
  });
});
