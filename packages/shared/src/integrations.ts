import { z } from "zod";

import { repoProviderKindSchema } from "./repository.js";

export const integrationConnectionAccountSchema = z
  .object({
    externalId: z.string().trim().min(1).max(255),
    login: z.string().trim().min(1).max(255),
    type: z.string().trim().min(1).max(64),
    avatarUrl: z.string().url().optional(),
  })
  .strict();
export type IntegrationConnectionAccount = z.infer<typeof integrationConnectionAccountSchema>;

export const integrationConnectionRepositorySelectionSchema = z.enum(["all", "selected", "token"]);
export type IntegrationConnectionRepositorySelection = z.infer<
  typeof integrationConnectionRepositorySelectionSchema
>;

export const integrationConnectionStatusSchema = z.enum(["active", "inactive"]);
export type IntegrationConnectionStatus = z.infer<typeof integrationConnectionStatusSchema>;

export const integrationConnectionTypeSchema = z.enum(["github-app", "personal-access-token"]);
export type IntegrationConnectionType = z.infer<typeof integrationConnectionTypeSchema>;

export const integrationCredentialStateSchema = z.enum(["ready", "missing", "invalid"]);
export type IntegrationCredentialState = z.infer<typeof integrationCredentialStateSchema>;

const integrationConnectionMetadataSchema = z
  .object({
    integration: repoProviderKindSchema,
    provider: repoProviderKindSchema,
    connectionType: integrationConnectionTypeSchema.default("github-app"),
    externalId: z.string().trim().min(1).max(255),
    displayName: z.string().trim().min(1).max(255).optional(),
    account: integrationConnectionAccountSchema,
    repositorySelection: integrationConnectionRepositorySelectionSchema,
    permissions: z.record(z.string().min(1), z.string().min(1)),
    credentialState: integrationCredentialStateSchema.default("ready"),
  })
  .strict();

export const integrationConnectionActivationSchema = integrationConnectionMetadataSchema;
export type IntegrationConnectionActivation = z.input<typeof integrationConnectionActivationSchema>;

export const integrationConnectionSchema = integrationConnectionMetadataSchema
  .omit({ externalId: true })
  .extend({
    id: z.string().uuid(),
    externalId: z.string().trim().min(1).max(255).optional(),
    status: integrationConnectionStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

const integrationConnectionMethodBaseSchema = z
  .object({
    configured: z.boolean(),
    disabledReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const integrationConnectionMethodSchema = z.discriminatedUnion("type", [
  integrationConnectionMethodBaseSchema.extend({
    type: z.literal("github-app"),
    connectUrl: z.string().startsWith("/"),
  }),
  integrationConnectionMethodBaseSchema.extend({
    type: z.literal("personal-access-token"),
    createUrl: z.string().startsWith("/"),
  }),
]);
export type IntegrationConnectionMethod = z.infer<typeof integrationConnectionMethodSchema>;

export const integrationProviderStatusSchema = z
  .object({
    integration: repoProviderKindSchema,
    methods: z.array(integrationConnectionMethodSchema).min(1),
  })
  .strict();
export type IntegrationProviderStatus = z.infer<typeof integrationProviderStatusSchema>;

export const personalAccessTokenConnectionInputSchema = z
  .object({
    token: z.string().trim().min(1).max(1_024),
    displayName: z.string().trim().min(1).max(255).optional(),
  })
  .strict();
export type PersonalAccessTokenConnectionInput = z.infer<
  typeof personalAccessTokenConnectionInputSchema
>;
