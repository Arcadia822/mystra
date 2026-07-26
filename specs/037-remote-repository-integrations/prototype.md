# Prototype

独立交互原型：[mockups/index.html](./mockups/index.html)

覆盖：

- Projects 空状态与“Create from GitHub”入口。
- GitHub repository picker 的 loading、error、empty 与 selection。
- Project create form 的 repository 强制绑定。
- Project detail 中 provider、remote identity 与 snapshot metadata。
- Integration capability 摘要，明确 GitHub 与 Linear 的能力差异。

限制：

- 原型不调用真实 GitHub、Linear 或 Mystra API。
- Issue 浏览仍按 Integration 分开，不恢复通用 Tasks Issue 面板。
- 视觉结构沿用当前 Control Plane，不引入新的设计系统。
