FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    openssh-client \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

RUN npm install -g @openai/codex@0.125.0 @github/copilot@1.0.39 pnpm@10.26.2

COPY packages/runner-image/skills /mystra/skills
ENV MYSTRA_SKILLS_DIR="/mystra/skills"

WORKDIR /mystra/workspace
