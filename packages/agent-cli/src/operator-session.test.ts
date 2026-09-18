import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  OperatorSessionError,
  defaultOperatorSessionPath,
  parseOperatorSession,
  readOperatorSession,
  resolveSubscriptionOrigin,
} from "./operator-session.js";

const tempDirs: string[] = [];

function tempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "mystra-cli-session-"));
  tempDirs.push(directory);
  return directory;
}

function sessionFile(contents: string, mode = 0o600): string {
  const file = path.join(tempDir(), "operator-session.json");
  writeFileSync(file, contents, { mode });
  chmodSync(file, mode);
  return file;
}

const validSession = JSON.stringify({
  version: 1,
  controlPlaneUrl: "https://control.example.test",
  sessionToken: "abcdefghijklmnop",
});

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("operator session reader", () => {
  it("reads the existing version 1 session shape", () => {
    const file = sessionFile(validSession);
    expect(readOperatorSession(file, process.getuid?.())).toEqual({
      controlPlaneUrl: "https://control.example.test",
      sessionToken: "abcdefghijklmnop",
    });
  });

  it("rejects a group or world readable file", () => {
    const file = sessionFile(validSession, 0o644);
    expect(() => readOperatorSession(file, process.getuid?.())).toThrow(OperatorSessionError);
  });

  it("refuses to follow a symlink to a valid session file", () => {
    const target = sessionFile(validSession);
    const link = path.join(tempDir(), "link.json");
    symlinkSync(target, link);
    expect(() => readOperatorSession(link, process.getuid?.())).toThrow(/symlink/u);
  });

  it("rejects a file owned by another uid", () => {
    const file = sessionFile(validSession);
    expect(() => readOperatorSession(file, (process.getuid?.() ?? 0) + 1)).toThrow(/another user/u);
  });

  it("rejects wrong versions, weak tokens, and insecure origins", () => {
    for (const contents of [
      JSON.stringify({ version: 2, controlPlaneUrl: "https://a.test", sessionToken: "abcdefghijklmnop" }),
      JSON.stringify({ version: 1, controlPlaneUrl: "https://a.test", sessionToken: "short" }),
      JSON.stringify({ version: 1, controlPlaneUrl: "http://control.example.test", sessionToken: "abcdefghijklmnop" }),
      "not json",
    ]) {
      const file = sessionFile(contents);
      expect(() => readOperatorSession(file, process.getuid?.())).toThrow(OperatorSessionError);
    }
  });

  it("accepts https and exact loopback http only", () => {
    expect(parseOperatorSession(JSON.stringify({
      version: 1,
      controlPlaneUrl: "http://127.0.0.1:3000/",
      sessionToken: "abcdefghijklmnop",
    })).controlPlaneUrl).toBe("http://127.0.0.1:3000");

    expect(() => parseOperatorSession(JSON.stringify({
      version: 1,
      controlPlaneUrl: "http://10.0.0.5:3000",
      sessionToken: "abcdefghijklmnop",
    }))).toThrow(OperatorSessionError);
  });

  it("resolves the default session path from the environment", () => {
    expect(defaultOperatorSessionPath({ MYSTRA_OPERATOR_STATE_PATH: "/tmp/custom.json" })).toBe("/tmp/custom.json");
    expect(defaultOperatorSessionPath({})).toMatch(/operator-session\.json$/u);
  });

  it("refuses a --server that differs from the session origin", () => {
    expect(resolveSubscriptionOrigin({
      sessionOrigin: "https://control.example.test",
      serverOverride: "https://control.example.test/",
    })).toBe("https://control.example.test");

    expect(() => resolveSubscriptionOrigin({
      sessionOrigin: "https://control.example.test",
      serverOverride: "https://other.example.test",
    })).toThrow(/must match/u);

    expect(() => resolveSubscriptionOrigin({
      sessionOrigin: "https://control.example.test",
      serverOverride: "http://control.example.test",
    })).toThrow(/https URL or a loopback/u);
  });
});
