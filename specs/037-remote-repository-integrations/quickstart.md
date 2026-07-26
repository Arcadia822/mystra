# Quickstart: 远程 Repository 标准场景

## 1. 准备授权

```sh
export MYSTRA_GITHUB_TOKEN="$(gh auth token)"
test -n "$LINEAR_API_KEY"
```

不得把输出写入 evidence。

## 2. 创建全新测试 repository

使用唯一名称创建 private GitHub repository，加入最小可 test/build/preview 的 Web fixture，再创建一个 GitHub Issue。记录 repository URL 与 Issue URL，不记录 token。

## 3. 启动 Mystra

使用全新 SQLite path 启动 Control Plane 与 Runner，确保旧 `repo` schema 不参与测试。

## 4. 验证同源管理路径

```sh
pnpm operator:cli -- integrations list
pnpm operator:cli -- repositories list --integration github --limit 10
pnpm operator:cli -- repositories get OWNER/REPO --integration github
pnpm operator:cli -- projects create \
  --name "Remote fixture" \
  --slug remote-fixture \
  --repository-integration github \
  --repository OWNER/REPO \
  --agent copilot \
  --runtime-image mystra-copilot:fixture
pnpm operator:cli -- projects inspect remote-fixture --json
pnpm operator:cli -- issues get ISSUE_NUMBER \
  --integration github \
  --repository OWNER/REPO
pnpm operator:cli -- issues list --integration linear --limit 1
```

在 Web UI 重复 repository selection 与 Project read，字段必须与 CLI JSON 一致。

## 5. 分派与执行

```sh
pnpm operator:cli -- issues dispatch ISSUE_NUMBER \
  --integration github \
  --project remote-fixture \
  --agent copilot \
  --branch codex/remote-repository-e2e
pnpm operator:cli -- tasks wait JOB_ID
```

验收：test/build 通过、preview 可访问、branch 与 PR 位于全新 repository、状态为 `waiting_for_review`。

## 6. Removal audit

```sh
rg -n 'repo: "local/|repo: z\\.string|job\\.spec\\.repo|project\\.repo' \
  packages apps scripts
```

结果必须为零；测试中描述宿主机 workspace 的 `localRepoPath` 不属于 Project repository compatibility。
