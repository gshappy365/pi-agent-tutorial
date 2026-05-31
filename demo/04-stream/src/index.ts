/**
 * Demo 4: 流式输出与事件分发
 *
 * 目标：在 Agent Loop 基础上增加事件系统，实现流式事件分发。
 * 这是 Pi Agent 事件系统的简化实现。
 *
 * 核心知识点：
 * - EventBus 的发布-订阅模式
 * - Agent 运行过程中的事件流
 * - 流式文本增量 vs 完整文本
 * - 事件驱动的架构设计
 */
import { Type } from '@sinclair/typebox'
import { EventBus, createModel } from '@tutorial/shared'
import type { Tool, Message, AgentEvent } from '@tutorial/shared'

// ──────────── 1. 工具定义 ────────────

const tools: Tool[] = [
  {
    name: 'calculator',
    description: '执行数学运算（加、减、乘、除）',
    parameters: Type.Object({
      a: Type.Number(), b: Type.Number(),
      operator: Type.String(),
    }),
    execute: (args) => {
      const { a, b, operator } = args as any
      const ops: Record<string, number> = { '+': a + b, '-': a - b, '*': a * b, '/': a / b }
      return { content: `${a} ${operator} ${b} = ${ops[operator] || '无效运算'}` }
    },
  },
  {
    name: 'weather',
    description: '查询天气',
    parameters: Type.Object({ location: Type.String() }),
    execute: async (args) => {
      await new Promise(r => setTimeout(r, 500))
      return { content: `${(args as any).location}：多云，18°C` }
    },
  },
]

// ──────────── 2. 带事件的 Agent Loop ────────────

/**
 * 带事件发布的 Agent Loop
 *
 * 相比 Demo 3，这里增加了事件发布：
 * - 每个阶段都通过 EventBus 发布事件
 * - 外部可以订阅事件来实时了解 Agent 状态
 * - 这是 Pi Agent 事件系统的核心设计
 */
async function agentLoopWithEvents(
  userInput: string,
  tools: Tool[],
  model: ReturnType<typeof createModel>,
  eventBus: EventBus,
): Promise<void> {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手。' },
    { role: 'user', content: userInput },
  ]

  eventBus.emit({ type: 'agent_start' })
  eventBus.emit({ type: 'turn_start', turn: 1 })

  // 使用 stream() 实现流式输出
  let fullContent = ''
  const stream = model.stream(messages, tools)

  eventBus.emit({ type: 'message_start', role: 'assistant' })

  for await (const event of stream) {
    if (event.type === 'text_delta') {
      fullContent += event.delta
      eventBus.emit({ type: 'message_update', delta: event.delta })
    }

    if (event.type === 'tool_call') {
      eventBus.emit({
        type: 'tool_execution_start',
        toolName: event.toolCall.name,
        args: event.toolCall.arguments,
      })

      const tool = tools.find(t => t.name === event.toolCall.name)
      if (tool) {
        eventBus.emit({
          type: 'tool_execution_update',
          toolName: event.toolCall.name,
          output: '执行中...',
        })

        const result = await tool.execute(event.toolCall.arguments)

        eventBus.emit({
          type: 'tool_execution_end',
          toolName: event.toolCall.name,
          result: result.content,
        })

        messages.push({
          role: 'tool',
          content: result.content,
          toolCallId: event.toolCall.id,
          toolName: event.toolCall.name,
        })
      }
    }

    if (event.type === 'done') {
      eventBus.emit({ type: 'message_end', role: 'assistant', content: fullContent })
      eventBus.emit({ type: 'turn_end', turn: 1 })
    }
  }

  // 如果有工具调用，继续下一轮
  const hasToolCalls = messages.some(m => m.role === 'tool')
  if (hasToolCalls) {
    eventBus.emit({ type: 'turn_start', turn: 2 })

    const stream2 = model.stream(messages, tools)
    let response = ''

    eventBus.emit({ type: 'message_start', role: 'assistant' })

    for await (const event of stream2) {
      if (event.type === 'text_delta') {
        response += event.delta
        eventBus.emit({ type: 'message_update', delta: event.delta })
      }
      if (event.type === 'done') {
        eventBus.emit({ type: 'message_end', role: 'assistant', content: response })
        eventBus.emit({ type: 'turn_end', turn: 2 })
      }
    }
  }

  eventBus.emit({ type: 'agent_end' })
}

// ──────────── 3. 事件订阅者 ────────────

/**
 * 创建一个打印事件到控制台的订阅者
 */
function createConsoleSubscriber() {
  return (event: AgentEvent) => {
    switch (event.type) {
      case 'agent_start':
        console.log('\n🏁 Agent 开始运行')
        break
      case 'agent_end':
        console.log('🏁 Agent 运行结束\n')
        break
      case 'turn_start':
        console.log(`\n🔄 Turn ${event.turn} 开始`)
        break
      case 'turn_end':
        console.log(`🔄 Turn ${event.turn} 结束`)
        break
      case 'message_start':
        console.log('💬 消息开始')
        break
      case 'message_update':
        process.stdout.write(event.delta)
        break
      case 'message_end':
        console.log('\n💬 消息完成')
        break
      case 'tool_execution_start':
        console.log(`🔧 工具开始: ${event.toolName}(${JSON.stringify(event.args)})`)
        break
      case 'tool_execution_update':
        console.log(`   ${event.output}`)
        break
      case 'tool_execution_end':
        console.log(`✅ 工具完成: ${event.result}`)
        break
    }
  }
}

// ──────────── 4. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 4: 流式输出与事件分发')
  console.log('='.repeat(50))

  const model = createModel({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
  })

  const eventBus = new EventBus()

  // 订阅事件 — 使用控制台打印
  const unsubscribe = eventBus.subscribe(createConsoleSubscriber())

  // 运行 Agent
  await agentLoopWithEvents('请计算 123 + 456 等于多少？', tools, model, eventBus)

  // 查看事件历史
  console.log('\n📋 事件历史记录:')
  const history = eventBus.getHistory()
  for (const event of history) {
    console.log(`   [${event.type}]`)
  }

  // 取消订阅
  unsubscribe()

  console.log('\n' + '='.repeat(50))
  console.log('Demo 4 总结:')
  console.log('  • EventBus 实现发布-订阅模式')
  console.log('  • Agent 运行过程产生结构化事件流')
  console.log('  • 订阅者可以实时响应事件（打印/存储/转发）')
  console.log('  • 事件历史可用于调试和回放')
  console.log('='.repeat(50))
}

main().catch(console.error)
