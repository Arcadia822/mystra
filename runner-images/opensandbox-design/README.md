# OpenSandbox design sandbox image (MYST-38)

Reproducible, credential-free container image for the **host-c1 OpenSandbox runtime** that
carries the CLIs the requirement-design journey needs *inside a real sandbox*: `gh`
(GitHub CLI), `linctl` (Linear CLI) and `taco-cli` (Taco Host publish/review CLI).

Scope (MYST-38 / [#64](https://github.com/Arcadia822/mystra/issues/64)): the image and its
build/verification recipe only. The Feishu/DSH bridge (`dsh-im`) is explicitly out of scope,
and so is exposing the lifecycle service to untrusted callers.

## Contents and pinned inputs

| Input | Pinned value | Integrity check |
| --- | --- | --- |
| Base image | `node:22-bookworm-slim` (`linux/amd64`) | `sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c` (asserted by the build script) |
| Builder image (linctl) | `golang:1.24.5-bookworm` (`linux/amd64`) | `sha256:ef8c5c733079ac219c77edab604c425d748c740d8699530ea6aced9de79aea40` (asserted by the build script) |
| `gh` (GitHub CLI) | `2.101.0` | SHA-256 `9bca2d1c16825f109907a23307628a2f0698fbf99662b73a5cf0b020293072b8` of `gh_2.101.0_linux_amd64.tar.gz` |
| `linctl` (Linear CLI) | `0.1.12` | SHA-256 `013d7a16ff062db66dca6edc56babd05a2a99f3b7631d54cab193f75026c39c0` of the upstream `v0.1.12` source archive; built `CGO_ENABLED=0` from source |
| `taco-cli` (`@tacobin/cli`) | `0.2.1` | SHA-512 hex `824e66e498ea186b293a6384258f33251c164b8775f8b01fb3931d75effd7f222ef8b11f237f3541fcf20fa853587245656beadb98744f0781b7c77a310c5310` of the npm tarball |
| Architecture | `linux/amd64` | `TARGETARCH` assertion in the Dockerfile, `--platform` in the build script |

Also present as prerequisites: `bash`, `ca-certificates`, `curl`, `git`, `gzip`, `jq`,
`procps`, `tar`, `xz-utils`, and the `node` runtime that `taco-cli` needs.

Why these versions:

- `gh` and `linctl` match the toolchain the operator already uses on the workstation
  (`2.101.0` / `0.1.12`), so sandbox behaviour matches local behaviour.
- `@tacobin/cli` `0.2.1` is the newest published release of the CLI that publishes to the
  Taco Host (`https://taco.arcadia-han.com`, host release line `v0.11.0`), and it carries the
  `binaryVersion`/`package.json` sync fix. The operator workstation still has `0.1.4`
  installed; the version is a single `ARG` in the Dockerfile if the pair has to be moved.

## Build

```bash
scripts/build-opensandbox-design-image.sh
# → mystra-opensandbox-design:20260928  (linux/amd64)
```

The script refuses to build when the base image digest is not the reviewed one, then runs
`scripts/verify-opensandbox-design-image.sh` against the result.

Behind a network that cannot reach Docker Hub directly, fetch the base and builder images
through a mirror first; the script re-tags them locally so the Dockerfile stays canonical:

```bash
MYSTRA_DESIGN_BASE_MIRROR=docker.m.daocloud.io scripts/build-opensandbox-design-image.sh
```

The mirror manifest digest equals the Docker Hub digest for both base images (content
addressed), so the pinned digests above stay valid either way. On host-c1 the Docker daemon
cannot reach Docker Hub at all (its proxy drop-in does not carry `registry-1.docker.io`), so
the mirror path plus `docker tag` to the canonical names is the working local procedure.

Proxied builds inherit `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` as build args, mirroring
`scripts/build-runner-image.sh`.

## Verification

`scripts/verify-opensandbox-design-image.sh <image>` inspects the built image, not the
Dockerfile text:

1. platform is `linux/amd64`;
2. `gh`, `linctl`, `taco-cli`, `git` and `node` run with `--network none`;
3. no credential material is baked in — no auth files (`.linctl-auth.json`, gh `hosts.yml`,
   `.netrc`, `.git-credentials`, ssh keys, docker config), no credential-bearing `ENV`, and
   no token-shaped strings under `/root`, `/home`, `/etc`, `/workspace`, `/usr/local/bin`.

The image deliberately bakes **no** model keys, GitHub/Linear tokens or Taco Host
credentials. A sandbox receives credentials only from the caller's own environment at
create time; nothing in this recipe mounts host auth or the Docker socket into a guest.

## Runtime wiring on host-c1

The sandbox image is selected per create request (`image`), so pointing the journey at this
image does not require changing the deployed `opensandbox` runtime configuration:

```bash
Image: mystra-opensandbox-design:20260928
```

OpenSandbox injects its own `execd` (from `runtime.execd_image`) plus
`bootstrap.sh`/launcher into the guest container, so the image stays a plain toolchain
carrier and needs no OpenSandbox-specific entrypoint.

Deployed BOM this image is expected to run under (host-c1, Debian 12, x86_64):

| Component | Version / digest |
| --- | --- |
| `opensandbox-server` | `1.1.0` (`/opt/opensandbox` venv) |
| `execd` image | `sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/execd:v1.1.0`, commit `48b0215f1bd097b31d0f022a44640e00c11ac49d` |
| egress image | `sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/egress:v1.1.7` |
| config | `/etc/opensandbox/config.toml`, unit `/etc/systemd/system/opensandbox.service` |

## Isolation gate before starting the service

`opensandbox.service` is **not** started for real users until a guest container on the
deployment's own bridge is shown to be unable to reach the host lifecycle API or to run
code as root through the guest-resident `execd`. `scripts/verify-opensandbox-isolation.sh`
runs exactly those probes on the deployed build (fake credential only, no host mounts, no
host ports, no real secrets) and exits non-zero when any probe fails.

### Result on host-c1 (2026-09-28): gate NOT passed, service left stopped

Built and verified on the host:

| Item | Value |
| --- | --- |
| Image | `mystra-opensandbox-design:20260928`, id `sha256:39129f7e59f6ccb54f441957608b4575b4f8a2736b057801c1d7c6884314121c`, 378,479,737 bytes, `linux/amd64` |
| `scripts/verify-opensandbox-design-image.sh` | PASS (tool presence + no credential ENV/files/token strings) |
| Tools in a real OpenSandbox sandbox (uid 65534, `/workspace`) | `gh 2.101.0`, `linctl 0.1.12`, `taco-cli 0.2.1`, `git 2.39.5`, `node v22.23.3` |
| Sandbox posture | `network_mode=bridge`, `capDrop=[AUDIT_WRITE MKNOD NET_ADMIN NET_RAW SYS_ADMIN SYS_MODULE SYS_PTRACE SYS_TIME SYS_TTY_CONFIG]`, `no-new-privileges=true`, no host binds, execd published `0.0.0.0:44772`→host port |

Probe results against the deployed execd (`sandbox-registry…/execd:v1.1.0`, image digest
`sha256:6cf7dba2f21f0b536e100563d841ac58a9f31c2b0a081b7ac76796a24d6f47e2`, build commit
`48b0215f1bd097b31d0f022a44640e00c11ac49d`):

| Probe | Result |
| --- | --- |
| R1 unauthenticated `/command` from uid 65534, execd without a token (deployment default) | HTTP 200, `uid=0(root)` |
| R2 unauthenticated `/command`, execd with `-access-token` | HTTP 401 |
| R2 authenticated `/command` | HTTP 200, `uid=0(root)` — the token is root-equivalent |
| R2 token exposure, `-access-token` argv | visible to any in-container process in world-readable `/proc/1/cmdline` |
| R2 token exposure, `EXECD_ACCESS_TOKEN` in the sandbox env (real sandbox) | `/proc/1/environ` denied to uid 65534, but the token **is inherited by the workload execd spawns** |
| R3 cross-sandbox (`bridge`) | sandbox A (uid 65534) → sandbox B execd = HTTP 200, `uid=0` |
| P1 lifecycle API from a guest, deployed `host = "0.0.0.0"` | `/health` reachable from the bridge (HTTP 200); management calls need `OPEN-SANDBOX-API-KEY` (401 without) |
| P1 lifecycle API from a guest, `host = "127.0.0.1"` | connection refused |

Two further deployment facts found during the run:

- `docker.publish_host = "127.0.0.1"` in `/etc/opensandbox/config.toml` is not honoured by
  this server build (the key is not referenced anywhere in `opensandbox_server`): created
  sandboxes publish execd on `0.0.0.0`, so any host, LAN or tailnet peer can reach a
  sandbox's execd. Confirmed from a tailnet peer with an unauthenticated `/command` that
  returned `uid=0(root)` inside the sandbox container.
- `execd` runs the workload as root by design, so the per-sandbox access token — not the
  uid — is the only barrier. Neither delivery path hides it from the sandbox: argv is
  readable through `/proc/1/cmdline`, and an environment token is inherited by the workload
  execd spawns. A token therefore only separates an *unprivileged* guest process from root;
  it does not make the sandbox unusable-by/opaque-to its own workload.

Therefore `opensandbox.service` was left `inactive`/`disabled`; every sandbox created for
this validation was deleted, the deployed config/unit were not modified, and all
pre-existing images were preserved. Required before a real start:

1. bind `[server] host` to the tailnet address and add `INPUT` drops for the docker bridge
   interfaces on the API port;
2. stop sharing one bridge with inter-container communication: per-sandbox networks with
   ICC disabled (or `enable_icc=false`);
3. give every sandbox an execd access token delivered via the environment (never argv) and
   treat it as root-equivalent;
4. re-run `scripts/verify-opensandbox-isolation.sh` with R1/R2/R3 clean before enabling the
   unit.

### Host build notes (host-c1)

- DNS on the host listed the tailnet addresses `100.96.0.2`/`100.96.0.3` (tailnet device IPs,
  configured outside this work), which timed out for every query and blocked all outbound
  fetches. The build ran with public resolvers prepended temporarily; that hand-written
  content is gone. Re-applying the tailscale DNS setting (`tailscale set --accept-dns=true`)
  made tailscaled regenerate `/etc/resolv.conf` with MagicDNS (`100.100.100.100`, IPv6
  resolver, search domain `tail0fe215.ts.net`), which resolves both tailnet and public names.
  No hand-written resolver configuration remains on the host.
- The Docker daemon cannot reach Docker Hub (its proxy drop-in does not cover
  `registry-1.docker.io`), so the base and builder images are pulled through
  `docker.m.daocloud.io` and re-tagged locally; the mirror digests equal the Docker Hub
  digests recorded above.
- `proxy.golang.org` is unreachable; the linctl stage is built with
  `MYSTRA_DESIGN_GOPROXY=https://goproxy.cn,direct` and
  `MYSTRA_DESIGN_GOSUMDB=sum.golang.google.cn` so dependency content stays checksum-verified.
