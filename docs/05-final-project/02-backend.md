# 后端实现

后端代码位于 `final-project/server/src/` 目录下，共 6 个文件，约 300 行 TypeScript 代码。下面逐一讲解每个模块的实现。

---

## Agent 类：高层封装

**文件**：`final-project/server/src/agent/Agent.ts`

Agent 类是后端最上层的封装，它的职责是"组合"而不是"实现"——把 LLMProvider、ToolRegistry、EventBus、AgentLoop 组合在一起，对外提供简洁的 API。

```typescript
export class Agent {
  private provider: ILLMProvider
  private toolRegistry: ToolRegistry
  private eventBus = new EventBus()
  private config: AgentLoopConfig
  private _isRunning = false

  constructor(config: AgentConfig) {
    this.provider = createLLMProvider(config.provider)
    this.toolRegistry = config.tools || createBuiltinTools()
    this.config = {
      maxTurns: config.maxTurns || 10,
      systemPrompt: config.systemPrompt || '你是一个有帮助的 AI 助手...',
    }
  }
```

关键设计点：

- **构造函数注入 Provider**：通过 `createLLMProvider(config.provider)` 工厂方法创建 Provider，支持 `mock` / `openai` / `anthropic` 三种类型
- **默认工具集**：如果不传入自定义 ToolRegistry，自动创建内置工具（calculator、weather、search）
- **运行状态锁**：`_isRunning` 防止并发调用 `chat()` 方法
- **事件订阅**：`subscribe()` 返回取消订阅函数，方便资源清理

`chat()` 方法是核心入口：

```typescript
async chat(userInput: string, onDelta?: (delta: string) => void): Promise<string> {
  if (this._isRunning) {
    throw new Error('Agent 正在处理中')
  }
  this._isRunning = true
  try {
    const response = await runAgentLoopStreaming(
      userInput, this.provider, this.toolRegistry,
      this.eventBus, onDelta || (() => {}), this.config,
    )
    return response
  } finally {
    this._isRunning = false
  }
}
```

`onDelta` 回调是连接 Agent Loop 和 SSE 的关键——每次 LLM 输出一个文本块，都会通过这个回调推送给 Server，再由 Server 通过 SSE 发送给前端。

---

## AgentLoop：核心循环

**文件**：`final-project/server/src/agent/AgentLoop.ts`

AgentLoop 实现"思考 -> 行动 -> 观察"的完整循环。项目提供了两个版本的循环函数：

- `runAgentLoop`：非流式版本，一次性返回结果
- `runAgentLoopStreaming`：流式版本，通过 `onDelta` 回调实时推送文本

流式版本的核心逻辑：

```typescript
export async function runAgentLoopStreaming(
  userInput: string,
  provider: ILLMProvider,
  toolRegistry: ToolRegistry,
  eventBus: EventBus,
  onDelta: (delta: string) => void,
  config: AgentLoopConfig,
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: config.systemPrompt },
    { role: 'user', content: userInput },
  ]

  await eventBus.emit({ type: 'agent_start', input: userInput })

  let turn = 0
  let finalResponse = ''

  while (turn < config.maxTurns) {
    turn++
    await eventBus.emit({ type: 'turn_start', turn })

    // 调用 LLM（流式）
    const { content, toolCalls } = await provider.stream(
      messages, toolRegistry.getDefinitions(), onDelta
    )

    // 无工具调用 -> 最终回复
    if (toolCalls.length === 0) {
      finalResponse = content
      await eventBus.emit({ type: 'message', role: 'assistant', content })
      await eventBus.emit({ type: 'turn_end', turn, final: true })
      break
    }

    // 有工具调用 -> 执行工具，将结果加入消息历史
    await eventBus.emit({ type: 'tool_calls', toolCalls })
    messages.push({ role: 'assistant', content, toolCalls })

    for (const tc of toolCalls) {
      await eventBus.emit({ type: 'tool_start', toolName: tc.name, args: tc.arguments })
      const result = await toolRegistry.execute(tc)
      await eventBus.emit({ type: 'tool_end', toolName: tc.name, result: result.content, isError: result.isError })
      messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, toolName: tc.name })
    }

    await eventBus.emit({ type: 'turn_end', turn, final: false })
  }

  await eventBus.emit({ type: 'agent_end', response: finalResponse })
  return finalResponse
}
```

循环的关键步骤：

| 步骤 | 说明 |
|------|------|
| 1. 构造消息历史 | 以 system + user 消息初始化 |
| 2. 调用 LLM | `provider.stream()` 返回文本和工具调用 |
| 3. 判断分支 | 无工具调用 -> 返回最终回复；有工具调用 -> 执行工具 |
| 4. 执行工具 | 遍历所有工具调用，依次执行，结果加入消息历史 |
| 5. 继续循环 | 带着工具结果再次调用 LLM，让 LLM 生成最终回复 |
| 6. 达到上限 | 如果超过 `maxTurns`，返回警告信息 |

---

## ToolRegistry：工具注册与执行

**文件**：`final-project/server/src/agent/ToolRegistry.ts`

