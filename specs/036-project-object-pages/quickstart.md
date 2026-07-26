# 验证手册

## 1. 启动隔离控制面

使用临时 SQLite 文件和非默认端口：

```sh
MYSTRA_DB_PATH=/tmp/mystra-036.sqlite pnpm --filter @mystra/control-plane dev --port 3100
```

## 2. 准备本地 Project fixture

通过 canonical `POST /api/projects` 创建一个 local demo Project。不得读取 Linear、
GitHub Issue 或任何 `/api/integrations/*/issues` endpoint。

## 3. CLI 旅程

```sh
pnpm operator:cli -- projects list --control-plane-url http://127.0.0.1:3100
pnpm operator:cli -- projects inspect PROJECT_SLUG --control-plane-url http://127.0.0.1:3100
```

## 4. Web 旅程

依次打开：

1. `/projects`
2. `/projects/PROJECT_SLUG`
3. `/tasks`

核对 CLI 与 Web 的 id、slug、repo、base branch、agent、runtime、context 和 policy。

## 5. Browser gates

- console 无 error/warning；
- `/tasks` network 没有 `/api/integrations/*/issues`；
- 键盘可打开 Project 详情和触发 Refresh；
- 320、768、1024、1440px 无不可恢复溢出。
