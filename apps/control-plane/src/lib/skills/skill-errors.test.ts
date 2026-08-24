import { describe, expect, it } from "vitest";

import { RdbError } from "../db/prisma-errors";
import { SkillContentStoreError } from "./skill-content-store";
import { SkillFailure, asSkillFailure, skillHttpStatus } from "./skill-errors";
import { SkillZipValidationError } from "./skill-zip-validator";

describe("Skill error mapping", () => {
  it("maps validation, storage and persistence failures to stable public codes", () => {
    expect(asSkillFailure(new SkillZipValidationError("unsafe_path", "unsafe")))
      .toMatchObject({ code: "invalid_skill_zip" });
    expect(asSkillFailure(new SkillContentStoreError("skill_storage_unavailable", "temporary")))
      .toMatchObject({ code: "skill_storage_unavailable" });
    expect(asSkillFailure(new RdbError("RDB_NOT_FOUND", "Skill not found")))
      .toMatchObject({ code: "skill_not_found" });
    expect(asSkillFailure(new RdbError("RDB_CONFLICT", "Skill resource revision changed")))
      .toMatchObject({ code: "revision_conflict" });
  });

  it("uses bounded HTTP semantics without provider or tenant existence leakage", () => {
    expect(skillHttpStatus("skill_not_found")).toBe(404);
    expect(skillHttpStatus("revision_conflict")).toBe(409);
    expect(skillHttpStatus("skill_file_not_previewable")).toBe(422);
    expect(skillHttpStatus("skill_storage_unavailable")).toBe(503);
    const failure = new SkillFailure("skill_not_found", "Skill not found");
    expect(failure).toMatchObject({ name: "SkillFailure", code: "skill_not_found" });
    expect(failure).not.toHaveProperty("cause");
  });

  it("does not forward unexpected raw error messages", () => {
    const failure = asSkillFailure(new Error("postgresql://user:secret@private-host/database"));
    expect(failure).toMatchObject({ code: "publication_failed" });
    expect(String(failure)).not.toContain("private-host");
    expect(String(failure)).not.toContain("secret");
  });
});
