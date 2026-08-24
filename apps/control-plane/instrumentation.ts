export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await Promise.all([
      import("./sentry.server.config"),
      import("./src/lib/skills/skill-service-factory")
        .then(({ initializeSkillContentStore }) => initializeSkillContentStore()),
    ]);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
