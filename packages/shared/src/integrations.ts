import { z } from "zod";

export const integrationConnectionStatusSchema = z.enum(["active", "inactive"]);
export type IntegrationConnectionStatus = z.infer<typeof integrationConnectionStatusSchema>;

export const integrationCredentialStateSchema = z.enum(["ready", "missing", "invalid"]);
export type IntegrationCredentialState = z.infer<typeof integrationCredentialStateSchema>;

export const integrationCapabilityStateSchema = z.enum(["enabled", "disabled", "unavailable"]);
export type IntegrationCapabilityState = z.infer<typeof integrationCapabilityStateSchema>;

const extensibleKeySchema = z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const integrationConnectionCapabilitySchema = z
  .object({
    state: integrationCapabilityStateSchema,
    config: jsonObjectSchema.default({}),
    permissions: jsonObjectSchema.default({}),
    accessSummary: jsonObjectSchema.default({}),
    verifiedAt: z.string().datetime().nullable().default(null),
  })
  .strict();
export type IntegrationConnectionCapability = z.infer<typeof integrationConnectionCapabilitySchema>;

export const integrationCapabilitiesSchema = z.record(extensibleKeySchema, integrationConnectionCapabilitySchema);
export type IntegrationCapabilities = z.infer<typeof integrationCapabilitiesSchema>;

const integrationConnectionMetadataSchema = z
  .object({
    integration: extensibleKeySchema,
    provider: extensibleKeySchema,
    authMethod: extensibleKeySchema,
    providerExternalId: z.string().trim().min(1).max(1_000),
    displayName: z.string().trim().min(1).max(255).nullable().default(null),
    providerSubject: jsonObjectSchema,
    connectionConfig: jsonObjectSchema.default({}),
    capabilities: integrationCapabilitiesSchema.default({}),
    credentialState: integrationCredentialStateSchema.default("ready"),
  })
  .strict();

export const integrationConnectionActivationSchema = integrationConnectionMetadataSchema.extend({
  teamId: z.string().uuid(),
}).strict();
export type IntegrationConnectionActivation = z.input<typeof integrationConnectionActivationSchema>;

export const integrationConnectionSchema = integrationConnectionMetadataSchema
  .extend({
    id: z.string().uuid(),
    teamId: z.string().uuid(),
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
  integrationConnectionMethodBaseSchema.extend({
    type: z.literal("api-key"),
    createUrl: z.string().startsWith("/"),
  }),
]);
export type IntegrationConnectionMethod = z.infer<typeof integrationConnectionMethodSchema>;

export const integrationProviderStatusSchema = z
  .object({
    integration: extensibleKeySchema,
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

export const linearApiKeyConnectionInputSchema = z.object({
  apiKey: z.string().trim().min(1).max(2_048),
  displayName: z.string().trim().min(1).max(255).optional(),
}).strict();
export type LinearApiKeyConnectionInput = z.infer<typeof linearApiKeyConnectionInputSchema>;

export const linearTeamSchema = z.object({
  id: z.string().trim().min(1).max(1_000),
  key: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(500),
  archivedAt: z.string().datetime().nullable().default(null),
}).strict();
export type LinearTeam = z.infer<typeof linearTeamSchema>;

export const linearTeamListResponseSchema = z.object({
  teams: z.array(linearTeamSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().min(1).nullable().optional(),
  }).strict(),
}).strict();
export type LinearTeamListResponse = z.infer<typeof linearTeamListResponseSchema>;
