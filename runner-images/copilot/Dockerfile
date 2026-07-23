FROM node:24.14.0-bookworm-slim

ARG COPILOT_CLI_VERSION=1.0.69-0

LABEL org.opencontainers.image.title="Mystra Copilot Runner"
LABEL org.opencontainers.image.description="Generic local Docker sandbox for bounded Copilot CLI execution"
LABEL org.opencontainers.image.version="${COPILOT_CLI_VERSION}"

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
      bash \
      ca-certificates \
      curl \
      git \
      procps \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global \
      "@github/copilot@${COPILOT_CLI_VERSION}" \
      "corepack@0.34.6" \
    && corepack prepare pnpm@10.25.0 --activate \
    && copilot --version | grep -F "GitHub Copilot CLI ${COPILOT_CLI_VERSION}"

WORKDIR /workspace

CMD ["sleep", "infinity"]
