# Pi Agent 教程项目

从零到一实现一个 AI Agent 的渐进式教程。基于 VitePress 的中文站点，包含 8 个渐进式 Demo 和 1 个最终项目。

## 项目结构

```
pi-agent-tutorial/
├── docs/                        # VitePress 教程站点（22 篇文档）
│   ├── .vitepress/config.mts    # VitePress 配置（含 Mermaid）
│   ├── 01-introduction/         # 第一章：认识 AI Agent
│   ├── 02-principles/           # 第二章：核心原理
│   ├── 03-demo-basics/          # 第三章：基础 Demo
│   ├── 04-demo-advanced/        # 第四章：进阶 Demo
│   ├── 05-final-project/        # 第五章：最终项目
│   └── 06-appendix/             # 第六章：附录
├── demo/                        # 8 个 Demo 源码（npm workspaces monorepo）
│   ├── shared/src/              # 共享库（LLM 抽象、工具系统、EventBus）
│   │   ├── llm.ts               # Model 接口 + Mock/OpenAI/Anthropic Provider
│   │   ├── tool.ts              # Tool 类型定义
│   │   └── event-bus.ts         # EventBus 实现
│   ├── 01-llm-call/             # Demo 1: 调用 LLM API
│   ├── 02-tool-def/             # Demo 2: 定义和调用工具
│   ├── 03-agent-loop/           # Demo 3: 最简单的 Agent Loop
│   ├── 04-stream/               # Demo 4: 流式输出与事件分发
│   ├── 05-multi-tool/           # Demo 5: 多工具协作
│   ├── 06-state-mgmt/           # Demo 6: 有状态 Agent
│   ├── 07-error-handling/       # Demo 7: 错误处理
│   └── 08-context/              # Demo 8: 上下文管理
└── final-project/               # 最终项目：教学版 Pi Agent
    ├── server/                  # Express 后端（Agent 运行时 + SSE）
    └── client/                  # React 前端（Vite + TypeScript）
```

## 关键命令

```bash
# 文档站点
npm run docs:dev       # 启动 VitePress 开发服务器
npm run docs:build     # 构建静态站点
npm run docs:preview   # 预览构建结果

# Demo 运行（在 demo/ 目录下）
npm run demo:1         # 运行 Demo 1
npm run demo:2         # 运行 Demo 2
...                    # demo:3 ~ demo:8 同理

# 测试
cd demo && npm test    # 运行所有测试（20 个用例）
```

## 技术栈

- **文档**: VitePress 1.6 + Mermaid 11.15（vitepress-plugin-mermaid）
- **Demo**: TypeScript + tsx（Node.js 测试运行器）
- **最终项目**: Express + React + Vite + SSE
- **LLM 支持**: Mock Provider（无需 API Key）、OpenAI、Anthropic

## 代码风格

- TypeScript 严格模式
- 使用 `node:test` + `node:assert/strict` 编写测试
- Mermaid 图中含特殊字符（中文冒号、引号、花括号）的节点标签必须用双引号包裹：`A["标签文本"]`
- Sequence diagram 中避免使用 `Loop` 作为参与者名（mermaid 关键字冲突）
- Demo 代码保持简洁，注释以 `/**` JSDoc 风格为主

## 验证

修改后请运行：
1. `cd demo && npm test` — 确保 20 个测试全部通过
2. `npm run docs:build` — 确保站点构建成功
3. 检查 Mermaid 图无解析错误（查看构建日志或浏览器控制台）
