# Generic Copilot Runner Image Build

Recorded: 2026-07-23

## Build

Command:

```bash
fnm exec --using 24.14.0 corepack pnpm runner:image:build
```

Result: PASS.

The host had loopback-only proxy variables pointing at `127.0.0.1`; the build script
correctly skipped those because they are unreachable from BuildKit. Direct container
network access succeeded. The resulting local image is:

```text
mystra-copilot-runner:1.0.69-0
sha256:2065af424f8800498ce8d9b402d24cf5a85771a1c3ddea1557b04090a5bbb278
```

## Runtime verification

| Command | Observed |
|---------|----------|
| `copilot --version` | `GitHub Copilot CLI 1.0.69-0.` |
| `node --version` | `v24.14.0` |
| `pnpm --version` | `10.25.0` |

The Copilot npm package is pinned to the exact published version
`@github/copilot@1.0.69-0`; the image tag, OCI version label and runtime output agree.

## Secret inspection

- The final image environment contains only standard PATH, Node and Yarn version
  variables.
- Docker history contains no Linear key, GitHub token, Copilot token, authorization
  value or API-key marker.
- No credential was provided as a build argument.

Result: PASS.
