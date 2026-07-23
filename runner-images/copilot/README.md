# Generic Copilot Runner Image

This repository-owned image is the local Docker sandbox used by the 033 acceptance
path. It contains Node 24.14.0, pnpm 10.25.0, Git and GitHub Copilot CLI 1.0.69-0.
It contains no repository source, credential, API key or user-specific configuration.

Build it from the repository root:

```bash
pnpm runner:image:build
```

The default tag is `mystra-copilot-runner:1.0.69-0`. Override only the output tag:

```bash
MYSTRA_RUNNER_IMAGE_TAG=local/copilot:test pnpm runner:image:build
```

The build script forwards standard proxy build arguments when they are already set in
the caller environment. Never add Linear, GitHub or Copilot credentials as build args:
they would become image/build metadata. Runtime credentials are injected only into the
single process that needs them.

Verify the installed CLI without supplying a token:

```bash
docker run --rm --entrypoint copilot mystra-copilot-runner:1.0.69-0 --version
```
