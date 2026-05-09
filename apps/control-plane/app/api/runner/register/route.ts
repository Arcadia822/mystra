import { NextResponse } from "next/server";
import { runnerRegistrationSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = runnerRegistrationSchema.parse(await request.json());
    const session = getDb().registerRunner(body);

    return NextResponse.json({
      runnerSessionId: session.id,
      runnerToken: session.token,
    });
  } catch (error) {
    return jsonError(error);
  }
}
