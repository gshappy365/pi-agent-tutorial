# 术语表

术语按拼音首字母排序。

---

## A

### Agent（智能体）

一个能够感知环境、做出决策并采取行动的 AI 程序。在本教程中，Agent 是一个封装了 LLM、工具和循环逻辑的类，能够自主完成用户的请求。

**相关文件**：`final-project/server/src/agent/Agent.ts`

### Agent Loop（智能体循环）

Agent 的核心运行机制，遵循"思考 -> 行动 -> 观察"的循环模式。每次循环中，Agent 调用 LLM 决定下一步行动，执行工具获取结果，然后继续下一次循环，直到生成最终回复。

**相关文件**：`final-project/server/src/agent/AgentLoop.ts`

---

## C

### Context Window（上下文窗口）

LLM 能一次处理的 token 数量上限。例如 GPT-4o-mini 的上下文窗口是 128K tokens。当对话历史超过这个限制时，需要进行上下文管理（截断、摘要等）。

---

## D

### Delta（增量）

在流式输出中，每次推送的文本片段称为一个 delta。前端将多个 delta 拼接起来，形成完整的回复内容。

**SSE 事件示例**：

```
data: {"type":"delta","content":"你好"}
data: {"type":"delta","content":"！我"}
data: {"type":"delta","content":"是 Pi Agent"}
```

---

## E

### EventBus（事件总线）

实现发布-订阅模式的消息总线。Agent 在运行过程中发布各种事件（如 `turn_start`、`tool_calls`），Server 订阅这些事件并通过 SSE 推送给前端。

**相关文件**：`final-project/server/src/agent/EventBus.ts`

---

## L

### LLM（Large Language Model，大语言模型）

大规模预训练的语言模型，如 OpenAI 的 GPT 系列、Anthropic 的 Claude 系列。LLM 是 Agent 的"大脑"，负责理解用户意图、生成回复和决定是否调用工具。

### LLM Provider（LLM 提供者适配层）

统一 LLM API 差异的抽象层。通过 `ILLMProvider` 接口，Agent 可以无缝切换 Mock、OpenAI、Anthropic 等不同的 LLM 后端。

**相关文件**：`final-project/server/src/agent/LLMProvider.ts`

---

## M

### Message（消息）

Agent 与 LLM 之间交换的基本单位。每条消息包含 `role`（system / user / assistant / tool）和 `content`（文本内容）。消息历史是 Agent Loop 的核心数据流。

**类型定义**：

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}
```

### Mock Provider（模拟提供者）

不需要 API Key 的 LLM 模拟实现。通过关键词匹配模拟工具调用，适合开发和测试阶段使用。

---

## P

### Provider（提供者）

见"LLM Provider"。

---

## S

### SSE（Server-Sent Events，服务端推送事件）

一种基于 HTTP 的实时通信协议，允许服务端向客户端推送事件流。相比 WebSocket，SSE 更轻量，浏览器原生支持自动重连。

**SSE 格式**：

```
data: {"type":"delta","content":"hello"}

data: {"type":"done","content":"hello world"}

```

**相关文件**：`final-project/server/src/server.ts`

### Streaming（流式输出）

LLM 逐 token 生成回复并实时推送的技术。相比等待完整回复，流式输出能大幅降低用户感知的延迟，提供打字机般的体验。

---

## T

### Token（词元）

LLM 处理文本的基本单位。一个 token 可以是一个单词、一个汉字的一部分或一个标点符号。OpenAI 的计费、上下文窗口限制都以 token 为单位。

### Tool Calling（工具调用）

LLM 在生成回复时，请求调用一个外部工具的机制。LLM 输出结构化的工具调用请求（包含工具名和参数），Agent 负责解析、执行并将结果返回给 LLM。

**工具调用流程**：

```
用户: "25 * 4 等于多少？"
  → LLM: 检测到需要计算，返回 tool_call { name: "calculator", args: { a: 25, b: 4, operator: "*" } }
  → Agent: 执行 calculator 工具，得到结果 "25 * 4 = 100"
  → Agent: 将结果加入消息历史，再次调用 LLM
  → LLM: 生成最终回复 "25 * 4 = 100"
```

### Tool Definition（工具定义）

描述工具的名称、描述和参数 schema 的数据结构。LLM 根据工具定义来决定何时调用工具以及如何填写参数。

### ToolRegistry（工具注册器）

管理工具注册、查找和执行的容器。支持动态添加新工具，提供统一的 `execute()` 方法执行工具调用。

**相关文件**：`final-project/server/src/agent/ToolRegistry.ts`

### Turn（轮次）

Agent Loop 中的一次完整迭代，包括：调用 LLM -> 执行工具（如果有）-> 更新消息历史。一次对话可能包含多个 Turn。

### TypeBox

一个 TypeScript 类型的 JSON Schema 构建库。在本教程中用于定义工具参数的 schema，确保 LLM 生成的参数符合预期格式。

---

## 其他

### Vite

现代化的前端构建工具，提供极速的开发服务器和高效的构建能力。本教程的前端项目使用 Vite 搭建。

### VitePress

基于 Vite 的静态站点生成器，专为文档而生。本教程的文档站点使用 VitePress 构建。

---

## 小结

本术语表涵盖了教程中出现的所有核心概念。建议在阅读过程中遇到不熟悉的术语时回查此表。

## 小练习

1. 用自己的话向别人解释"Agent Loop"是什么
2. 对比 SSE 和 WebSocket，说出各自的优缺点
3. 解释为什么需要"LLM Provider"这一抽象层
