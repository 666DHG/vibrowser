# Vibrowser

> Browse what exists. Imagine what doesn't.

一个浏览 AI 虚构互联网与虚构文件的浏览器式 Web 应用。输入地址即可创造页面，点击链接继续探索；已经生成的内容持久保存，再次访问保持一致。

当前状态：**仓库与开发规划已初始化，尚未实现可运行应用。**

## 开发入口

- [三天开发路线与验收标准](docs/ROADMAP.md)
- [架构、接口边界与待确认事项](docs/ARCHITECTURE.md)
- [对话依据与 API 核验记录](docs/SOURCES.md)

## MVP 技术方向

| 层 | 方案 | 职责 |
| --- | --- | --- |
| 前端 | TypeScript + React | 浏览器外壳、PageSpec 渲染、虚构文件预览 |
| 后端 | Scala 3 + Cats Effect + http4s | 导航、AI 调用、校验、任务与持久化 |
| 数据库 | PostgreSQL | 页面、网站设定、生成任务 |
| 文本生成 | DeepSeek / 腾讯 TokenHub，后端可配置 | 生成结构化内容 |
| 图片生成 | 腾讯图片 API，可选 | 异步配图；不可用时保留占位图 |

AI 生成数据，应用执行规则。第一版采用 PageSpec JSON + 声明式 Action，不执行模型生成的 JavaScript。

## 范围

必须完成：地址栏、基础标签页与历史导航、AI 网页、虚构 Markdown/TXT/JSON 文件、链接探索、持久化、加载和失败状态。

可选增强：搜索生成、异步生图、显式外部打开真实网页。自由 HTML/CSS 模式、自然语言编辑、账号系统和通用 Agent 留到后续。

`file://` 仅是应用内部的虚拟地址，不映射到用户电脑。真实网页与虚构页面采用显式模式，默认生成模式不会探测地址是否存在。

## 仓库约定

- 主分支：`main`。
- 配置与源码使用 UTF-8；普通文本使用 LF。
- API Key 仅放后端本地环境配置，禁止进入前端包或 Git。
- 当前未提供启动命令；Day 1 建立可运行骨架后补充。

规划整理于 2026-11-03，依据「Vibe Browser方案」对话。对话建议与本次工程取舍的区别见来源说明。
