import type { Permission, TeamRole } from "@mystra/shared";

export const rolePermissions: Readonly<Record<TeamRole, readonly Permission[]>> = {
  owner: [
    "team.settings.manage",
    "team.member.manage",
    "team.role.manage",
    "team.delete",
    "team.integration.manage",
    "team.resource.access",
  ],
  admin: [
    "team.member.manage",
    "team.integration.manage",
    "team.resource.access",
  ],
  member: [
    "team.resource.access",
  ],
};

export function hasPermission(role: TeamRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
