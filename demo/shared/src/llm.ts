/**
 * LLM 统一抽象层 — 参考 Pi Agent 的 pi-ai 包设计
 *
 * 核心设计思想：
 * 1. 定义统一的 Model 接口，屏蔽不同提供商的 API 差异
 * 2. 支持流式（stream）和完整（complete）两种调用方式
 * 3. 内置 Mock Provider，无需 API Key 即可运行
 * 4. 支持 OpenAI 和 Anthropic 两种真实 Provider
 */
import type { Tool, ToolCall } from './tool.js'

// ──────────── 消息类型 ────────────

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ToolCallMessage extends Message {
  role: 'assistant'
  toolCalls: ToolCall[]
}

// ──────────── 流式事件 ────────────

export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'done'; content: string; toolCalls: ToolCall[] }
  | { type: 'error'; message: string }

// ──────────── Model 接口 ────────────

export interface ModelConfig {
  provider: 'mock' | 'openai' | 'anthropic'
  modelId: string
  apiKey?: string
  baseUrl?: string
}

/**
 * 统一的 Model 接口
 *
 * 这是 Pi Agent 中 pi-ai 包的核心抽象：
 * - stream(): 流式调用，逐块返回事件
 * - complete(): 完整调用，一次性返回结果
 */
export interface Model {
  readonly config: ModelConfig

  stream(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>

  async complete(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }>
}

// ──────────── Mock Provider ────────────

class MockModel implements Model {
  readonly config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
  }

  async *stream(
    messages: Message[],
    tools?: Tool[],
    _signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const lastMsg = messages[messages.length - 1]
    const hasToolMessages = messages.some(m => m.role === 'tool')
    const isFollowUp = hasToolMessages

    // 模拟思考延迟
    await delay(500)

    if (isFollowUp) {
      // 工具结果回传后，生成最终回复
      const result = extractToolResults(messages)
      const response = `根据工具执行结果：\n\n${result}\n\n我已经完成了上述操作。`

      for (const char of response) {
        yield { type: 'text_delta', delta: char }
        await delay(20)
      }
      yield { type: 'done', content: response, toolCalls: [] }
      return
    }

    // 检查是否需要调用工具
    const toolCall = this.shouldCallTool(lastMsg?.content || '', tools)

    if (toolCall && tools) {
      yield { type: 'tool_call', toolCall }
      yield {
        type: 'done',
        content: `我需要使用 ${toolCall.name} 工具来回答这个问题。`,
        toolCalls: [toolCall],
      }
      return
    }

    // 普通文本回复
    const response = this.generateResponse(lastMsg?.content || '')

    for (const char of response) {
      yield { type: 'text_delta', delta: char }
      await delay(15)
    }
    yield { type: 'done', content: response, toolCalls: [] }
  }

  async complete(
    messages: Message[],
    tools?: Tool[],
    _signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const lastMsg = messages[messages.length - 1]
    const hasToolResults = messages.some(m => m.role === 'tool')

    // 如果已有工具结果，说明是工具执行后的回传回合，生成最终回复
    if (hasToolResults) {
      const result = extractToolResults(messages)
      return {
        content: `根据工具执行结果：\n\n${result}\n\n我已经完成了上述操作。`,
        toolCalls: [],
      }
    }

    const toolCall = this.shouldCallTool(lastMsg?.content || '', tools)

    if (toolCall) {
      return {
        content: `我需要使用 ${toolCall.name} 工具。`,
        toolCalls: [toolCall],
      }
    }

    return {
      content: this.generateResponse(lastMsg?.content || ''),
      toolCalls: [],
    }
  }

  private shouldCallTool(
    content: string,
    tools?: Tool[],
  ): ToolCall | null {
    if (!tools || tools.length === 0) return null

    const lower = content.toLowerCase()

    // 按优先级检查：先检查特定关键词模式，再检查工具名匹配
    // 计算相关关键词触发计算器
    if (/计算|\d+\s*[+\-*/]\s*\d+/.test(lower)) {
      const calcTool = tools.find(t => t.name === 'calculator')
      if (calcTool) {
        const match = content.match(/(\d+)\s*([+\-*/])\s*(\d+)/)
        return {
          id: `call_${Date.now()}`,
          name: 'calculator',
          arguments: match
            ? { a: Number(match[1]), b: Number(match[3]), operator: match[2] }
            : { a: 0, b: 0, operator: '+' },
        }
      }
    }

    // 天气相关触发天气工具
    if (/天气|气温|下雨/.test(lower)) {
      const weatherTool = tools.find(t => t.name === 'weather')
      if (weatherTool) {
        // 尝试从内容中提取城市名
        const cityMatch = content.match(/(?:查询|查|看看|问|知道)?([一-鿿]{2,3})(?:的)?(?:天气|气温)/)
        const location = cityMatch ? cityMatch[1] : '北京'
        return {
          id: `call_${Date.now()}`,
          name: 'weather',
          arguments: { location },
        }
      }
    }

    // 通用工具名匹配（放在最后，避免和特定关键词抢匹配）
    for (const tool of tools) {
      if (tool.name === 'calculator' || tool.name === 'weather') continue // 已在上方处理
      if (lower.includes(tool.name.toLowerCase())) {
        return {
          id: `call_${Date.now()}`,
          name: tool.name,
          arguments: {},
        }
      }
    }

    return null
  }