ToolRegistry 是一个轻量级的工具管理器，支持注册、查找、批量获取定义、执行。

```typescript
export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.get(toolCall.name)
    if (!tool) {
      return { content: `错误：未找到工具 "${toolCall.name}"`, isError: true }
    }
    try {
      return await tool.execute(toolCall.arguments)
    } catch (error) {
      return { content: `错误：工具执行失败 - ${(error as Error).message}`, isError: true }
    }
  }
}
```

`execute()` 方法做了两层防御：

1. 工具不存在时返回错误消息，而非抛出异常
2. 工具执行过程中抛出异常时，捕获并返回错误消息

这样 Agent Loop 不会因为某个工具崩溃而中断整个对话。

### 内置工具

`createBuiltinTools()` 创建了三个内置工具：

| 工具 | 参数 | 功能 |
|------|------|------|
| `calculator` | `{ a: number, b: number, operator: string }` | 数学运算 |
| `weather` | `{ location: string }` | 模拟天气查询 |
| `search` | `{ query: string }` | 模拟网络搜索 |

工具参数使用 TypeBox 定义 schema：

```typescript
registry.register({
  name: 'calculator',
  description: '执行数学运算（加、减、乘、除）',
  parameters: Type.Object({
    a: Type.Number({ description: '第一个数字' }),
    b: Type.Number({ description: '第二个数字' }),
    operator: Type.String({ description: '运算符: +, -, *, /' }),
  }),
  execute: (args) => {
    const { a, b, operator } = args as { a: number; b: number; operator: string }
    // ...
  },
})
```

TypeBox 的作用是提供参数的类型描述，这些描述会被序列化后传给 LLM，LLM 根据 schema 生成符合格式的参数。

---

## LLMProvider：统一 LLM 抽象

**文件**：`final-project/server/src/agent/LLMProvider.ts`

LLMProvider 是整个项目的核心抽象层，定义了统一的接口，支持三种实现。

### 接口定义

```typescript
export interface ILLMProvider {
  readonly config: LLMProviderConfig
  complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>
  stream(
    messages: Message[],
    tools?: ToolDefinition[],
    onDelta?: (delta: string) => void,
  ): Promise<LLMResponse>
}
```

两个核心方法：

- `complete()`：一次性返回完整响应，适用于非流式场景
- `stream()`：流式返回，通过 `onDelta` 回调逐段推送文本

### 三种 Provider 对比

| 特性 | MockProvider | OpenAIProvider | AnthropicProvider |
|------|-------------|----------------|-------------------|
| 依赖 | 无 | `openai` npm 包 | `@anthropic-ai/sdk` |
| API Key | 不需要 | 需要 | 需要 |
| 网络请求 | 无 | HTTP | HTTP |
| 工具调用 | 关键词匹配 | `tool_calls` 原生支持 | `tool_use` 原生支持 |
| 流式 | 模拟逐字输出 | 原生 stream | 原生 stream |
| 用途 | 开发调试 | 生产使用 | 生产使用 |

### MockProvider

MockProvider 不需要任何 API Key，通过关键词匹配模拟工具调用：

```typescript
private detectToolCall(content: string, tools?: ToolDefinition[]): ToolCall | null {
  if (/计算|\d+\s*[+\-*/]\s*\d+/.test(content)) {
    // 匹配到计算请求 -> 返回 calculator 工具调用
  }
  if (/天气|气温|下雨/.test(content)) {
    // 匹配到天气查询 -> 返回 weather 工具调用
  }
  return null
}
```

流式模式下，MockProvider 逐字输出内容，每个字符间隔 10ms：

```typescript
async stream(messages, tools, onDelta) {
  const result = await this.complete(messages, tools)
  if (onDelta && !result.toolCalls.length) {
    for (const char of result.content) {
      onDelta(char)
      await new Promise(r => setTimeout(r, 10))
    }
  }
  return result
}
```

### OpenAIProvider

OpenAIProvider 调用 OpenAI 的 Chat Completions API，支持 `stream: true` 模式：

```typescript
async stream(messages, tools, onDelta) {
  const stream = await client.chat.completions.create({
    model: this.config.modelId,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    tools: tools?.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    stream: true,
  })

  let content = ''
  const toolCalls: ToolCall[] = []

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta
    if (delta?.content) {
      content += delta.content
      onDelta?.(delta.content)
    }
    if (delta?.tool_calls) {
      // 处理分块到达的工具调用
      for (const tc of delta.tool_calls) {
        // 合并同一个 tool_call_id 的多个 chunk
      }
    }
  }
  return { content, toolCalls }
}
```

工具调用在流式模式下是分块到达的——每个 chunk 可能只携带工具调用参数的一部分。代码通过 `toolCalls` 数组累积合并：

```typescript
if (delta.tool_calls) {
  for (const tc of delta.tool_calls) {
    let existing = toolCalls.find(t => t.id === tc.id)
    if (!existing) {
      existing = { id: tc.id, name: tc.function?.name || '', arguments: {} }
      toolCalls.push(existing)
    }
    if (tc.function?.arguments) {
      Object.assign(existing.arguments, this.safeJson(tc.function.arguments, {}))
    }
  }
}
```

