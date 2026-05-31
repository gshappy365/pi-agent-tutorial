/**
 * LLM Provider — 最终项目版
 *
 * 统一的 LLM 抽象层，支持 Mock / OpenAI / Anthropic 三种 Provider。
 * 与 Demo 版共享相同接口设计，但更健壮。
 */

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LLMResponse {
  content: string
  toolCalls: ToolCall[]
}

export interface LLMProviderConfig {
  provider: 'mock' | 'openai' | 'anthropic'
  modelId: string
  apiKey?: string
  baseUrl?: string
}

export interface ILLMProvider {
  readonly config: LLMProviderConfig
  complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>
  stream(
    messages: Message[],
    tools?: ToolDefinition[],
    onDelta?: (delta: string) => void,
  ): Promise<LLMResponse>
}

// ──────────── Mock Provider ────────────

class MockProvider implements ILLMProvider {
  readonly config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
  }

  async complete(messages: Message[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
    const lastMsg = messages[messages.length - 1]
    const hasToolResults = messages.some(m => m.role === 'tool')

    if (hasToolResults) {
      const results = messages.filter(m => m.role === 'tool').map(m => `[${m.toolName}]: ${m.content}`).join('\n')
      return { content: `根据工具执行结果：\n\n${results}\n\n我已经完成了上述操作。`, toolCalls: [] }
    }

    const toolCall = this.detectToolCall(lastMsg?.content || '', _tools)
    if (toolCall) {
      return { content: `我需要使用 ${toolCall.name} 工具。`, toolCalls: [toolCall] }
    }

    return { content: this.generateReply(lastMsg?.content || ''), toolCalls: [] }
  }

  async stream(messages: Message[], tools?: ToolDefinition[], onDelta?: (delta: string) => void): Promise<LLMResponse> {
    const result = await this.complete(messages, tools)
    if (onDelta && !result.toolCalls.length) {
      for (const char of result.content) {
        onDelta(char)
        await new Promise(r => setTimeout(r, 10))
      }
    }
    return result
  }

  private detectToolCall(content: string, tools?: ToolDefinition[]): ToolCall | null {
    if (!tools) return null
    if (/计算|\d+\s*[+\-*/]\s*\d+/.test(content)) {
      const match = content.match(/(\d+)\s*([+\-*/])\s*(\d+)/)
      if (match && tools.find(t => t.name === 'calculator')) {
        return { id: `call_${Date.now()}`, name: 'calculator', arguments: { a: Number(match[1]), b: Number(match[3]), operator: match[2] } }
      }
    }
    if (/天气|气温|下雨/.test(content) && tools.find(t => t.name === 'weather')) {
      return { id: `call_${Date.now()}`, name: 'weather', arguments: { location: '北京' } }
    }
    return null
  }

  private generateReply(content: string): string {
    if (/你好|hello/.test(content)) return '你好！我是教学版 Pi Agent。我可以帮你计算、查天气等。'
    if (/你是谁/.test(content)) return '我是基于 Pi Agent 设计思想构建的教学版 AI Agent。'
    return `你说的是：「${content.slice(0, 30)}」\n\n（这是 Mock 回复，配置 API Key 后可切换到真实 LLM）`
  }
}

// ──────────── OpenAI Provider ────────────

class OpenAIProvider implements ILLMProvider {
  readonly config: LLMProviderConfig
  private client: any

  constructor(config: LLMProviderConfig) {
    this.config = config
  }

  private getClient() {
    if (!this.client) {
      const OpenAI = (globalThis as any).OpenAI || require('openai').default
      this.client = new OpenAI({ apiKey: this.config.apiKey, baseURL: this.config.baseUrl })
    }
    return this.client
  }

  async complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const client = this.getClient()
    const response = await client.chat.completions.create({
      model: this.config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools?.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    })
    const choice = response.choices?.[0]?.message
    if (!choice) return { content: '', toolCalls: [] }
    return {
      content: choice.content || '',
      toolCalls: (choice.tool_calls || []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.safeJson(tc.function.arguments, {}),
      })),
    }
  }

  async stream(messages: Message[], tools?: ToolDefinition[], onDelta?: (delta: string) => void): Promise<LLMResponse> {
    const client = this.getClient()
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
      if (!delta) continue
      if (delta.content) {
        content += delta.content
        onDelta?.(delta.content)
      }
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
    }

    return { content, toolCalls }
  }

  private safeJson(str: string, fallback: any) { try { return JSON.parse(str) } catch { return fallback } }
}

// ──────────── Anthropic Provider ────────────

class AnthropicProvider implements ILLMProvider {
  readonly config: LLMProviderConfig
  private client: any

  constructor(config: LLMProviderConfig) {
    this.config = config
  }

  private getClient() {
    if (!this.client) {
      const { Anthropic } = require('@anthropic-ai/sdk')
      this.client = new Anthropic({ apiKey: this.config.apiKey })
    }
    return this.client
  }

  async complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const client = this.getClient()
    const systemMsg = messages.find(m => m.role === 'system')
    const response = await client.messages.create({
      model: this.config.modelId,
      system: systemMsg?.content,
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
      tools: tools?.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      max_tokens: 4096,
    })

    let content = ''
    const toolCalls: ToolCall[] = []
    for (const block of response.content) {
      if (block.type === 'text') content += block.text
      if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, arguments: block.input as any })
    }
    return { content, toolCalls }
  }

  async stream(messages: Message[], tools?: ToolDefinition[], onDelta?: (delta: string) => void): Promise<LLMResponse> {
    const client = this.getClient()
    const systemMsg = messages.find(m => m.role === 'system')
    const stream = await client.messages.create({
      model: this.config.modelId,
      system: systemMsg?.content,
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
      tools: tools?.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      max_tokens: 4096,
      stream: true,
    })

    let content = ''
    const toolCalls: ToolCall[] = []

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        content += event.delta.text
        onDelta?.(event.delta.text)
      }
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        toolCalls.push({ id: event.content_block.id, name: event.content_block.name, arguments: event.content_block.input || {} })
      }
    }

    return { content, toolCalls }
  }
}

// ──────────── Factory ────────────

export function createLLMProvider(config: LLMProviderConfig): ILLMProvider {
  switch (config.provider) {
    case 'mock': return new MockProvider(config)
    case 'openai': return new OpenAIProvider(config)
    case 'anthropic': return new AnthropicProvider(config)
    default: throw new Error(`Unknown provider: ${config.provider}`)
  }
}
