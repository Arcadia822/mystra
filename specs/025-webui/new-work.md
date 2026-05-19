# 新工作页面设计

**页面名称**: 新工作  
**页面职责**: 让用户像开启一次 agent 对话一样，把一个 project 范围内的工作交给 Mystra。  
**MVP 边界**: 用户只选择 `project` 并描述目标；所有执行配置从 project 和 workflow 默认配置推导。

## 设计原则

- 用户不是来配置 runner 的。用户是来交代一个要完成的工作。
- 页面不使用弹层，不使用右侧 inspector，不做上下区拆分，不展示执行预检。
- 首屏只保留两个核心动作：选择 project，输入工作描述。
- 任何不是用户当下必须理解的配置，都不进入新工作首屏。

## 用户旅程

1. 用户进入 `新工作` 页面。
2. 用户选择一个 project，例如 `mystra`。
3. 页面显示一个大 composer，提示用户描述要做的工作。
4. 用户输入目标、背景、验收标准或相关链接。
5. 用户点击提交后，Mystra 创建 task，并启动对应 run。
6. 系统跳转到 run detail，展示 task/run 的执行状态。

## 首屏结构

### Header

- 左侧只显示页面标题 `新工作`。
- 右侧可以保留全局页面动作，但 MVP 不需要额外配置按钮。

### Project Selector

- 必选。
- 控件应明显，但不应占据过多空间。
- 选择项展示 project 名称；必要时可以附带 repo slug，但不展示完整配置。
- 未选择 project 时，提交按钮不可用。

### Composer

- 主体是一个大输入框，类似 chat AI 的新对话入口。
- 输入内容是用户的自然语言工作描述。
- 可以支持多段文本，包括目标、背景、验收条件、相关 issue/spec 路径。
- MVP 不强制拆分 `实现请求` 与 `用户旅程` 两种模式；这类结构化解释可以由后续解析或模板增强承担。

### Submit

- 主按钮语义是创建 task，例如 `创建任务`。
- 点击后创建 task，并进入 run detail。
- 如果 project 未选择，按钮 disabled。
- 如果输入为空，按钮 disabled。

## 配置推导

新工作页面不要求用户手动选择 workflow、agent、repo、base branch 或 branch。

| 配置 | 来源 | 页面是否展示 |
| --- | --- | --- |
| project | 用户必选 | 展示 |
| workflow | project default workflow | 不在首屏展示 |
| agent | workflow agent config | 不在首屏展示 |
| repo | project repo config | 不在首屏展示 |
| base branch | project base branch | 不在首屏展示 |
| development branch | agent 按 project 规则生成 | 不在首屏展示 |
| context bundles | project/workflow 默认配置 | 不在首屏展示 |
| runtime image | project runtime config | 不在首屏展示 |
| runner eligibility | control plane 解析 | 不在首屏展示 |

## 提交语义

MVP 提交 payload 只需要表达用户意图和 project 归属：

```json
{
  "project": "mystra",
  "prompt": "把 Overview 的 Toplist 改成带条形图的列表，并更新对应文档。"
}
```

control plane 在服务端解析 project 默认配置，生成不可变的 task/run 执行输入。UI 不应该让用户在首屏承担这些配置判断。

## 状态

| 状态 | 行为 |
| --- | --- |
| No project | composer 可输入，提交 disabled，并提示先选择 project |
| Ready | project 已选且 prompt 非空，提交可用 |
| Creating | 提交按钮进入 loading，防止重复提交 |
| Created | 跳转 run detail |
| Create failed | 在 composer 附近显示错误，并保留用户输入 |

## 明确不做

- 不做弹层提交。
- 不做右侧 inspector。
- 不做执行预检区。
- 不做 workflow 手动选择。
- 不做 agent 手动选择。
- 不做 repo/base branch/development branch 手动编辑。

这些能力可能存在于 project 配置、运行详情或后续高级编辑能力中，但不应该进入新工作首屏。