### AnthropicProvider

AnthropicProvider 调用 Anthropic Messages API，使用 `content_block_start` 和 `content_block_delta` 事件：

```typescript
async stream(messages, tools, onDelta) {
  const stream = await client.messages.create({
    model: this.config.modelId,
    system: systemMsg?.content,
    messages: messages.filter(m => m.role !== 'system').map(...),
    tools: tools?.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    max_tokens: 4096,
    stream: true,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      content += event.delta.text
      onDelta?.(event.delta.text)
    }
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      toolCalls.push({ id: event.content_block.id, name: event.content_block.name, arguments: event.content_block.input || {} })
    }
  }
}
```

注意 Anthropic 和 OpenAI 的流式事件格式完全不同，但 `ILLMProvider` 接口屏蔽了这些差异。

### 工厂函数

```typescript
export function createLLMProvider(config: LLMProviderConfig): ILLMProvider {
  switch (config.provider) {
    case 'mock': return new MockProvider(config)
    case 'openai': return new OpenAIProvider(config)
    case 'anthropic': return new AnthropicProvider(config)
    default: throw new Error(`Unknown provider: ${config.provider}`)
  }
}
```

工厂模式使得切换 Provider 只需改配置，无需修改业务代码。

---

## EventBus：事件发布-订阅

**文件**：`final-project/server/src/agent/EventBus.ts`

EventBus 实现了经典的事件发布-订阅模式，是连接 Agent Loop 和 SSE 的桥梁。

```typescript
export class EventBus {
  private listeners = new Set<Listener>()
  private onceListeners = new Set<Listener>()
  private history: AgentEvent[] = []

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async emit(event: AgentEvent): Promise<void> {
    this.history.push(event)
    for (const listener of this.listeners) {
      await listener(event)
    }
    for (const listener of this.onceListeners) {
      this.onceListeners.delete(listener)
      await listener(event)
    }
  }
}
```

与 Demo 版相比，最终版的 EventBus 增加了：

- **异步监听器支持**：`emit()` 是 async 方法，会 `await` 每个监听器
- **一次性监听器**：`once()` 注册的监听器执行一次后自动移除
- **事件历史**：`getHistory()` 可获取所有已发布的事件，方便调试

---

## Server：Express + SSE 端点

**文件**：`final-project/server/src/server.ts`

Server 模块负责处理 HTTP 请求，核心是 SSE 流式聊天端点。

```typescript
export function createServer(agent: Agent) {
  const app = express()
  app.use(cors())
  app.use(express.json())
```

三个端点：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/tools` | GET | 获取可用工具列表 |
| `/api/chat` | POST | 聊天，SSE 流式响应 |

SSE 端点的实现：

```typescript
app.post('/api/chat', async (req, res) => {
  const { message } = req.body

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')  // 禁用 Nginx 缓冲

  // 订阅 Agent 事件，通过 SSE 推送
  const unsubscribe = agent.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  })

  // 客户端断开时取消订阅
  req.on('close', () => unsubscribe())

  try {
    const response = await agent.chat(message, (delta) => {
      res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
    })
    res.write(`data: ${JSON.stringify({ type: 'done', content: response })}\n\n`)
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`)
  } finally {
    res.end()
  }
})
```

SSE 格式要点：

- 每个消息以 `data: ` 开头，以 `\n\n` 结尾
- 消息体是 JSON 字符串
- `Content-Type` 必须设置为 `text/event-stream`
- `Cache-Control: no-cache` 防止浏览器缓存
- `X-Accel-Buffering: no` 禁用 Nginx 等反向代理的缓冲

### 入口文件

**文件**：`final-project/server/src/index.ts`

入口文件负责创建 Agent 实例并启动服务器：

```typescript
const provider = (process.env.LLM_PROVIDER || 'mock') as 'mock' | 'openai' | 'anthropic'

const agent = new Agent({
  provider: {
    provider,
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
  },
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT,
  maxTurns: Number(process.env.AGENT_MAX_TURNS) || 10,
})

const app = createServer(agent)
app.listen(PORT, () => { /* ... */ })
```

所有配置通过环境变量注入，默认使用 Mock 模式，无需任何 API Key 即可运行。

---

## 小结

后端 6 个模块构成了一个完整、可扩展的 Agent 系统：

- **Agent** 是外观（Facade），简化外部调用
- **AgentLoop** 是核心引擎，驱动"思考-行动-观察"循环
- **ToolRegistry** 是工具管理器，支持动态注册
- **LLMProvider** 是抽象层，屏蔽不同 LLM 的差异
- **EventBus** 是消息总线，解耦内部逻辑和外部通信
- **Server** 是网络入口，通过 SSE 连接前后端

## 小练习

1. 在 `ToolRegistry.ts` 中添加一个新的 `datetime` 工具，返回当前日期和时间（提示：`new Date().toLocaleString()`）
2. 修改 `AgentLoop.ts`，在每次 turn 开始时打印当前轮次的消息数量，观察消息历史的增长
3. 尝试在 `EventBus.ts` 中添加 `filter` 方法，支持按事件类型过滤历史记录
