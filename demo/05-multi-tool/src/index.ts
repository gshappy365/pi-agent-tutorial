/**
 * Demo 5: 多工具协作
 *
 * 目标：展示 Agent 在一次交互中调用多个工具的协作模式。
 * 包括并行执行和串行执行两种策略。
 *
 * 核心知识点：
 * - 并行执行：多个工具同时执行，互不依赖
 * - 串行执行：工具 A 的结果作为工具 B 的输入
 * - 结果聚合：将多个工具的结果汇总给 LLM
 */
import { Type } from '@sinclair/typebox'
import { createModel, EventBus } from '@tutorial/shared'
import type { Tool, Message, ToolCall, AgentEvent } from '@tutorial/shared'

// ──────────── 1. 定义工具 ────────────

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
    name: 'weather',
    description: '查询天气',
    parameters: Type.Object({ location: Type.String() }),
    execute: async (args) => {
      await new Promise(r => setTimeout(r, 800))
      const { location } = args as { location: string }
      return { content: `${location}：多云，${Math.floor(Math.random() * 15 + 10)}°C` }
    },
  },
  {
    name: 'search',
    description: '搜索信息',
    parameters: Type.Object({ query: Type.String() }),
    execute: async (args) => {
      await new Promise(r => setTimeout(r, 600))
      const { query } = args as { query: string }
      return { content: `关于"${query}"的搜索结果：\n1. ${query}的相关介绍\n2. ${query}的最新动态\n3. ${query}的深度分析` }
    },
  },
]

// ──────────── 2. 并行执行 ────────────

/**
 * 并行执行多个工具
 * 所有工具同时启动，等待全部完成后返回
 */
async function executeToolsParallel(
  toolCalls: ToolCall[],
  tools: Tool[],
  eventBus: EventBus,
): Promise<Message[]> {
  const promises = toolCalls.map(async (tc) => {
    const tool = tools.find(t => t.name === tc.name)
    if (!tool) {
      return { role: 'tool' as const, content: `未找到工具: ${tc.name}`, toolCallId: tc.id, toolName: tc.name }
    }

    eventBus.emit({ type: 'tool_execution_start', toolName: tc.name, args: tc.arguments })
    const result = await tool.execute(tc.arguments)
    eventBus.emit({ type: 'tool_execution_end', toolName: tc.name, result: result.content })

    return { role: 'tool' as const, content: result.content, toolCallId: tc.id, toolName: tc.name }
  })

  return Promise.all(promises)
}

// ──────────── 3. 串行执行（工具链） ────────────

/**
 * 串行执行工具链
 * 前一个工具的输出作为后一个工具的输入
 */
async function executeToolChain(
  chain: Array<{ toolName: string; argsBuilder: (prevResult: string) => Record<string, unknown> }>,
  tools: Tool[],
  eventBus: EventBus,
): Promise<string[]> {
  const results: string[] = []
  let prevResult = ''

  for (const step of chain) {
    const tool = tools.find(t => t.name === step.toolName)
    if (!tool) throw new Error(`未找到工具: ${step.toolName}`)

    const args = step.argsBuilder(prevResult)
    eventBus.emit({ type: 'tool_execution_start', toolName: step.toolName, args })

    const result = await tool.execute(args)
    results.push(result.content)
    prevResult = result.content

    eventBus.emit({ type: 'tool_execution_end', toolName: step.toolName, result: result.content })
  }

  return results
}

// ──────────── 4. 带多工具支持的 Agent Loop ────────────

async function agentLoopMultiTool(
  userInput: string,
  tools: Tool[],
  model: ReturnType<typeof createModel>,
  eventBus: EventBus,
): Promise<void> {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手，可以使用多个工具来回答复杂问题。' },
    { role: 'user', content: userInput },
  ]

  let turn = 0
  const MAX_TURNS = 5

  eventBus.emit({ type: 'agent_start' })

  while (turn < MAX_TURNS) {
    turn++
    eventBus.emit({ type: 'turn_start', turn })

    const { content, toolCalls } = await model.complete(messages, tools)

    if (toolCalls.length === 0) {
      eventBus.emit({ type: 'message_start', role: 'assistant' })
      console.log(`\n🤖 Agent: ${content}`)
      eventBus.emit({ type: 'message_end', role: 'assistant', content })
      break
    }

    console.log(`\n🔧 本轮调用 ${toolCalls.length} 个工具: ${toolCalls.map(t => t.name).join(', ')}`)

    messages.push({
      role: 'assistant',
      content,
      toolCalls: toolCalls as any,
    } as Message)

    // 并行执行所有工具
    const toolResults = await executeToolsParallel(toolCalls, tools, eventBus)
    messages.push(...toolResults)

    eventBus.emit({ type: 'turn_end', turn })
  }

  eventBus.emit({ type: 'agent_end' })
}

// ──────────── 5. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 5: 多工具协作')
  console.log('='.repeat(50))

  const model = createModel({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
  })

  const eventBus = new EventBus()
  eventBus.subscribe((event) => {
    if (event.type === 'tool_execution_start') {
      console.log(`   ▶ ${event.toolName}(${JSON.stringify(event.args)})`)
    }
    if (event.type === 'tool_execution_end') {
      console.log(`   ✅ 结果: ${event.result.slice(0, 60)}...`)
    }
  })

  // 测试多工具协作
  await agentLoopMultiTool('北京今天天气怎么样？顺便计算 25 * 4 等于多少？', tools, model, eventBus)

  // 演示工具链（串行）
  console.log('\n--- 工具链演示（串行执行）---')
  const chainEventBus = new EventBus()
  chainEventBus.subscribe((event) => {
    if (event.type === 'tool_execution_start') {
      console.log(`   ▶ ${event.toolName}(${JSON.stringify(event.args)})`)
    }
    if (event.type === 'tool_execution_end') {
      console.log(`   ✅ ${event.result}`)
    }
  })

  await executeToolChain([
    { toolName: 'weather', argsBuilder: () => ({ location: '北京' }) },
    { toolName: 'search', argsBuilder: (prev) => ({ query: `${prev.slice(0, 10)} 旅游推荐` }) },
  ], tools, chainEventBus)

  console.log('\n' + '='.repeat(50))
  console.log('Demo 5 总结:')
  console.log('  • 并行执行：多个独立工具同时运行，提高效率')
  console.log('  • 串行执行：工具链，前一个结果作为后一个的输入')
  console.log('  • 复杂问题通常需要多个工具协作完成')
  console.log('  • Pi Agent 支持 parallel 和 sequential 两种执行模式')
  console.log('='.repeat(50))
}

main().catch(console.error)
