import { integrationConnectionListResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readSecretStoreConfig } from "@/lib/secrets";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "connection-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    let patConfigured = false;
    let patDisabledReason: string | undefined;
    try {
      patConfigured = readSecretStoreConfig() !== undefined;
      if (!patConfigured) patDisabledReason = "Secret store is not configured";
    } catch {
      patDisabledReason = "Secret store configuration is invalid";
    }
    const response = NextResponse.json(integrationConnectionListResponseSchema.parse({
      providers: [
        {
          integration: "github",
          methods: [
            {
              type: "personal-access-token",
              configured: patConfigured,
              createUrl: "/api/integration-connections/github/pat",
              ...(patDisabledReason ? { disabledReason: patDisabledReason } : {}),
            },
          ],
        },
        {
          integration: "linear",
          methods: [
            {
              type: "api-key",
              configured: patConfigured,
              createUrl: "/api/integration-connections/linear/api-key",
              ...(patDisabledReason ? { disabledReason: patDisabledReason } : {}),
            },
          ],
        },
      ],
      connections: (await db.listIntegrationConnections({ teamId: active.team.id }))
        .filter((connection) => (
          connection.integration === "github" && connection.authMethod === "personal-access-token"
        ) || (
          connection.integration === "linear" && connection.authMethod === "api-key"
        )),
    }));
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
