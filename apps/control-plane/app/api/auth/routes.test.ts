import { describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { POST as login } from "./login/route";
import { POST as register } from "./register/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

describe("unauthenticated session routes", () => {
  it.each([
    ["login", login, { username: "admin", password: "admin" }],
    ["register", register, { username: "operator", password: "correct horse battery staple" }],
  ])("rejects cross-origin %s before accessing persistence", async (_name, handler, body) => {
    const response = await handler(new Request(`https://control.example.test/api/auth/${_name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example.test",
      },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "csrf-failed", message: "csrf-failed" },
    });
    expect(getDb).not.toHaveBeenCalled();
  });
});
