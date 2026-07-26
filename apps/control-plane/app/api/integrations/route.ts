import { NextResponse } from "next/server";

import { defaultIntegrationRegistry } from "@/lib/integrations/registry";

export async function GET() {
  return NextResponse.json({
    integrations: defaultIntegrationRegistry().list(),
  });
}
