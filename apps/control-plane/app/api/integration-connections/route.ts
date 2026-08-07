import { integrationConnectionListResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readSecretStoreConfig } from "@/lib/secrets";

export async function GET() {
  const db = await getDb();
  let patConfigured = false;
  let patDisabledReason: string | undefined;
  try {
    patConfigured = readSecretStoreConfig() !== undefined;
    if (!patConfigured) patDisabledReason = "Secret store is not configured";
  } catch {
    patDisabledReason = "Secret store configuration is invalid";
  }
  const response = NextResponse.json(integrationConnectionListResponseSchema.parse({
    providers: [{
      integration: "github",
      methods: [
        {
          type: "personal-access-token",
          configured: patConfigured,
          createUrl: "/api/integration-connections/github/pat",
          ...(patDisabledReason ? { disabledReason: patDisabledReason } : {}),
        },
      ],
    }],
    connections: (await db.listIntegrationConnections())
      .filter((connection) => connection.authMethod === "personal-access-token"),
  }));
  response.headers.set("cache-control", "no-store");
  return response;
}
