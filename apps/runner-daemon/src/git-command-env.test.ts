import { describe, expect, it } from "vitest";

import { sanitizeGitCommandEnv, withGitProxyBypass } from "./git-command-env.js";

describe("git command environment", () => {
  it("removes proxy variables and forces non-interactive git prompts", () => {
    const env = sanitizeGitCommandEnv({
      PATH: "/usr/bin",
      HTTP_PROXY: "http://127.0.0.1:7899",
      HTTPS_PROXY: "http://127.0.0.1:7899",
      ALL_PROXY: "socks5://127.0.0.1:7898",
      NO_PROXY: "localhost",
      CUSTOM_FLAG: "1",
    });

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

  it("prepends empty git proxy overrides to command args", () => {
    expect(withGitProxyBypass(["clone", "--mirror", "repo", "mirror.git"])).toEqual([
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
});
