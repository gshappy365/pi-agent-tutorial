# 第五章：构建教学版 Pi Agent

## 章节导读

经过前三章的原理学习和第四章的 8 个 Demo 练习，你已经掌握了 AI Agent 的各个核心部件。现在是时候把它们组合起来了。

本章将指导你从零构建一个**完整的、可运行的 Web 版 AI Agent**。它包含：

- **Node.js + Express 后端**：实现 Agent 核心逻辑，包括 LLM 调用、工具执行、事件流推送
- **React + Vite 前端**：提供聊天界面，通过 SSE 接收流式消息
- **完整的 Agent Loop**：支持多轮工具调用、流式输出、事件订阅

这个项目的代码位于 `final-project/` 目录下，是前几章所有知识的综合实践。

## 项目结构

```
final-project/
├── package.json              # 根级编排脚本
├── server/                   # 后端
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # 入口：创建 Agent 并启动服务器
│       ├── server.ts         # Express 服务器 + SSE 端点
│       └── agent/
│           ├── Agent.ts      # Agent 核心类（高层封装）
│           ├── AgentLoop.ts  # Agent Loop（思考→行动→观察循环）
│           ├── ToolRegistry.ts  # 工具注册与执行
│           ├── LLMProvider.ts   # 统一 LLM 抽象层
│           └── EventBus.ts      # 事件发布-订阅
└── client/                   # 前端
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── types/
        │   └── agent.ts
        ├── hooks/
        │   └── useAgent.ts
        └── components/
            ├── ChatPanel.tsx
            ├── MessageList.tsx
            ├── MessageInput.tsx
            └── ToolCallCard.tsx
```

## 本章内容

| 章节 | 内容 |
|------|------|
| 架构设计 | 整体架构、模块职责、数据流 |
| 后端实现 | Agent / AgentLoop / ToolRegistry / LLMProvider / EventBus / Server |
| 前端实现 | ChatPanel / MessageList / MessageInput / useAgent Hook |
| 前后端联调 | Vite Proxy、SSE 事件流、启动步骤 |
| 运行与扩展 | 启动方式、配置切换、扩展方向 |

## 学习目标

完成本章后，你将能够：

1. 理解一个完整 AI Agent 应用的架构设计
2. 掌握 Agent Loop 的核心实现原理
3. 学会如何使用 SSE 实现流式通信
4. 能够在现有代码基础上添加新工具和新功能
5. 理解可扩展的模块化设计模式

## 前置准备

确保已安装 Node.js 18+，并熟悉以下基础概念：

- TypeScript 基础语法
- React 函数组件与 Hooks
- Express 路由与中间件
- 前几章学到的 Agent 核心概念

> **提示**：如果对某个模块的实现感到困惑，可以回到对应章节复习。本章是前四章知识的综合应用，不引入新的概念。

## 小结

本章将带你走完一个完整的 AI Agent 应用从设计到实现的全部流程。代码量不大（后端约 300 行，前端约 200 行），但覆盖了生产级 Agent 的核心设计模式。建议你一边阅读一边对照 `final-project/` 目录下的实际代码，动手运行起来效果更好。

## 小练习

1. 通读本章前，先浏览 `final-project/` 目录结构，看看能否说出每个文件的职责
2. 思考：如果让你自己设计一个 Agent 应用，你会如何划分模块？
