import { NextResponse } from "next/server";
import { contextBundleCreateSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";

function contextBundleError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return NextResponse.json({ contextBundles: getDb().listContextBundles({ includeArchived }) });
}

export async function POST(request: Request) {
  try {
    const contextBundle = getDb().createContextBundle(contextBundleCreateSchema.parse(await request.json()));
    return NextResponse.json({ contextBundle }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONTEXT_BUNDLE_SLUG_CONFLICT") || message.includes("UNIQUE constraint failed")) {
      return contextBundleError("CONTEXT_BUNDLE_SLUG_CONFLICT", message, 409);
    }
    return contextBundleError("INVALID_CONTEXT_BUNDLE", message || "Invalid context bundle payload", 400);
  }
}