  private generateResponse(content: string): string {
    if (content.includes('你好') || content.includes('hello')) {
      return '你好！我是 Pi Agent 的教学版 Demo。我可以帮你回答问题、执行计算、查询天气等。请问有什么可以帮你的？'
    }
    if (content.includes('你是谁')) {
      return '我是基于 Pi Agent 设计思想构建的教学版 AI Agent Demo。我的核心是一个「LLM + 工具调用」的 Agent Loop。'
    }
    return `你说的是：「${content.slice(0, 50)}」\n\n这是一个 Mock 回复。如果需要真实 LLM 响应，请配置 API Key 并切换到 OpenAI 或 Anthropic Provider。`
  }
}

// ──────────── OpenAI Provider ────────────

class OpenAIModel implements Model {
  readonly config: ModelConfig
  private client: any

  constructor(config: ModelConfig) {
    this.config = config
  }

  private getClient(): any {
    if (!this.client) {
      const OpenAI = require('openai').default || require('openai')
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      })
    }
    return this.client
  }

  async *stream(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const client = this.getClient()

    const stream = await client.chat.completions.create({
      model: this.config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      stream: true,
    }, { signal })

    let fullContent = ''
    let toolCalls: ToolCall[] = []

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      if (delta.content) {
        fullContent += delta.content
        yield { type: 'text_delta', delta: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            const existing = toolCalls.find(t => t.id === tc.id)
            if (!existing) {
              toolCalls.push({
                id: tc.id,
                name: tc.function.name,
                arguments: {},
              })
            }
          }
          if (tc.function?.arguments) {
            const existing = toolCalls.find(t => t.id === tc.id)
            if (existing) {
              existing.arguments = {
                ...existing.arguments,
                ...safeJsonParse(tc.function.arguments, {}),
              }
            }
          }
        }
      }
    }

    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: 'tool_call', toolCall: tc }
      }
    }

    yield { type: 'done', content: fullContent, toolCalls }
  }

  async complete(messages: Message[], tools?: Tool[]): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const client = this.getClient()

    const response = await client.chat.completions.create({
      model: this.config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    })

    const choice = response.choices?.[0]?.message
    if (!choice) return { content: '', toolCalls: [] }

    const toolCalls: ToolCall[] = (choice.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeJsonParse(tc.function.arguments, {}),
    }))

    return { content: choice.content || '', toolCalls }
  }
}

// ──────────── Anthropic Provider ────────────

class AnthropicModel implements Model {
  readonly config: ModelConfig

  constructor(config: ModelConfig) {
    this.config = config
  }

  private getClient(): any {
    const { Anthropic } = require('@anthropic-ai/sdk')
    return new Anthropic({ apiKey: this.config.apiKey })
  }

  async *stream(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const client = this.getClient()

    // Anthropic 需要 system 消息单独传入
    const systemMsg = messages.find(m => m.role === 'system')
    const normalMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolCallId || '',
                content: m.content,
              },
            ],
          }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      })

    const stream = await client.messages.create({
      model: this.config.modelId,
      system: systemMsg?.content,
      messages: normalMessages,
      tools: tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      max_tokens: 4096,
      stream: true,
    }, { signal })

    let fullContent = ''
    let toolCalls: ToolCall[] = []

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullContent += event.delta.text
        yield { type: 'text_delta', delta: event.delta.text }
      }
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        const cb = event.content_block
        toolCalls.push({
          id: cb.id,
          name: cb.name,
          arguments: cb.input || {},
        })
      }
    }

    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: 'tool_call', toolCall: tc }
      }
    }

    yield { type: 'done', content: fullContent, toolCalls }
  }

  async complete(messages: Message[], tools?: Tool[]): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const client = this.getClient()
    const systemMsg = messages.find(m => m.role === 'system')
    const normalMessages = messages.filter(m => m.role !== 'system')

    const response = await client.messages.create({
      model: this.config.modelId,
      system: systemMsg?.content,
      messages: normalMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })) as any,
      tools: tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      max_tokens: 4096,
    })

    const toolCalls: ToolCall[] = []
    let content = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      }
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        })
      }
    }

    return { content, toolCalls }
  }
}

// ──────────── Factory ────────────

/**
 * 创建 Model 实例 — 核心工厂函数
 *
 * 根据配置自动选择 Provider：
 * - mock: 内置模拟，无需 API Key
 * - openai: 调用 OpenAI API
 * - anthropic: 调用 Anthropic API
 */
export function createModel(config: ModelConfig): Model {
  switch (config.provider) {
    case 'mock':
      return new MockModel(config)
    case 'openai':
      return new OpenAIModel(config)
    case 'anthropic':
      return new AnthropicModel(config)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

// ──────────── 工具函数 ────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function safeJsonParse(str: string, fallback: any): any {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

function extractToolResults(messages: Message[]): string {
  return messages
    .filter(m => m.role === 'tool')
    .map(m => `[${m.toolName}]: ${m.content}`)
    .join('\n')
}
