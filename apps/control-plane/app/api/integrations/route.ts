import { NextResponse } from "next/server";

import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../_auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "integration-list");
    await requireTeamPermission(db, subject, "team.resource.access");
    return NextResponse.json({
      integrations: defaultIntegrationRegistry().list(),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
