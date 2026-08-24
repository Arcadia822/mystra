---
title: "Requirements checklist：Control Plane Skill 库"
taco_scope: spec
---

## Specification Quality Checklist

- [x] 没有 `[NEEDS CLARIFICATION]` 标记；owner 已确认阶段、存储、输入与生命周期边界。
- [x] 用户故事按独立价值排序，并包含 Given/When/Then 验收场景。
- [x] 功能要求使用 MUST/MAY，避免实现步骤替代产品合同。
- [x] 已明确 Team tenancy、Owner/Admin 管理权限与 Member 读取权限。
- [x] 已明确 ZIP-only、内存 lazy-entry 校验、S3-compatible-only 和不可变 Revision。
- [x] 已明确 archive、历史读取，以及 hard delete/GC/restore 后置。
- [x] 已明确 active name 才唯一；archive 释放名称，同名重新上传创建新 Skill ID。
- [x] 已删除 SkillCommand/operation ID/request idempotency ledger；发布恢复由 Revision 的 base Revision、ZIP SHA-256 与 publication status 承担。
- [x] Manifest entry 已明确为 Revision 内嵌 JSON value，不是独立数据库表。
- [x] Revision 不保存 file count、SKILL.md size、object ETag/version、idempotency key 或 expected resource revision。
- [x] Retryable provider/config failure 保持 uploading；只有不可恢复 invariant 才进入 failed。
- [x] ZIP canonical digest 已明确为 metadata-first/content-second，两阶段只读取每个 regular file content 一次。
- [x] Unknown frontmatter 已选择 safe parse then ignore；RDB 仅投影 name/description，原始 bytes 保留于 ZIP。
- [x] 初次可见 Skill 的 resourceRevision/ETag 固定为 1；隐藏 reservation 使用 0。
- [x] S3 credential 已统一为 explicit both-or-neither pair，否则 SDK default provider chain，无法解析时启动失败。
- [x] 容量指标已明确为独立目标，性能目标具有 fixture、sample count 和 evidence 要求。
- [x] 已明确 Agent/Session/Runtime 绑定与交付不在第一阶段。
- [x] 已覆盖 zip slip、zip bomb、链接、加密、碰撞、大小/CRC 和发布半失败。
- [x] 成功标准可通过合同、集成、安全与 UI 验收验证。
- [x] UI-facing feature 的 shared-code prototype 已完成并记录于 `prototype.md`；prototype 与 production route 的测试、typecheck、build 及 320/768/1024/1440px 真实浏览器检查通过。

## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric, adapted to Spec-Kit output rules.

**Quality Score: 96 / 100（高置信度）**

| Dimension | Score |
|---|---:|
| Business value | 28 / 30 |
| Functional completeness | 25 / 25 |
| User experience | 18 / 20 |
| Technical clarity | 15 / 15 |
| Scope discipline | 10 / 10 |
| **Total** | **96 / 100** |

外部 Taco review 的 `CLEARED_WITH_REQUIRED_SPEC_FIXES` 已逐项处理：三个必改合同缺口与三个非阻塞歧义均已闭合。剩余扣分只对应尚待实现阶段产生的真实 S3-compatible、性能和浏览器运行证据，不再存在会让两个工程师做出不同状态机或持久化 schema 的已知问题。
