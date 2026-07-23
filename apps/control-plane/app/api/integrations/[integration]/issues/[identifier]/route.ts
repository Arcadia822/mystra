import { NextResponse } from "next/server";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ integration: string; identifier: string }> },
) {
  try {
    const { integration, identifier } = await context.params;
    const issue = await defaultIntegrationRegistry()
      .requireIssueProvider(integration)
      .getIssue(identifier);
    if (!issue) {
      throw new IntegrationFailure({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${identifier}`,
      });
    }
    return NextResponse.json({ issue });
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
