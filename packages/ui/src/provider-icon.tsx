import { joinClassNames } from "./ui-actions.js";

export type ProviderIconName = "codex" | "copilot";

const PROVIDER_LABELS: Record<ProviderIconName, string> = {
  codex: "Codex provider",
  copilot: "GitHub Copilot provider",
};

export function ProviderIcon({
  className,
  provider,
}: {
  className?: string;
  provider: ProviderIconName;
}) {
  if (provider === "copilot") {
    return (
      <svg
        aria-label={PROVIDER_LABELS[provider]}
        className={joinClassNames("providerIcon", className)}
        data-provider-icon={provider}
        role="img"
        viewBox="0 0 96 96"
      >
        <path
          clipRule="evenodd"
          d="M95.688 67.968C92.245 73.949 72.252 88.062 48 88.062S3.755 73.949.312 67.968A2.9 2.9 0 0 1-.021 66.526V55.879c0-.442.068-.88.232-1.29 1.489-3.739 5.388-9.17 10.42-10.627.668-1.713 1.656-4.216 2.578-6.065A40.7 40.7 0 0 1 13 33.551c0-5.324 1.129-9.993 4.529-13.471 1.588-1.624 3.559-2.87 5.896-3.807C29.022 11.726 36.992 7.901 47.914 7.901s19.064 3.825 24.661 8.372c2.337.937 4.308 2.183 5.896 3.807C81.871 23.558 83 28.227 83 33.551c0 1.474-.054 2.933-.209 4.346.922 1.849 1.91 4.352 2.578 6.065 5.032 1.457 8.931 6.888 10.42 10.627.164.41.232.848.232 1.29v10.647c0 .505-.081 1.004-.333 1.442ZM51.253 32.261c-.17-1.327-.251-2.514-.254-3.575v-.084c.006-3.078.679-5.081 1.753-6.311 1.365-1.562 4.186-2.759 10.131-2.115 6.023.652 9.389 2.147 11.298 4.099C76.029 26.165 77 28.992 77 33.551c0 4.844-.698 7.706-2.233 9.447C73.308 44.653 70.434 46 64.139 46c-4.84 0-7.607-1.574-9.375-3.751-1.9-2.337-2.969-5.762-3.511-9.988Zm-6.506 0c.17-1.327.251-2.514.254-3.575v-.084c-.006-3.078-.679-5.081-1.753-6.311-1.365-1.562-4.186-2.759-10.131-2.115-6.023.652-9.389 2.147-11.298 4.099C19.971 26.165 19 28.992 19 33.551c0 4.844.698 7.706 2.233 9.447C22.692 44.653 25.566 46 31.861 46c4.84 0 7.607-1.574 9.375-3.751 1.9-2.337 2.969-5.762 3.511-9.988Zm3.942 11.737h-1.378a18.7 18.7 0 0 1-1.418 2.035C42.814 49.822 38.218 52 31.861 52c-6.9 0-11.956-1.436-15.129-5.034-.18-.205-.341-.419-.341-.419L16 46.966v26.336c5.739 3.119 18.058 8.716 32 8.716s26.261-5.597 32-8.716V46.966l-.391-.419s-.132.181-.341.419C76.095 50.564 71.039 52 64.139 52c-6.357 0-10.953-2.178-14.032-5.967a18.7 18.7 0 0 1-1.418-2.035Z"
          fill="currentColor"
          fillRule="evenodd"
        />
        <path d="M58 57a4 4 0 0 1 4 4v8a4 4 0 0 1-8 0v-8a4 4 0 0 1 4-4ZM38 57a4 4 0 0 1 4 4v8a4 4 0 0 1-8 0v-8a4 4 0 0 1 4-4Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      aria-label={PROVIDER_LABELS[provider]}
      className={joinClassNames("providerIcon", className)}
      data-provider-icon={provider}
      role="img"
      viewBox="0 0 16 16"
    >
      <g fill="currentColor">
        <circle cx="8" cy="4" r="3" />
        <circle cx="11.3" cy="5.4" r="3" />
        <circle cx="12" cy="9" r="3" />
        <circle cx="9.9" cy="11.7" r="3" />
        <circle cx="6.1" cy="11.7" r="3" />
        <circle cx="4" cy="9" r="3" />
        <circle cx="4.7" cy="5.4" r="3" />
        <circle cx="8" cy="8" r="4" />
      </g>
      <path d="m5.2 6.8 1.7 1.7-1.7 1.7M8.4 10.2h2.4" fill="none" stroke="var(--color-canvas)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  );
}
