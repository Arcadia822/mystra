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

See the PR description for the evidence collected on the current deployment and for the
remaining blockers.
