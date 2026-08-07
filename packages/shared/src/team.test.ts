import { describe, expect, it } from "vitest";

import { permissionSchema, teamRoleSchema } from "./team.js";

describe("Team and RBAC contracts", () => {
  it("keeps the first-slice role and permission catalogs closed", () => {
    expect(teamRoleSchema.options).toEqual(["owner", "admin", "member"]);
    expect(permissionSchema.options).toContain("team.resource.access");
    expect(permissionSchema.safeParse("project.delete").success).toBe(false);
  });
});
