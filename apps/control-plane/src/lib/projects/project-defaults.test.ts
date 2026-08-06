import { describe, expect, it } from "vitest";

import { readProjectDefaults } from "./project-defaults";

describe("readProjectDefaults", () => {
  it("uses Mystra's global development defaults when overrides are absent", () => {
    expect(readProjectDefaults({})).toMatchObject({
      defaultAgent: "copilot",
      runtime: { provider: "docker", image: "mystra-runner:local" },
    });
  });

  it("uses explicit platform-wide Agent and development image overrides", () => {
    expect(readProjectDefaults({
      MYSTRA_DEFAULT_AGENT: "codex",
      MYSTRA_DEFAULT_DEV_IMAGE: "ghcr.io/mystra/dev:2026-08-06",
    })).toMatchObject({
      defaultAgent: "codex",
      runtime: { provider: "docker", image: "ghcr.io/mystra/dev:2026-08-06" },
    });
  });

  it("rejects invalid configured defaults instead of silently changing them", () => {
    expect(() => readProjectDefaults({ MYSTRA_DEFAULT_AGENT: "claude" })).toThrow(
      /MYSTRA_DEFAULT_AGENT/,
    );
    expect(() => readProjectDefaults({ MYSTRA_DEFAULT_DEV_IMAGE: "" })).toThrow(
      /MYSTRA_DEFAULT_DEV_IMAGE/,
    );
  });
});
