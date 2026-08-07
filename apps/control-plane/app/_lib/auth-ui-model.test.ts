import { describe, expect, it } from "vitest";

import { apiErrorMessage, safeReturnDestination } from "./auth-ui-model";

describe("auth UI model", () => {
  it("keeps only local return destinations", () => {
    expect(safeReturnDestination("/projects?view=active")).toBe("/projects?view=active");
    expect(safeReturnDestination("//untrusted.example")).toBe("/");
    expect(safeReturnDestination("https://untrusted.example")).toBe("/");
    expect(safeReturnDestination(null)).toBe("/");
  });

  it("describes permission and conflict responses without exposing internals", () => {
    expect(apiErrorMessage("forbidden")).toBe("You do not have permission to make this change.");
    expect(apiErrorMessage("last-owner-protected")).toBe(
      "At least one active Owner must remain on this Team.",
    );
    expect(apiErrorMessage("csrf-failed")).toBe(
      "Your browser session could not be verified. Reload the page and try again.",
    );
  });
});
