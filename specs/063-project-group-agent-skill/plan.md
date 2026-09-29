# Implementation Plan: 可移植项目群 Agent 业务 Skill

**Branch**: `063-project-group-agent-skill` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)（冻结业务来源 `MYST-38-SPEC-20260929-R2`）
**Input**: Feature specification from `specs/063-project-group-agent-skill/spec.md`；Linear MYST-38 已改写。

## Summary

新增仓库内可单独复制的 Agent Skill，不改变已有 `mystra-flow` 预设、平台 Skill Library、运行时或 DSH 插件。采用简短主 SKILL.md 与必要时的独立场景参考，先用无 Skill 压力场景观察错误，再写规则并复测。此方案是**业务规程资产**，不是将飞书/工作区能力伪装成服务端实现。

## Technical Context

**Language/Version**: Markdown + YAML frontmatter（Agent Skills 规范）；Node 24.14.0 用于静态检查。
**Primary Dependencies**: 无运行依赖；本仓库 `.agents/skills/` 的可发现路径。
**Storage**: 仅 Git 版本化文件；不发布至 Mystra Skill Library。
**Testing**: Agent 无/有 Skill 压力测试，frontmatter 检查，Spec-Kit/Taco 静态核对。
**Target Platform**: 能读取 Agent Skills 的任意 Agent 环境；本仓库仅是存放与版本控制位置。
**Project Type**: 便携流程 Skill，不是服务或 UI。
**Performance Goals**: 不适用（静态文本）。
**Constraints**: 不能调用不存在的 API；不引入配置、网络、存储或 Mystra 依赖；与旧预设并存但不是其替代或别名。
**Scale/Scope**: 一个 Skill 与一组最小 Spec-Kit 产物，不碰生产平台实现。

## Constitution Check

- I：已正式改写 Linear，本 Skill 仅书面指导，不扩展 Mystra MVP/触发器/API。
- II–IV：不新增服务边界、持久化、执行凭据或沙箱接口；强调来源和权限，不对外宣称部署。
- V：用无/有 Skill 的行为证据、静态结构与独立审查验证资产；无真实飞书接入不声称端到端通过。
- UI：无用户界面，`apps/spec-prototype` 不适用。GitNexus 运行流/影响分析不适用：只新增 Markdown，不编辑现有 symbol 或进程调用图。若后来触碰现有函数，先做 impact 检查。

## Project Structure

### Documentation (this feature)

```text
specs/063-project-group-agent-skill/
├── spec.md
├── plan.md
├── tasks.md
├── checklists/requirements.md
├── evidence/skill-verification.md
└── 063-project-group-agent-skill.taco.html
```

### Source Code (repository root)

```text
.agents/skills/project-group-agent/SKILL.md
```

**Structure Decision**: 仿照仓库现有 `.agents/skills/<name>/SKILL.md`，而非 `presets/skills/`。后者由 `publish-presets.mjs` 自动上传到 Mystra，既会引入平台侧交付声明又会破坏 `publish-presets.test.ts` 的预设清单。Skill 内容不含 Mystra 专属入口；仓库目录只是开发与分发载体，复制该目录即可脱离 Mystra。

## Design and verification gates

1. 需求门槛：确认源设计版本、Linear 新范围、用户的人审决定及原范围遗留；读取现有仓库 Skill/frontmatter 习惯。
2. RED：无 Skill 输入三类以上情景，保存模型原话与错误；包含仅查询却开楼、准备一半却退回群工作区、模糊批准等。
3. GREEN：写唯一完整 Skill，先写分诊/任务身份，再写空间协作/主动通知/两阶段；对相同情景和额外变体复测。不写从未验收的具体命令。
4. REVIEW：非作者检查遗漏、冻结设计一致性、措辞将内容与能力分开的真实性；修订后复测。Taco 只镜像本目录产物而非替代冻结源 Taco。
5. DELIVERY：校验 Skill frontmatter、Taco bundle、相关静态检查、Draft PR 关联；PR 停在合并前。

**工程评审**：无需引入接口/数据模型/运行图，也无并发代码或性能风险。最大风险为把书面规程当成飞书/工作区功能；通过前置条件、失败停机与明确验证界限解决。未来若要求真实承载，须另行设计并实测，不向当前 Skill 增加假的适配层。

## Complexity Tracking

无宪章例外。