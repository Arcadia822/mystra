export const supportedHostProviderKeys = ["codex", "copilot"] as const;

export type SupportedHostProviderKey = (typeof supportedHostProviderKeys)[number];
