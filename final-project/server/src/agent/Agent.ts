/**
 * Agent 核心类 — 最终项目版
 *
 * 高层封装，组合 LLMProvider、ToolRegistry、EventBus、AgentLoop。
 * 提供简洁的 API 供外部调用。
 *
 * 参考 Pi Agent 的 Agent 类设计：
 * - 有状态：维护消息历史
 * - 可订阅：通过 EventBus 获取实时事件
 * - 可中止：支持 AbortSignal
 */
import { createLLMProvider, type LLMProviderConfig } from './LLMProvider.js'
import { createBuiltinTools, type ToolRegistry, type Tool } from './ToolRegistry.js'
import { EventBus, type AgentEvent } from './EventBus.js'
import { runAgentLoopStreaming, type AgentLoopConfig } from './AgentLoop.js'

export type { AgentEvent }

export interface AgentConfig {
  provider: LLMProviderConfig
  systemPrompt?: string
  maxTurns?: number
  tools?: ToolRegistry
}

export class Agent {
  private provider
  private toolRegistry: ToolRegistry
  private eventBus = new EventBus()
  private config: AgentLoopConfig
  private _isRunning = false

  constructor(config: AgentConfig) {
    this.provider = createLLMProvider(config.provider)
    this.toolRegistry = config.tools || createBuiltinTools()
    this.config = {
      maxTurns: config.maxTurns || 10,
      systemPrompt: config.systemPrompt || '你是一个有帮助的 AI 助手。你可以使用提供的工具来回答用户的问题。',
    }
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  get tools(): Tool[] {
    return this.toolRegistry.getAll()
  }

  /** 注册额外工具 */
  registerTool(tool: Tool): void {
    this.toolRegistry.register(tool)
  }

  /** 订阅 Agent 事件 */
  subscribe(listener: (event: AgentEvent) => void): () => void {
    return this.eventBus.subscribe(listener)
  }

  /** 发送消息并获取流式回复 */
  async chat(userInput: string, onDelta?: (delta: string) => void): Promise<string> {
    if (this._isRunning) {
      throw new Error('Agent 正在处理中')
    }

    this._isRunning = true

    try {
      const response = await runAgentLoopStreaming(
        userInput,
        this.provider,
        this.toolRegistry,
        this.eventBus,
        onDelta || (() => {}),
        this.config,
      )
      return response
    } finally {
      this._isRunning = false
    }
  }

  /** 获取事件历史 */
  getEventHistory(): AgentEvent[] {
    return this.eventBus.getHistory()
  }

  /** 重置事件历史 */
  clearEventHistory(): void {
    this.eventBus.clearHistory()
  }
}
