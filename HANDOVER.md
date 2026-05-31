# Pi Agent 教程项目 — 交接文档

## 项目概述

一个基于 VitePress 的中文教程站点，主题为「Pi Agent 的原理与实现：从零到一实现一个 AI Agent」。面向计算机本科毕业生，通过 8 个渐进式 Demo 和 1 个最终项目，从零构建一个可运行的 AI Agent。

## 项目位置

```
/Users/gaoshan/123_Kaku/Pi_Agent_kw93/pi-agent-tutorial/
```

## 项目结构

```
pi-agent-tutorial/
├── CLAUDE.md                     # AI 指令文件（项目结构/命令/代码风格）
├── HANDOVER.md                   # 本交接文档
├── package.json                  # 根项目（VitePress）+ verify 命令
├── docs/                         # VitePress 教程站点（22 篇文档）
│   ├── .vitepress/config.mts     # VitePress 配置（含 Mermaid）
│   ├── index.md                  # 首页
│   ├── 01-introduction/          # 第一章：认识 AI Agent（3 篇）
│   ├── 02-principles/            # 第二章：核心原理（5 篇）
│   ├── 03-demo-basics/           # 第三章：基础 Demo（5 篇）
│   ├── 04-demo-advanced/         # 第四章：进阶 Demo（5 篇）
│   ├── 05-final-project/         # 第五章：最终项目（6 篇）
│   └── 06-appendix/              # 第六章：附录（5 篇）
├── demo/                         # 8 个 Demo 源码（npm workspaces monorepo）
│   ├── package.json              # demo:1~8 脚本 + test 脚本
│   ├── shared/src/               # 共享库
│   │   ├── llm.ts                # LLM 统一抽象（Mock/OpenAI/Anthropic）
│   │   ├── llm.test.ts           # LLM 层测试（9 个用例）
│   │   ├── tool.ts               # 工具类型定义
│   │   └── event-bus.ts          # 事件总线
│   ├── 01-llm-call/              # Demo 1: 调用 LLM API
│   ├── 02-tool-def/              # Demo 2: 定义和调用工具
│   ├── 03-agent-loop/            # Demo 3: Agent Loop（含测试 3 个）
│   ├── 04-stream/                # Demo 4: 流式事件
│   ├── 05-multi-tool/            # Demo 5: 多工具协作
│   ├── 06-state-mgmt/            # Demo 6: 有状态 Agent
│   ├── 07-error-handling/        # Demo 7: 错误处理
│   └── 08-context/               # Demo 8: 上下文管理（含测试 8 个）
└── final-project/                # 最终教学版项目
    ├── server/src/
    │   ├── agent/
    │   │   ├── Agent.ts          # Agent 核心类
    │   │   ├── AgentLoop.ts      # Agent 循环
    │   │   ├── ToolRegistry.ts   # 工具注册器
    │   │   ├── LLMProvider.ts    # LLM 抽象层
    │   │   └── EventBus.ts       # 事件总线
    │   ├── server.ts             # Express + SSE
    │   └── index.ts              # 入口
    └── client/src/
        ├── App.tsx
        ├── components/
        │   ├── ChatPanel.tsx     # 主面板
        │   ├── MessageList.tsx   # 消息列表（含 ToolCallCard 渲染）
        │   ├── MessageInput.tsx  # 输入框
        │   └── ToolCallCard.tsx  # 工具调用状态卡片
        └── hooks/
            └── useAgent.ts       # SSE Hook（处理 tool_start/tool_end 事件）
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 教程框架 | VitePress 1.6 + Mermaid 11.15（vitepress-plugin-mermaid 2.0.17） |
| 语言 | TypeScript 严格模式（全栈） |
| Demo 运行时 | tsx（Node.js 测试运行器 `node:test`） |
| 最终后端 | Node.js + Express + SSE |
| 最终前端 | React + Vite |
| 参数校验 | TypeBox |
| 包管理 | npm workspaces |

## 关键命令

```bash
# 根目录
npm run docs:dev       # VitePress 开发模式
npm run docs:build     # 构建静态站点
npm run docs:preview   # 预览构建结果
npm run verify         # 一键验证（测试 + 构建）

# Demo 目录
cd demo
npm install            # 安装依赖
npm run demo:1~8       # 运行对应 Demo
npm test               # 运行全部 20 个测试
npm run test:watch     # 监听模式

# 最终项目
cd final-project
npm install
npm run dev            # 同时启动前后端
```

## 环境变量（最终项目）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROVIDER` | Provider 类型 | `mock` |
| `LLM_API_KEY` | API Key（真实调用时必填） | - |
| `LLM_MODEL_ID` | 模型 ID | `gpt-4o-mini` |
| `LLM_BASE_URL` | 自定义 API 地址 | - |
| `PORT` | 后端端口 | `3001` |

