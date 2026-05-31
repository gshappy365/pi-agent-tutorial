# 运行与扩展

这一节介绍如何运行最终项目，以及如何在此基础上进行扩展。

---

## 快速启动

### 前置条件

| 条件 | 版本要求 | 验证命令 |
|------|----------|----------|
| Node.js | >= 18 | `node --version` |
| npm | >= 9 | `npm --version` |

### 安装依赖

```bash
cd final-project

# 一键安装所有依赖（根级 + 后端 + 前端）
npm install && cd server && npm install && cd ../client && npm install && cd ..
```

### 启动（Mock 模式，无需 API Key）

```bash
# 方式一：分别启动（推荐，方便查看日志）
cd final-project/server && npm run dev    # 终端 1
cd final-project/client && npm run dev    # 终端 2

# 方式二：一键启动
cd final-project && npm run dev           # 同时启动前后端
```

打开浏览器访问 `http://localhost:5173`，就可以开始对话了。

### 启动（真实 LLM 模式）

```bash
# 使用 OpenAI
LLM_PROVIDER=openai LLM_API_KEY=sk-xxx LLM_MODEL_ID=gpt-4o-mini npm run dev

# 使用 Anthropic
LLM_PROVIDER=anthropic LLM_API_KEY=sk-ant-xxx LLM_MODEL_ID=claude-sonnet-4-20250514 npm run dev
```

---

## 环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3001` | 后端服务器端口 |
| `LLM_PROVIDER` | `mock` | LLM 提供商：`mock` / `openai` / `anthropic` |
| `LLM_API_KEY` | - | API Key（Mock 模式不需要） |
| `LLM_MODEL_ID` | `gpt-4o-mini` | 模型 ID |
| `LLM_BASE_URL` | - | 自定义 API 地址（兼容 OpenAI 格式的第三方服务） |
| `AGENT_SYSTEM_PROMPT` | 默认系统提示词 | 自定义 Agent 角色设定 |
| `AGENT_MAX_TURNS` | `10` | 最大对话轮次 |

### 配置示例

```bash
# 使用 OpenAI 兼容的第三方服务（如 DeepSeek、Ollama 等）
LLM_PROVIDER=openai \
LLM_API_KEY=sk-xxx \
LLM_MODEL_ID=deepseek-chat \
LLM_BASE_URL=https://api.deepseek.com/v1 \
npm run dev

# 自定义角色：英语老师
AGENT_SYSTEM_PROMPT="你是一名英语老师，请用英语回答用户的问题，并纠正用户的语法错误。" \
npm run dev
```

---

## 扩展方向

最终项目的架构设计充分考虑了可扩展性。以下是几个值得尝试的扩展方向。

### 扩展一：添加新工具

在 `ToolRegistry.ts` 的 `createBuiltinTools()` 函数中添加新工具。

**示例**：添加一个 `datetime` 工具，返回当前时间。

```typescript
// 在 createBuiltinTools() 中添加
registry.register({
  name: 'datetime',
  description: '获取当前日期和时间',
  parameters: Type.Object({}),  // 无参数
  execute: async () => {
    return {
      content: `当前时间：${new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    }
  },
})
```

**示例**：添加一个 `random_number` 工具。

```typescript
registry.register({
  name: 'random_number',
  description: '生成指定范围内的随机整数',
  parameters: Type.Object({
    min: Type.Number({ description: '最小值' }),
    max: Type.Number({ description: '最大值' }),
  }),
  execute: async (args) => {
    const { min, max } = args as { min: number; max: number }
    const result = Math.floor(Math.random() * (max - min + 1)) + min
    return { content: `随机数（${min}~${max}）：${result}` }
  },
})
```

### 扩展二：切换 LLM Provider

通过环境变量切换 Provider，无需修改代码：

```bash
# Mock 模式（默认）
LLM_PROVIDER=mock npm run dev

# OpenAI
LLM_PROVIDER=openai LLM_API_KEY=sk-xxx npm run dev

# Anthropic
LLM_PROVIDER=anthropic LLM_API_KEY=sk-ant-xxx npm run dev

