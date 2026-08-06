import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readAppFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Automations placeholder contract", () => {
  it("does not expose Automations in primary navigation", () => {
    const shell = readAppFile("./_components/app-shell.tsx");

    expect(shell).not.toContain('{ key: "automations"');
  });

  it("keeps a directly addressable Coming soon page", () => {
    const page = readAppFile("./automations/page.tsx");

    expect(page).toContain("Coming soon");
  });
});