## 最近完成的工作

### Mermaid 图修复（全部 67 个图正常渲染）
- 修复 `02-principles/01-llm-abstraction.md` — 菱形节点语法冲突 `D[{content}]` → `D["{content}"]`
- 修复 `02-principles/05-architecture.md` — `Loop` 关键字冲突 → `AL`
- 修复 `01-introduction/03-core-concepts.md` — 未引号包裹的中文标签
- 修复 `01-introduction/index.md` — edge label 中文双引号 `回答"是什么"` → `回答'是什么'`
- 修复 `03-demo-basics/03-demo-tool-def.md` — 中文冒号标签加引号
- 全面扫描确认零 Mermaid 解析错误

### 代码修复
- `demo/shared/src/llm.ts` — 工具匹配优先级重排（计算器 > 天气 > 通用），天气城市提取正则优化
- `demo/03-agent-loop/src/index.ts` — Mock 模式重复工具调用检测
- `final-project/client/` — 前端 SSE 可视化 tool_start/tool_end 事件，ToolCallCard 渲染

### 测试（20/20 通过）
- `demo/shared/src/llm.test.ts` — 9 个用例（文本回复、工具触发、流式事件、边界条件）
- `demo/03-agent-loop/src/index.test.ts` — 3 个用例（直接回复、工具调用、无关输入）
- `demo/08-context/src/index.test.ts` — 8 个用例（token 估算、裁剪策略、摘要策略）

### AI 配置
- 创建 `CLAUDE.md` — 项目结构/命令/代码风格/验证步骤
- 创建 `.claude/settings.json` — 项目级权限配置
- 根 `package.json` 添加 `npm run verify` 统一验证命令

## 验证状态

| 验证项 | 状态 |
|--------|------|
| VitePress 构建 | ✅ 通过 |
| Demo 测试（20 个） | ✅ 全部通过 |
| Mermaid 图（67 个） | ✅ 零解析错误 |
| 首页/各章节页面 | ✅ 零控制台错误 |
| 后端健康检查 | ✅ 通过 |
| SSE 流式推送 | ✅ 通过 |
| 工具 API | ✅ 通过 |

## 代码风格要点

- TypeScript 严格模式，使用 `node:test` + `node:assert/strict`
- Mermaid 图中含特殊字符（中文冒号、引号、花括号）的节点标签必须用双引号包裹：`A["标签文本"]`
- Sequence diagram 中避免使用 `Loop` 作为参与者名（mermaid 关键字冲突）
- Demo 代码注释以 `/**` JSDoc 风格为主

## 已完成的教程文档

| 章节 | 文档 | 核心内容 |
|------|------|----------|
| 第一章 | 认识 AI Agent | 概念介绍、Pi 生态、核心概念预热 |
| 第二章 | 核心原理 | LLM 抽象、Agent Loop、工具系统、事件系统、架构总览 |
| 第三章 | 基础 Demo | 项目初始化、4 个基础 Demo 教程 |
| 第四章 | 进阶 Demo | 4 个进阶 Demo 教程 |
| 第五章 | 最终项目 | 架构、后端、前端、联调、运行扩展 |
| 第六章 | 附录 | 术语表、FAQ、参考资源、部署指南 |

## 已知问题 / 待改进

1. **Mock LLM 的 tool calling 逻辑较简单** — 基于关键词匹配而非真正的 LLM 判断，切换到真实 Provider 后行为会不同
2. **Demo 3 的 Mock 模式** — 在 Mock 模式下 Demo 3 的 calculator 工具调用会重复触发同一工具，因为 Mock LLM 每次看到 tool 消息都会再次调用。已添加重复检测逻辑（`lastToolName` 跟踪），切换到真实 Provider 可彻底解决
3. **前端 SSE 事件** — 当前前端通过 `useAgent` Hook 消费 `delta` 事件实现流式展示，已添加 `tool_start`/`tool_end` 事件处理和 ToolCallCard 渲染，但 `agent_start`/`agent_end` 等高级事件未在前端 UI 中可视化
4. **图片资源 404** — `docs/.vitepress/public/images/` 下缺少 `pi-logo.svg` 和 `favicon.svg`，所有页面有这两个 404 错误（不影响渲染）
5. **Demo 8 摘要压缩** — Mock 模式的摘要生成质量有限，真实 LLM 效果更好

## 交接建议

在新 session 中建议优先：
1. `cat CLAUDE.md` 了解项目结构和命令
2. `npm run verify` 确认当前状态
3. `npm run docs:dev` 启动站点浏览整体内容
4. 如需修复已知问题，优先处理图片资源 404（简单且影响所有页面）