# 第三方 OpenAI 兼容
LLM_PROVIDER=openai LLM_API_KEY=sk-xxx LLM_BASE_URL=https://api.xxx.com/v1 npm run dev
```

如果要添加新的 Provider（如 Google Gemini、Mistral AI），只需要：

1. 在 `LLMProvider.ts` 中实现 `ILLMProvider` 接口
2. 在 `createLLMProvider` 工厂函数中注册

```typescript
class GeminiProvider implements ILLMProvider {
  readonly config: LLMProviderConfig
  // 实现 complete() 和 stream() 方法
}

export function createLLMProvider(config: LLMProviderConfig): ILLMProvider {
  switch (config.provider) {
    case 'gemini': return new GeminiProvider(config)
    // ...
  }
}
```

### 扩展三：增加记忆能力

当前版本的 Agent 只在单次对话中有记忆（消息历史保存在内存中），每次重启对话都会丢失上下文。可以添加持久化记忆功能。

**方案一：文件存储**

```typescript
import { readFile, writeFile } from 'fs/promises'

class FileMemory {
  async save(sessionId: string, messages: Message[]): Promise<void> {
    await writeFile(`./memory/${sessionId}.json`, JSON.stringify(messages))
  }

  async load(sessionId: string): Promise<Message[]> {
    try {
      const data = await readFile(`./memory/${sessionId}.json`, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }
}
```

**方案二：数据库存储**

使用 SQLite 或 Redis 存储消息历史，适合生产环境。

```typescript
// 使用 better-sqlite3
class SQLiteMemory {
  private db: Database

  save(sessionId: string, messages: Message[]): void {
    const stmt = this.db.prepare(
      'INSERT INTO memories (session_id, role, content) VALUES (?, ?, ?)'
    )
    for (const msg of messages) {
      stmt.run(sessionId, msg.role, msg.content)
    }
  }
}
```

### 扩展四：多会话管理

当前应用只支持单次对话。可以添加多会话功能：

```typescript
class SessionManager {
  private sessions = new Map<string, Agent>()

  getOrCreate(sessionId: string): Agent {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Agent({ /* config */ }))
    }
    return this.sessions.get(sessionId)!
  }
}
```

### 扩展五：前端增强

| 功能 | 实现方式 | 难度 |
|------|----------|------|
| Markdown 渲染 | 使用 `react-markdown` 渲染消息内容 | 低 |
| 代码高亮 | 配合 `react-syntax-highlighter` | 低 |
| 语音输入 | 使用 Web Speech API | 中 |
| 对话历史 | 存储到 localStorage | 低 |
| 主题切换 | CSS 变量 + React Context | 中 |
| 消息搜索 | 前端过滤 | 低 |

---

## 从教学版到生产版

教学版 Pi Agent 保留了核心设计思想，但做了大量简化。如果要构建生产级 Agent，还需要考虑：

| 维度 | 教学版 | 生产版 |
|------|--------|--------|
| **持久化** | 内存存储 | 数据库（PostgreSQL / Redis） |
| **认证** | 无 | JWT / OAuth |
| **限流** | 无 | Rate Limiting |
| **日志** | 控制台输出 | 结构化日志 + 监控 |
| **错误恢复** | 基本 try-catch | 重试机制 + 熔断 |
| **测试** | 无 | 单元测试 + 集成测试 |
| **部署** | 手动启动 | Docker + CI/CD |
| **多租户** | 无 | 会话隔离 |
| **流式优化** | 简单 SSE | 压缩 + 批处理 |

---

## 小结

最终项目是一个可运行、可扩展的教学版 AI Agent。通过环境变量可以轻松切换 Mock / OpenAI / Anthropic 三种模式。在此基础上，你可以添加新工具、切换 Provider、增加记忆能力、管理多会话，甚至逐步演进到生产级应用。

## 小练习

1. 添加一个 `translate` 工具，调用 LLM 将文本翻译为指定语言
2. 实现一个简单的对话历史功能，将消息保存到 `localStorage`
3. 尝试接入一个 OpenAI 兼容的第三方服务（如 DeepSeek、Ollama 本地模型）
4. 在 Agent 类中添加 `maxTokens` 配置项，控制 LLM 输出的最大长度
