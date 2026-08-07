import { z } from "zod";

export const teamStatusSchema = z.enum(["active", "archived"]);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const membershipStatusSchema = z.enum(["active", "disabled"]);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const teamRoleSchema = z.enum(["owner", "admin", "member"]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const permissionSchema = z.enum([
  "team.settings.manage",
  "team.member.manage",
  "team.role.manage",
  "team.delete",
  "team.resource.access",
]);
export type Permission = z.infer<typeof permissionSchema>;

const teamDisplayNameSchema = z.string().trim().min(1).max(120);

export const teamViewSchema = z.object({
  id: z.string().uuid(),
  displayName: teamDisplayNameSchema,
  status: teamStatusSchema,
  currentUserRole: teamRoleSchema,
}).strict();
export type TeamView = z.infer<typeof teamViewSchema>;

export const teamListItemSchema = teamViewSchema.extend({
  isActive: z.boolean(),
}).strict();
export type TeamListItem = z.infer<typeof teamListItemSchema>;

export const createTeamRequestSchema = z.object({
  displayName: teamDisplayNameSchema,
}).strict();
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;

export const renameTeamRequestSchema = createTeamRequestSchema;
export type RenameTeamRequest = z.infer<typeof renameTeamRequestSchema>;

export const switchTeamRequestSchema = z.object({
  teamId: z.string().uuid(),
}).strict();
export type SwitchTeamRequest = z.infer<typeof switchTeamRequestSchema>;

export const memberViewSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  role: teamRoleSchema,
  status: membershipStatusSchema,
  allowedActions: z.array(permissionSchema),
}).strict();
export type MemberView = z.infer<typeof memberViewSchema>;

export const addMemberRequestSchema = z.object({
  username: z.string().min(1),
}).strict();
export type AddMemberRequest = z.infer<typeof addMemberRequestSchema>;

export const setMemberRoleRequestSchema = z.object({
  userId: z.string().uuid(),
  role: teamRoleSchema,
}).strict();
export type SetMemberRoleRequest = z.infer<typeof setMemberRoleRequestSchema>;

export const removeMemberRequestSchema = z.object({
  userId: z.string().uuid(),
}).strict();
export type RemoveMemberRequest = z.infer<typeof removeMemberRequestSchema>;
