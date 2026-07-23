import { NextResponse } from "next/server";
import { issueDispatchRequestSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { dispatchIssue } from "@/lib/integrations/dispatch";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";

export async function POST(
  request: Request,
  context: { params: Promise<{ integration: string; identifier: string }> },
) {
  try {
    const { integration, identifier } = await context.params;
    const dispatchRequest = issueDispatchRequestSchema.parse(await request.json());
    const snapshot = await dispatchIssue({
      integrationName: integration,
      identifier,
      request: dispatchRequest,
      registry: defaultIntegrationRegistry(),
      db: getDb(),
    });
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
