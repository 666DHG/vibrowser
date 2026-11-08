---
name: vibrowser-web-design
description: Design and review content-driven Vibrowser pages, choosing information structure and typography from the current content and reader task without preset website templates.
---

# Vibrowser 内容驱动设计

为当前内容设计，而不是为网站类别选择模板。这个 skill 用于生成页面与评审页面；浏览器外壳和纯后端修改不自动套用其视觉方向。

- 先读取 [内容计划](references/intent.md)，形成只描述内容关系和读者任务的简短 DesignBrief。生成 HTML/CSS 时读取 [设计决策](references/design.md)，由这一阶段决定实际视觉表达；不创建布局枚举或网站类别到组件的映射。
- 已有页面的评审读取 [评审规则](references/review.md)，基于当前任务、页面内容与实际测量指出具体问题。
- 输出必须遵守项目 WebDocument 契约，见 [运行契约](references/contract.md)。设计说明与评审不是网页正文。
- 来源及核验日期见 [来源](references/sources.md)。这些指导是本项目独立撰写的方法归纳，不包含上游模板、素材或脚本。

后端构建从本目录打包 intent.md、design.md 与 review.md；修改这些文件会改变模型实际使用的指导。不要另外维护一份隐藏的设计提示词。
