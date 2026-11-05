# 运行契约入口

WebDocument v3 的权威类型位于 backend/src/main/scala/services/browser/objects，校验入口为 ValidateWebDocumentMessage；前端契约为 frontend/src/shared/webDocument.ts。

实际模型协议由 WebDocumentPrompt 组合设计资源与类型规则。不要在 skill 中复制完整 schema。保持自由 HTML/CSS、宿主动作、实体绑定和 sandbox 约束；协议与设计质量是两个独立检查。

数据库、消息类、Table 与 IO 规范见 docs/COURSE_STANDARDS.md。详细实现与预算见 docs/CONTENT_DRIVEN_DESIGN.md。
