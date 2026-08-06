import { integrationConnectionListResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { readGitHubAppConfig } from "@/lib/integrations/github-app";

export async function GET() {
  return NextResponse.json(integrationConnectionListResponseSchema.parse({
    providers: [{
      integration: "github",
      connectionType: "github-app-installation",
      configured: readGitHubAppConfig() !== undefined,
      connectUrl: "/api/integration-connections/github/connect",
    }],
    connections: getDb().listIntegrationConnections(),
  }));
}
