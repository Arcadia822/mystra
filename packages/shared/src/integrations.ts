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

export const integrationConnectionRepositorySelectionSchema = z.enum(["all", "selected"]);
export type IntegrationConnectionRepositorySelection = z.infer<
  typeof integrationConnectionRepositorySelectionSchema
>;

export const integrationConnectionStatusSchema = z.enum(["active", "inactive"]);
export type IntegrationConnectionStatus = z.infer<typeof integrationConnectionStatusSchema>;

const integrationConnectionMetadataSchema = z
  .object({
    integration: repoProviderKindSchema,
    provider: repoProviderKindSchema,
    externalId: z.string().trim().min(1).max(255),
    account: integrationConnectionAccountSchema,
    repositorySelection: integrationConnectionRepositorySelectionSchema,
    permissions: z.record(z.string().min(1), z.string().min(1)),
  })
  .strict();

export const integrationConnectionActivationSchema = integrationConnectionMetadataSchema;
export type IntegrationConnectionActivation = z.infer<typeof integrationConnectionActivationSchema>;

export const integrationConnectionSchema = integrationConnectionMetadataSchema
  .extend({
    id: z.string().uuid(),
    status: integrationConnectionStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

export const integrationProviderStatusSchema = z
  .object({
    integration: repoProviderKindSchema,
    connectionType: z.string().trim().min(1).max(128),
    configured: z.boolean(),
    connectUrl: z.string().startsWith("/"),
  })
  .strict();
export type IntegrationProviderStatus = z.infer<typeof integrationProviderStatusSchema>;
