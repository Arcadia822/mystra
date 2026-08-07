import { describe, expect, it } from "vitest";

import { loginRequestSchema, normalizeUsername, registerRequestSchema } from "./auth.js";

describe("local authentication contracts", () => {
  it("normalizes usernames before validating uniqueness input", () => {
    expect(normalizeUsername("  Alice_01  ")).toBe("alice_01");
    expect(registerRequestSchema.parse({ username: " Alice_01 ", password: "long-enough-password" }).username)
      .toBe("alice_01");
  });

  it("rejects reserved and malformed registration input but accepts non-empty passwords", () => {
    expect(registerRequestSchema.safeParse({ username: "admin", password: "long-enough-password" }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ username: "a!", password: "long-enough-password" }).success).toBe(false);
    expect(registerRequestSchema.parse({ username: "alice", password: "short" }).password).toBe("short");
    expect(registerRequestSchema.safeParse({ username: "alice", password: "" }).success).toBe(false);
  });

  it("accepts an existing credential password only for login", () => {
    expect(loginRequestSchema.parse({ username: " Admin ", password: "admin" })).toEqual({
      username: "admin",
      password: "admin",
    });
  });
});
