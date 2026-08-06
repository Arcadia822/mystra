# Contract：RDB 启动配置

## Owner

`apps/control-plane/src/lib/db/config.ts` 解析环境变量并返回内部 discriminated union。
该 contract 不进入 `@mystra/shared`，因为它是 control-plane deployment configuration。

## Provider selector

| 变量 | 值 | 默认 | 说明 |
|---|---|---|---|
| `MYSTRA_RDB_PROVIDER` | `sqlite`, `postgresql`, `supabase` | `sqlite` | 仅在 provider singleton 初始化时读取 |

## SQLite

```ts
type SqliteRdbConfiguration = {
  provider: "sqlite";
  databasePath: string;
};
```

`MYSTRA_DB_PATH` 可选，缺省为 `<cwd>/data/mystra.db`。factory 在创建 adapter 前创建父目录。

## PostgreSQL

```ts
type PostgreSqlRdbConfiguration = {
  provider: "postgresql";
  runtimeUrl: string;
  directUrl: string;
  pool: { max: number; connectionTimeoutMillis: number; idleTimeoutMillis: number };
};
```

- `MYSTRA_DATABASE_URL`: required `postgres:`/`postgresql:` URL。
- `MYSTRA_DIRECT_DATABASE_URL`: optional；缺省明确等于 runtime URL。
- `MYSTRA_DB_POOL_MAX`: optional positive integer，default 10。
- `MYSTRA_DB_CONNECTION_TIMEOUT_MS`: optional positive integer，default 5000。
- `MYSTRA_DB_IDLE_TIMEOUT_MS`: optional non-negative integer，default 10000。

## Supabase

```ts
type SupabaseRdbConfiguration = PostgreSqlRdbConfiguration & {
  provider: "supabase";
};
```

`MYSTRA_DATABASE_URL` 与 `MYSTRA_DIRECT_DATABASE_URL` 均 required。runtime URL 可以是 direct、
session pooler 或 transaction pooler，选择由部署形态决定；migration command 只读取 direct URL。

## Validation and errors

- provider unknown: `INVALID_RDB_CONFIGURATION: unsupported MYSTRA_RDB_PROVIDER`。
- required value missing: 只报告变量名。
- invalid URL scheme: 只报告允许 scheme，不打印输入 URL。
- invalid pool value: 只报告变量名、范围和收到的非秘密数值。

禁止错误、日志、telemetry 和 test snapshots 输出 connection URL、username、password 或 query。

## Lifecycle

- `getDb()` 首次调用解析配置并返回 `Promise<RdbProvider>`。
- 后续调用复用同一个 provider promise，避免并发初始化多个 pools。
- 初始化失败时清除 promise，允许修正配置后显式重试。
- `resetDbForTests()` await `close()`，清除 singleton/config cache。
- 环境变量改变不会修改已初始化 provider。
