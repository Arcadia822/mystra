# 060 T012 证据：资产全量发布到 host-c1 的真实 Mystra

## 结论

**T012 全量通过（Agent Profiles + Skill Library）**。

在 host-c1 上落地本地 MinIO（解决 MYST-29）后，`presets/` 下的两个 Agent Profile 和 `mystra-flow` Skill 全部通过 canonical 管理 API 成功发布并回读，对象存储中已落盘真实 ZIP。

## 目标环境

```text
host-c1 (100.89.186.36, Tailscale) — http://100.89.186.36:3000
控制面      pid 232452，端口 3000，运行中
对象存储    https://127.0.0.1:9000 (MinIO Docker, TLS, path-style, bucket=mystra-skills-dev)
证书        /root/.mystra/minio/certs/public.crt (NODE_EXTRA_CA_CERTS)
```

## 运行方式

```sh
node scripts/e2e-publish-presets.mjs \
  --control-plane-url http://100.89.186.36:3000 \
  --session-token 0NsF5lUEibwiu4wpXwgOSbUivdLibiDLVa8RNQaJDgM \
  --with-skills
```

## 结果（`node v24.14.0`，2026-09-22T09:07:13Z）

| 检查 | 结果 |
|---|---|
| external control plane reachable | PASS — `agents: 2` |
| publish creates both Agent Profiles | PASS |
| re-publish is a no-op | PASS — 两者均 `unchanged` |
| read-back matches the preset bytes | PASS — 逐字节一致 |
| drifted preset publishes a new revision | PASS — `coordinator:updated`、`requirement-designer:unchanged` |
| revision advanced and new text persisted | PASS |
| canonical text restored | PASS |
| target left matching presets/ | PASS — 目标服务端文本与 `presets/` 一致 |
| **skill publish** | **PASS** — `mystra-flow` published (r1 created, r2 updated) |

MinIO 桶内真实对象（通过 `@aws-sdk/client-s3` ListObjects 验证）：

```text
teams/55177907-18a5-4a3b-8b35-6db529f22bd6/skills/f434106e-8a22-4aa8-a24e-83e48290fbf5/revisions/2ef9112d-.../bundle.zip  (3571 bytes)
teams/55177907-18a5-4a3b-8b35-6db529f22bd6/skills/f434106e-8a22-4aa8-a24e-83e48290fbf5/revisions/f3d0766a-.../bundle.zip  (3571 bytes)
```

## 在 host-c1 上的变更汇总

1. **MinIO 容器**：`mystra-minio`（Docker，`quay.io/minio/minio:latest`，监听 `127.0.0.1:9000` 与 `9001`，卷挂载 `/root/.mystra/minio/data`，证书挂载 `/root/.mystra/minio/certs`，`restart: unless-stopped`）。
2. **TLS 证书**：`/root/.mystra/minio/certs/{private.key,public.crt}`（自签，有效期 10 年，SAN 包含 127.0.0.1、host-c1、localhost）。
3. **控制面环境变量**（`/root/.mystra/runner.env`）：
   - `MYSTRA_SKILL_STORAGE_ENDPOINT=https://127.0.0.1:9000`
   - `MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID=mystra-skill-admin`
   - `MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY=mystra-skill-admin-secret`
   - `MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE=true`
   - `NODE_EXTRA_CA_CERTS=/root/.mystra/minio/certs/public.crt`
4. **控制面服务**：重启一次加载新环境变量（无停机故障）。
5. **资产落库**：
   - Agent `coordinator`、`requirement-designer` 均已在库。
   - Skill `mystra-flow` 已在库，ZIP 在 MinIO 桶内。
   - MYST-29 已闭环（Done）。
6. **未解决项**：T013（端到端流程验收）仍阻塞于 MYST-28（Session 续接入口未落地）。
