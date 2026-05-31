/**
 * Demo 6: 有状态 Agent 与对话管理
 *
 * 目标：展示 Agent 如何维护对话状态，实现多轮对话。
 * 这是从"单次问答"到"持续对话"的关键升级。
 *
 * 核心知识点：
 * - 消息历史管理：追加、裁剪、持久化
 * - 会话状态：系统提示词、工具列表、对话上下文
 * - 多轮对话中的上下文连贯性
 * - Pi Agent 中 state 的可变设计
 */
import { Type } from '@sinclair/typebox'
import { createModel } from '@tutorial/shared'
import type { Tool, Message } from '@tutorial/shared'

// ──────────── 1. Agent 状态管理 ────────────

/**
 * Agent 状态 — 参考 Pi Agent 的 MutableAgentState
 *
 * 核心思想：
 * - 状态是可变的（mutable），允许运行时修改
 * - 包含系统提示、模型配置、工具列表、消息历史
 * - 提供运行时状态标记（isStreaming 等）
 */
interface AgentState {
  systemPrompt: string
  model: { provider: string; modelId: string }
  messages: Message[]
  tools: Tool[]
  isStreaming: boolean
  turnCount: number
}

class StatefulAgent {
  private state: AgentState
  private model: ReturnType<typeof createModel>

  constructor(config: {
    systemPrompt: string
    provider: string
    modelId: string
    apiKey?: string
    tools: Tool[]
  }) {
    this.state = {
      systemPrompt: config.systemPrompt,
      model: { provider: config.provider, modelId: config.modelId },
      messages: [],
      tools: config.tools,
      isStreaming: false,
      turnCount: 0,
    }

    this.model = createModel({
      provider: config.provider as any,
      modelId: config.modelId,
      apiKey: config.apiKey,
    })
  }

  /** 获取当前状态（只读快照） */
  getState(): Readonly<AgentState> {
    return { ...this.state, messages: [...this.state.messages] }
  }

  /** 更新工具列表 */
  setTools(tools: Tool[]): void {
    this.state.tools = tools
  }

  /** 追加系统提示 */
  appendSystemPrompt(extra: string): void {
    this.state.systemPrompt += '\n' + extra
  }

  /** 处理用户输入 */
  async chat(userInput: string): Promise<string> {
    if (this.state.isStreaming) {
      throw new Error('Agent 正在处理中，请等待完成')
    }

    this.state.isStreaming = true

    // 构建消息列表（系统提示 + 历史 + 新输入）
    const messages: Message[] = [
      { role: 'system', content: this.state.systemPrompt },
      ...this.state.messages,
      { role: 'user', content: userInput },
    ]

    this.state.turnCount++

    // 调用 LLM
    const { content, toolCalls } = await this.model.complete(messages, this.state.tools)

    // 处理工具调用
    if (toolCalls.length > 0) {
      // 添加用户消息到历史
      this.state.messages.push({ role: 'user', content: userInput })
      this.state.messages.push({
        role: 'assistant',
        content,
        toolCalls: toolCalls as any,
      } as Message)

      // 执行工具
      for (const tc of toolCalls) {
        const tool = this.state.tools.find(t => t.name === tc.name)
        if (tool) {
          const result = await tool.execute(tc.arguments)
          this.state.messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: tc.id,
            toolName: tc.name,
          })
        }
      }

      // 工具结果回传 LLM 生成最终回复
      const finalMessages: Message[] = [
        { role: 'system', content: this.state.systemPrompt },
        ...this.state.messages,
      ]
      const final = await this.model.complete(finalMessages, this.state.tools)
      this.state.messages.push({ role: 'assistant', content: final.content })
      this.state.isStreaming = false
      return `${content}\n\n${final.content}`
    }

    // 无工具调用，直接回复
    this.state.messages.push({ role: 'user', content: userInput })
    this.state.messages.push({ role: 'assistant', content })
    this.state.isStreaming = false
    return content
  }

  /** 重置对话 */
  reset(): void {
    this.state.messages = []
    this.state.turnCount = 0
  }

  /** 获取消息历史长度（token 估算） */
  getHistoryLength(): number {
    return this.state.messages.reduce((sum, m) => sum + m.content.length, 0)
  }
}

// ──────────── 2. 工具定义 ────────────

const tools: Tool[] = [
  {
    name: 'calculator',
    description: '执行数学运算',
    parameters: Type.Object({
      a: Type.Number(), b: Type.Number(),
      operator: Type.String(),
    }),
    execute: (args) => {
      const { a, b, operator } = args as any
      const ops: Record<string, number> = { '+': a + b, '-': a - b, '*': a * b, '/': a / b }
      return { content: `${a} ${operator} ${b} = ${ops[operator] || '无效'}` }
    },
  },
  {
    name: 'counter',
    description: '记录对话中提到的数字',
    parameters: Type.Object({ number: Type.Number() }),
    execute: (args) => {
      const { number } = args as { number: number }
      return { content: `已记录数字: ${number}` }
    },
  },
]

// ──────────── 3. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 6: 有状态 Agent 与对话管理')
  console.log('='.repeat(50))

  const agent = new StatefulAgent({
    systemPrompt: '你是一个有帮助的助手。记住用户提到的信息，在后续对话中可以引用。',
    provider: process.env.LLM_PROVIDER || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
    tools,
  })

  // 多轮对话演示
  const conversation = [
    '你好！我叫小明。',
    '你好，帮我计算 25 * 4 等于多少？',
    '还记得我叫什么名字吗？',
    '再帮我计算刚才的结果加上 100 是多少？',
  ]

  for (const input of conversation) {
    console.log(`\n👤 用户: ${input}`)
    console.log(`📊 当前历史长度: ${agent.getHistoryLength()} 字符`)

    const response = await agent.chat(input)
    console.log(`🤖 Agent: ${response}`)
  }

  // 查看最终状态
  console.log('\n' + '-'.repeat(40))
  console.log('📋 会话统计:')
  const finalState = agent.getState()
  console.log(`   总轮次: ${finalState.turnCount}`)
  console.log(`   消息数: ${finalState.messages.length}`)
  console.log(`   总字符: ${agent.getHistoryLength()}`)
  console.log(`   消息历史:`)
  for (const msg of finalState.messages) {
    const preview = msg.content.slice(0, 50)
    console.log(`     [${msg.role}] ${preview}${msg.content.length > 50 ? '...' : ''}`)
  }

  // 演示重置
  console.log('\n🔄 重置对话...')
  agent.reset()
  console.log(`   重置后消息数: ${agent.getState().messages.length}`)

  console.log('\n' + '='.repeat(50))
  console.log('Demo 6 总结:')
  console.log('  • 有状态 Agent 维护完整的消息历史')
  console.log('  • 每次对话都在历史基础上追加新消息')
  console.log('  • 状态包括：系统提示、工具列表、消息历史、运行标记')
  console.log('  • 支持重置、动态修改状态（如换工具）')
  console.log('  • Pi Agent 的 state 是可变对象，支持运行时修改')
  console.log('='.repeat(50))
}

main().catch(console.error)
