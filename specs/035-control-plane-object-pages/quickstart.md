# 验证手册

## 1. 启动隔离控制面

使用临时 SQLite 文件和非默认端口，避免接触现有运行数据或 Linear：

```sh
MYSTRA_DB_PATH=/tmp/mystra-035.sqlite pnpm --filter @mystra/control-plane dev --port 3100
```

## 2. 准备本地 fixture

通过 canonical Projects/Jobs/Runner API 创建：

- 一个 local demo Project；
- 一个 queued Task；
- 一个可取消 Task；
- 一个 Runner session。

不得请求 `/api/integrations/linear/*`。

## 3. CLI 旅程

```sh
pnpm operator:cli -- control-plane inspect --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- runners list --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- runners inspect RUNNER_ID --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- tasks list --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- tasks inspect JOB_ID --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- tasks cancel JOB_ID --control-plane-url http://127.0.0.1:3100
```

## 4. Web 旅程

依次打开：

1. `/`
2. `/runners`
3. `/runners/RUNNER_ID`
4. `/tasks`
5. `/tasks/JOB_ID`

核对 CLI 与 Web 的 id、state、heartbeat、capacity、project、branch 和 cancel 结果。

## 5. Plugin 旅程

验证 `plugins/mystra` 后，通过 `mystra-open-control-plane`：

- 打开 overview；
- 打开 Runner detail；
- 打开 Task detail；
- 在 3100 不可达时确认明确失败。
