import * as Sentry from "@sentry/node";

export function initSentry(serviceName: string): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? "dev-machine",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    enableLogs: process.env.SENTRY_ENABLE_LOGS !== "0",
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "info", "warn", "error"] }),
    ],
    sendDefaultPii: false,
    initialScope: {
      tags: {
        service: serviceName,
      },
    },
  });
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  await Sentry.flush(timeoutMs);
}
