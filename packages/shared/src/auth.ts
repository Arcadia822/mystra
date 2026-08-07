import { z } from "zod";

const usernamePattern = /^[a-z0-9_]+$/u;
const reservedUsernames = new Set(["admin", "api", "auth", "mcp", "root", "system"]);

export function normalizeUsername(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

const normalizedUsernameSchema = z.string()
  .transform(normalizeUsername)
  .pipe(z.string().min(3).max(30).regex(usernamePattern));

export const usernameSchema = normalizedUsernameSchema
  .refine((value) => !reservedUsernames.has(value), "Username is reserved");
export type Username = z.infer<typeof usernameSchema>;

export const passwordSchema = z.string().min(1).max(1024);

export const registerRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
}).strict();
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  username: normalizedUsernameSchema,
  password: z.string().min(1).max(1024),
}).strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: passwordSchema,
}).strict();
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const changeDisplayNameRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();
export type ChangeDisplayNameRequest = z.infer<typeof changeDisplayNameRequestSchema>;

export const accountStatusSchema = z.enum(["active", "disabled"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountViewSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  status: accountStatusSchema,
  requirePasswordChange: z.boolean(),
}).strict();
export type AccountView = z.infer<typeof accountViewSchema>;

export const sessionViewSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  current: z.boolean(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
}).strict();
export type SessionView = z.infer<typeof sessionViewSchema>;
