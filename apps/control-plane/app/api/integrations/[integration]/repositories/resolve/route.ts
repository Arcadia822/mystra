import { NextResponse } from "next/server";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  try {
    const { integration } = await context.params;
    const identifier = new URL(request.url).searchParams.get("identifier")?.trim();
    if (!identifier) {
      return NextResponse.json({
        error: {
          code: "INVALID_REQUEST",
          message: "Repository identifier is required",
        },
      }, { status: 400 });
    }
    const repository = await defaultIntegrationRegistry()
      .requireRepoProvider(integration)
      .getRepository(identifier);
    if (!repository) {
      throw new IntegrationFailure({
        code: "REPOSITORY_NOT_FOUND",
        message: `Repository not found: ${identifier}`,
      });
    }
    return NextResponse.json({ repository });
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
