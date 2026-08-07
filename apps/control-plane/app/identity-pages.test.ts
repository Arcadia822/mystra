import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("identity control-plane pages", () => {
  it("uses username/password-only authentication fields", () => {
    const form = source("./_components/auth/auth-form.tsx");

    expect(form).toContain('name="username"');
    expect(form).toContain('type="password"');
    expect(form.toLowerCase()).not.toContain("email");
  });

  it("keeps unauthenticated and forced-password states outside the application shell", () => {
    const gate = source("./_components/control-plane-gate.tsx");

    expect(gate).toContain('router.replace(`/login?return=${encodeURIComponent(returnTo)}`)');
    expect(gate).toContain('passwordChangeRequired');
    expect(gate).toContain("<RequiredPasswordGate />");
  });

  it("renders member lifecycle and access states", () => {
    const members = source("./_components/team-members.tsx");

    for (const state of ["Loading members", "Read-only", "No active Team", "Team members updated"]) {
      expect(members).toContain(state);
    }
    expect(members).toContain('aria-live="polite"');
  });
});
