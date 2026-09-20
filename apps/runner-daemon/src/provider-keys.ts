export const supportedHostProviderKeys = ["codex", "copilot", "pi"] as const;

export type SupportedHostProviderKey = (typeof supportedHostProviderKeys)[number];
