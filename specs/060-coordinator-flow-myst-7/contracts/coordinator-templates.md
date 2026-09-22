# Contract: Coordinator Flow & Message Templates

## 1. Coordinator 调用 Mystra MCP 的契约模式

### 1.1 创建任务 (Task Creation)
```json
{
  "name": "mystra_create_task",
  "arguments": {
    "title": "[需求设计] MYST-4：用户旅程 1 飞书触发与 Taco 评审",
    "description": "由飞书 Thread (root_id: om_xxx) 触发的需求设计任务。目标 Issue: MYST-4",
    "projectId": "00000000-0000-4000-8000-000000000041",
    "idempotencyKey": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d"
  }
}
```

### 1.2 生产启动 (Task Start Production)
```json
{
  "name": "mystra_start_task_production",
  "arguments": {
    "taskId": "c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "runtimeId": "00000000-0000-4000-8000-000000000061",
    "providerKey": "pi",
    "initialInstruction": "【第一阶段：需求设计与 Taco 评审】\n目标 Issue: MYST-4\n执行要求：\n1. 检出分支 feature/myst-4-req-design，提关联目标 Issue 的 Draft PR；\n2. 研读仓库规范，编写 specs/060-coordinator-flow-myst-7/spec.md；\n3. 执行 taco-cli publish 发布独立评审链接；\n4. 调用 linctl 将 Issue 状态置为 In Review 并回填 Taco URL；\n5. 输出 Taco URL 与 Draft PR 链接供人类评审。",
    "expectedRevision": 1,
    "idempotencyKey": "9e8d7c6b-5a4f-3e2d-1c0b-a9b8c7d6e5f4"
  }
}
```

---

## 2. 飞书 Thread 消息模板

### 2.1 任务启动通知模板
```text
🤖 已受理需求：[MYST-4] 用户旅程 1 需求设计
📌 对应工程：Mystra (Arcadia822/mystra)
🚀 已启动 host-c1 沙盒设计任务 (Task ID: c1a2b3c4...)
⏳ 正在检出分支、提 Draft PR 并撰写 Spec 规范，请稍候...
```

### 2.2 Taco 评审就绪通知模板
```text
📋 需求设计草案已生成，请集中评审：

🔗 交互式 Taco 评审地址：https://taco.internal/review/xxx
🔀 远程 Draft PR：https://github.com/Arcadia822/mystra/pull/123
📑 规范文件：specs/060-coordinator-flow-myst-7/spec.md

💡 评审指引：
1. 请直接在 Taco 页面中划词批注或留下评论；
2. 全部评论添加完毕后，请在当前 Thread 回复「已评论，请修改」触发沙盒更新；
3. 满意后请在当前 Thread 回复「通过」完成阶段固化。
```

### 2.3 批注修改中继确认模板
```text
🔄 已收到批注修改要求，正在通知沙盒 Agent 批量处理...
⏳ Agent 将批量更新规范、推送 PR 并刷新当前 Taco 空间，完成后将在此通知。
```

### 2.4 Taco 刷新完成通知模板
```text
✨ 需求规范与 Taco 已根据最新批注完成更新！

🔗 评审地址保持不变：https://taco.internal/review/xxx
🔀 远程 PR 已增量同步更新
📝 本轮修改点概览：
- ...

请确认最新修改，满意请回复「通过」，如需继续调整请继续批注并告知。
```

### 2.5 批准固化完成模板
```text
🎉 第一阶段【需求设计与 Taco 评审】已通过并完成固化！

📦 阶段交付成果：
- 规范文件：specs/060-coordinator-flow-myst-7/spec.md
- Taco 归档：specs/060-coordinator-flow-myst-7/060-coordinator-flow-myst-7.taco.html
- 关联 PR：https://github.com/Arcadia822/mystra/pull/123 (已归档最新设计资产)

🚀 下一步：
已就绪，可随时进入第二阶段【开发方案设计与技术评审】。
```
