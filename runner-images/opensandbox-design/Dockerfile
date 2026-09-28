# syntax=docker/dockerfile:1
#
# Mystra OpenSandbox design sandbox image (MYST-38).
#
# Purpose: a credential-free execution image for the host-c1 OpenSandbox runtime that
# carries the three CLIs the requirement-design journey needs inside a real sandbox:
#   - gh         (GitHub CLI, pinned release tarball + SHA-256)
#   - linctl     (Linear CLI, built from the pinned upstream tag + SHA-256)
#   - taco-cli   (@tacobin/cli, pinned npm tarball + SHA-512)
#
# Deliberate non-goals:
#   - no model API keys, no ~/.linctl-auth.json, no gh hosts.yml, no npm tokens;
#   - no host mounts, no docker socket, no baked git credentials.
# Credentials reach a sandbox only through the caller's own environment at run time.
#
# The image is linux/amd64 to match host-c1 (Debian 12, x86_64).
# Build through scripts/build-opensandbox-design-image.sh so the base image digest and
# every pinned artifact checksum are enforced.

# Base images are overridable so the build script can pass the exact reviewed digest.
ARG GOLANG_IMAGE=golang:1.24.5-bookworm
ARG BASE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------------------
# Stage 1: build linctl from the pinned upstream source tag.
# ---------------------------------------------------------------------------
FROM ${GOLANG_IMAGE} AS linctl-builder

ARG LINCTL_VERSION=0.1.12
# sha256 of https://github.com/dorkitude/linctl/archive/refs/tags/v0.1.12.tar.gz
ARG LINCTL_SOURCE_SHA256=013d7a16ff062db66dca6edc56babd05a2a99f3b7631d54cab193f75026c39c0
# Module proxy and checksum database. Upstream defaults are used unless a build passes a
# reachable mirror (host-c1 cannot reach proxy.golang.org); the checksum database is still
# consulted, so dependency content stays verified either way.
ARG GOPROXY_URL=https://proxy.golang.org,direct
ARG GOSUMDB_URL=sum.golang.org
ENV GOPROXY=${GOPROXY_URL} GOSUMDB=${GOSUMDB_URL}

RUN set -eux; \
    curl -fsSL --retry 3 -o /tmp/linctl-src.tar.gz \
      "https://github.com/dorkitude/linctl/archive/refs/tags/v${LINCTL_VERSION}.tar.gz"; \
    echo "${LINCTL_SOURCE_SHA256}  /tmp/linctl-src.tar.gz" | sha256sum -c -; \
    mkdir -p /src; \
    tar -xzf /tmp/linctl-src.tar.gz -C /src --strip-components=1; \
    rm /tmp/linctl-src.tar.gz; \
    cd /src; \
    CGO_ENABLED=0 go build -trimpath \
      -ldflags "-s -w -X github.com/dorkitude/linctl/cmd.version=${LINCTL_VERSION}" \
      -o /out/linctl .; \
    test -x /out/linctl; \
    /out/linctl --version | grep -F "linctl version ${LINCTL_VERSION}"

# ---------------------------------------------------------------------------
# Stage 2: runtime image.
# ---------------------------------------------------------------------------
FROM ${BASE_IMAGE} AS runtime

ARG TARGETARCH=amd64
ARG GH_VERSION=2.101.0
# sha256 of gh_${GH_VERSION}_linux_amd64.tar.gz (published checksums file)
ARG GH_SHA256_AMD64=9bca2d1c16825f109907a23307628a2f0698fbf99662b73a5cf0b020293072b8
ARG LINCTL_VERSION=0.1.12
ARG TACO_CLI_VERSION=0.2.1
# sha512 (hex) of https://registry.npmjs.org/@tacobin/cli/-/cli-0.2.1.tgz
ARG TACO_CLI_SHA512_HEX=824e66e498ea186b293a6384258f33251c164b8775f8b01fb3931d75effd7f222ef8b11f237f3541fcf20fa853587245656beadb98744f0781b7c77a310c5310

LABEL org.opencontainers.image.title="Mystra OpenSandbox design sandbox"
LABEL org.opencontainers.image.description="Credential-free OpenSandbox image with gh, linctl and taco-cli for MYST-38 requirement design"
LABEL org.opencontainers.image.version="gh${GH_VERSION}-linctl${LINCTL_VERSION}-taco${TACO_CLI_VERSION}"
LABEL org.opencontainers.image.licenses="MIT"

ENV DEBIAN_FRONTEND=noninteractive

RUN set -eux; \
    apt-get update; \
    apt-get install --no-install-recommends -y \
      bash \
      ca-certificates \
      curl \
      git \
      gzip \
      jq \
      procps \
      tar \
      xz-utils; \
    rm -rf /var/lib/apt/lists/*

# GitHub CLI from the pinned upstream release tarball.
RUN set -eux; \
    test "${TARGETARCH}" = "amd64"; \
    curl -fsSL --retry 3 -o /tmp/gh.tar.gz \
      "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz"; \
    echo "${GH_SHA256_AMD64}  /tmp/gh.tar.gz" | sha256sum -c -; \
    mkdir -p /tmp/gh; \
    tar -xzf /tmp/gh.tar.gz -C /tmp/gh --strip-components=1; \
    install -m 0755 /tmp/gh/bin/gh /usr/local/bin/gh; \
    rm -rf /tmp/gh /tmp/gh.tar.gz; \
    gh --version | grep -F "${GH_VERSION}"

# Linear CLI built in the previous stage.
COPY --from=linctl-builder /out/linctl /usr/local/bin/linctl
RUN linctl --version | grep -F "${LINCTL_VERSION}"

# Taco CLI from the pinned npm tarball (installed from the verified archive so the
# published integrity hash, not registry metadata, decides what enters the image).
RUN set -eux; \
    curl -fsSL --retry 3 -o /tmp/taco-cli.tgz \
      "https://registry.npmjs.org/@tacobin/cli/-/cli-${TACO_CLI_VERSION}.tgz"; \
    echo "${TACO_CLI_SHA512_HEX}  /tmp/taco-cli.tgz" | sha512sum -c -; \
    npm install --global --no-fund --no-audit /tmp/taco-cli.tgz; \
    rm -f /tmp/taco-cli.tgz; \
    taco-cli --version | grep -F "\"binaryVersion\": \"${TACO_CLI_VERSION}\""

# The design workload writes here; OpenSandbox mounts its own workspace path.
WORKDIR /workspace

# No ENTRYPOINT: the OpenSandbox runtime installs its own bootstrap/execd launcher and
# supplies the workload command, so this image stays a plain toolchain carrier.
CMD ["sleep", "infinity"]
