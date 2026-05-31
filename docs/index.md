---
layout: home

hero:
  name: "Pi Agent 原理与实现"
  text: "从零到一实现一个 AI Agent"
  tagline: 一套面向计算机本科毕业生的渐进式教程，拆解 Pi Agent 的核心设计，通过 8 个 Demo 从零构建一个可运行的 AI Agent
  actions:
    - theme: brand
      text: 开始学习
      link: /01-introduction/
    - theme: alt
      text: 先看 Demo
      link: /03-demo-basics/
    - theme: alt
      text: GitHub
      link: https://github.com/earendil-works/pi

features:
  - icon: 🧠
    title: 核心概念
    details: 从 LLM 到 Agent，理解 AI Agent 的本质：LLM + 工具 + 记忆 + 规划
  - icon: 🔍
    title: 原理拆解
    details: 深入 Pi Agent 的四大核心机制：LLM 抽象层、Agent Loop、工具系统、事件系统
  - icon: 🛠️
    title: 渐进式 Demo
    details: 8 个由浅入深的可运行 Demo，从调用 LLM API 到实现完整 Agent Loop
  - icon: 🚀
    title: 最终项目
    details: 亲手实现一个 React + Node.js 的教学版 AI Agent，保留核心设计思想
---

## 教程路线图

```mermaid
graph LR
    A[第一章: 认识 AI Agent] --> B[第二章: 核心原理]
    B --> C[第三章: 基础 Demo]
    C --> D[第四章: 进阶 Demo]
    D --> E[第五章: 最终项目]
    E --> F[附录: 扩展与部署]

    style A fill:#e0e7ff,stroke:#4f46e5
    style B fill:#e0e7ff,stroke:#4f46e5
    style C fill:#fef3c7,stroke:#f59e0b
    style D fill:#fef3c7,stroke:#f59e0b
    style E fill:#d1fae5,stroke:#10b981
    style F fill:#f3f4f6,stroke:#6b7280
```

## 这套教程适合谁？

- 计算机相关专业本科毕业生，了解基础的 TypeScript/JavaScript
- 对 AI Agent 感兴趣，想理解其背后的工程原理
- 不想看论文，想通过代码实操来学习

## 你需要准备什么？

| 项目 | 说明 |
|------|------|
| Node.js 18+ | 运行时环境 |
| npm | 包管理器 |
| 任意编辑器 | 推荐 VS Code |
| 终端 | macOS / Linux / Windows WSL |
| LLM API Key（可选） | Mock 模式下不需要，真实 API 推荐 OpenAI 或 Anthropic |
