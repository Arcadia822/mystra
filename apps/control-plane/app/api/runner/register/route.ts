import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runnerRegistrationSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { bearerToken, jsonError } from "@/lib/http";

function authorized(request: Request): boolean {
  const configured = process.env.MYSTRA_RUNNER_REGISTRATION_SECRET;
  const supplied = bearerToken(request);
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "RUNNER_REGISTRATION_UNAUTHORIZED", message: "Registration secret is invalid" } }, { status: 401 });
  }
  try {
    const body = runnerRegistrationSchema.parse(await request.json());
    const registration = getDb().registerRunner(body);

    return NextResponse.json({
      runner: registration.runner,
      credential: registration.credential,
      heartbeatIntervalSeconds: 20,
    });
  } catch (error) {
    return jsonError(error);
  }
}
