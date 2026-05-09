import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.MYSTRA_ENABLE_DEBUG_ENDPOINTS !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const eventId = await Sentry.startNewTrace(() =>
    Sentry.startSpan(
      {
        name: "Mystra Sentry debug trace",
        op: "mystra.debug",
        forceTransaction: true,
        parentSpan: null,
        attributes: {
          "mystra.service": "control-plane",
        },
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        Sentry.logger.info("Mystra Sentry debug log", {
          service: "control-plane",
          route: "/api/debug/sentry",
        });
        return Sentry.captureException(new Error("Mystra Sentry debug event"));
      },
    ),
  );
  await Sentry.flush(2000);
  return NextResponse.json({ ok: true, eventId });
}
