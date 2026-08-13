# 工程评审：标准执行提示词与可选 Agent 上下文

**日期**: 2026-08-12
**结论**: CLEAR
**未决策项**: 0
**关键缺口**: 0

## Scope Challenge

范围保持不变。Agent可选性跨 shared schema、RDB、Session、workload projection和所有 Start adapter，是一个不可拆成 UI shortcut的合同替换。未扩大到 Agent管理、Task删除、delivery验真、多 Agent或Workflow。

## What already exists

| 现有能力 | 复用方式 |
| --- | --- |
| `TaskProductionService.assign` | 直接重命名/替换为 canonical `start`，保留 Workspace continuation与幂等结构 |
| `assignTaskForProduction` | 保留短事务，增加事务内 optional Agent snapshot读取 |
| `SessionService.launch` | 保留原子 Session + 4个初始事件写入，替换 prompt/Agent输入 |
| `session.system_prompt_configured` | 继续作为 prompt evidence source of truth |
| `RuntimeSessionService.claim` | 继续只读取 frozen finalPrompt |
| Runner + Provider adapter | 继续只执行 finalPrompt，不引入 prompt ownership |
| `TaskProductionPanel` | 复用现有 Runtime/Provider/状态控制面，Agent控件改为可选 |
| `mystra-agent` | 只替换 identity projection，不增加寻址或外部工具代理 |

## Findings 与处理

### 1. 人工 prompt版本可能与文本漂移

**处理**: version改为 `sha256:<content digest>`。同一文本稳定，文本变化自动产生新版本，避免人工双写。

### 2. service预读 Agent不能满足原子冻结

**处理**: nullable `agentId`进入 RDB Start command，在同一 transaction中验证 active/Team并生成完整 snapshot。service预读只能用于非权威提示，不作为冻结事实。

### 3. 只让 Harness nullable会在 Session launch重新制造必填门槛

**处理**: Harness、Session、launch request、created event、claim assignment和workload identity全部采用 `0..1` Agent Context。

### 4. prompt components不能用固定长度四元组继续表达 optional段

**处理**: shared schema改为有序 4..5数组并做顺序 refinement；顶层 `agentContext:null|snapshot`提供明确缺席证据。

### 5. adapter可能各自发明默认 Agent

**处理**: API、operator CLI、MCP、Web全部parse同一个 `taskStartRequestSchema`并调用 `TaskProductionService.start`；测试覆盖 omitted/null/UUID/empty。

### 6. Runner若重新拼装 prompt会破坏优先级

**处理**: Runner/adapter contract保持只接收 `assignment.systemPrompt == evidence.finalPrompt`；增加 regression test，禁止传 Agent prompt作为override。

### 7. 历史审查需要 Agent name而现有 Harness只冻结ID/revision/prompt

**处理**: Harness snapshot增加 nullable name；Session event冻结完整 snapshot。Task production与Session event presentation从冻结事实显示，不查询当前 Agent。

### 8. GitNexus报告RDB CRITICAL、Session launch HIGH

**处理**: 不重构巨型 `PrismaRdbProvider`；修改限制在Start/Harness/Session rows和mapping。验证必须包含RDB contract、SQLite、schema parity、Session lifecycle/execution E2E与全量测试。PostgreSQL仅在真实URL运行后声明。

## Architecture review

数据流只有一个prompt owner：Control Plane Session launch。Start adapter不组装prompt，RDB不理解prompt优先级，Runner/Provider不解析Agent snapshot。该分层避免五个入口产生五套默认行为。

原子边界保持：

```text
Start tx: Task status + transition + Harness(optional Agent snapshot)
commit
Workspace I/O
Session tx: Session + prompt evidence + Workspace attachment + first message
commit
Runner/Provider I/O
```

## Test review

```text
shared schema/golden prompt
  -> RDB nullable snapshot + idempotency/race
     -> TaskProductionService Start
        -> Session launch/evidence
           -> API/CLI/MCP/Web adapters
              -> workload context
                 -> Runner/Provider finalPrompt
                    -> HTTP + Runner journey
```

必须覆盖：

- omitted与null同 intent；empty string拒绝；UUID显式选择。
- 同key null→UUID conflict；20-way无 Agent并发只产生一个attempt。
- Agent update/archive race只冻结一个一致revision或失败。
- 无 Agent和有 Agent的component顺序、最终文本、历史冻结。
- Harness/Session/evidence optional snapshot任一不一致都fail closed。
- Web在0 active Agent时没有selector且Start可用；存在Agent时默认None。
- operator CLI、MCP与HTTP request shape一致。
- Runner child只获得finalPrompt与attempt capability；无默认Agent环境变量。

## Failure modes

| 路径 | 现实失败 | Test | Error handling | 用户可见性 |
| --- | --- | --- | --- | --- |
| Standard Prompt解析 | content空/超限 | 是 | fail closed | 明确Start失败 |
| Start transaction | Agent在并发中归档 | 是 | transaction conflict/unavailable | 明确错误 |
| idempotent replay | agent choice变化 | 是 | conflict | 明确错误 |
| Session launch | evidence与nullable字段不一致 | 是 | create/claim拒绝 | 明确Session conflict |
| CLI/MCP parse | empty Agent ID | 是 | invalid request | 稳定错误 |
| Runner claim | 初始prompt event缺失 | 是 | claim拒绝 | execution failure，不静默 |
| 历史投影 | 当前Agent已删除/归档 | 是 | 使用冻结event | 正确历史值 |

无 silent critical gap。

## Performance review

- Start新增一次 transaction-local Agent lookup，仅在显式选择时发生，主键索引O(1)。
- Standard Prompt SHA-256只在模块初始化或launch解析时计算，文本规模有界。
- Review projection读取既有初始事件的有界窗口，不增加全局扫描。
- 不新增轮询、N+1 Agent lookup或Runner round trip。

## Parallelization

Sequential implementation, no parallelization opportunity。shared/RDB nullable合同是所有adapter和测试的共同前置，且当前未提交051基线集中在同一工作树。

## NOT in scope

- Agent管理或模板：Agent仍由046拥有。
- Task删除/reopen/第二attempt：独立生命周期规格。
- Prompt编辑/评测/AB测试：本期只建立程序合同与证据。
- PR/测试验真或外部CLI代理：保持051边界。
- 多 Agent/Workflow/Recipe/Artifact：不由optional context顺便引入。

## TODOS.md

没有值得延期到 `TODOS.md` 的新项目。所有必需合同和风险都属于052本体；其他事项已经明确在规格范围外。

## Completion Summary

- Step 0 Scope Challenge：scope accepted as-is
- Architecture Review：3类跨边界风险，均已写入计划
- Code Quality Review：3个合同一致性问题，均有直接方案
- Test Review：完整测试图，0个未覆盖critical gap
- Performance Review：0个阻断问题
- NOT in scope：已写
- What already exists：已写
- TODOS.md updates：0
- Failure modes：0 critical gaps
- Outside voice：skipped
- Parallelization：1 sequential lane
- Completeness：10/10
