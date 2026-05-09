import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const allowedDevOrigins = (process.env.MYSTRA_CONTROL_PLANE_ALLOWED_DEV_ORIGINS ?? "localhost")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  transpilePackages: ["@mystra/shared"],
};

export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  silent: true,
  disableLogger: true,
});
