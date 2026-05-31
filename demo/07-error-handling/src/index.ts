/**
 * Demo 7: 错误处理与重试机制
 *
 * 目标：展示 Agent 在面对错误时的处理策略。
 * 真实环境中工具调用可能失败，Agent 需要优雅地处理这些情况。
 *
 * 核心知识点：
 * - 工具执行失败处理：isError 标记
 * - LLM 调用重试：指数退避
 * - 优雅降级：工具不可用时的替代方案
 * - Pi Agent 的设计原则：工具失败时抛出错误，而非返回错误信息
 */
import { Type } from '@sinclair/typebox'
import { createModel } from '@tutorial/shared'
import type { Tool, Message } from '@tutorial/shared'

// ──────────── 1. 可能出错的工具 ────────────

let weatherFailCount = 0

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
      if (operator === '/' && b === 0) {
        // Pi Agent 的设计：工具失败时抛出错误
        throw new Error('除数不能为零')
      }
      const ops: Record<string, number> = { '+': a + b, '-': a - b, '*': a * b, '/': a / b }
      if (!ops[operator]) {
        throw new Error(`不支持的运算符: ${operator}`)
      }
      return { content: `${a} ${operator} ${b} = ${ops[operator]}` }
    },
  },
  {
    name: 'weather',
    description: '查询天气',
    parameters: Type.Object({ location: Type.String() }),
    execute: async (args) => {
      // 模拟偶发失败（前两次调用故意失败）
      weatherFailCount++
      if (weatherFailCount <= 2) {
        throw new Error('天气服务暂时不可用，请稍后重试')
      }
      await new Promise(r => setTimeout(r, 300))
      return { content: `${(args as any).location}：晴朗，22°C` }
    },
  },
  {
    name: 'fallback_weather',
    description: '备选天气查询（当 weather 不可用时使用）',
    parameters: Type.Object({ location: Type.String() }),
    execute: async (args) => {
      await new Promise(r => setTimeout(r, 200))
      return { content: `${(args as any).location}：天气数据来自备选源，多云，20°C` }
    },
  },
]

// ──────────── 2. 带重试的 Agent Loop ────────────

/**
 * 指数退避重试
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      console.log(`   ⚠️ 第 ${attempt} 次尝试失败: ${(error as Error).message}`)

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) // 指数退避: 1s, 2s, 4s
        console.log(`   ⏳ 等待 ${delay}ms 后重试...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  throw lastError!
}

/**
 * 带错误处理的 Agent Loop
 */
async function agentLoopWithErrorHandling(
  userInput: string,
  tools: Tool[],
  model: ReturnType<typeof createModel>,
): Promise<void> {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手。如果工具调用失败，请告知用户并提供替代方案。' },
    { role: 'user', content: userInput },
  ]

  let turn = 0
  const MAX_TURNS = 5

  while (turn < MAX_TURNS) {
    turn++
    console.log(`\n🔄 Turn ${turn}`)

    // 调用 LLM
    const { content, toolCalls } = await model.complete(messages, tools)

    if (toolCalls.length === 0) {
      console.log(`🤖 Agent: ${content}`)
      break
    }

    console.log(`🔧 尝试调用: ${toolCalls.map(t => t.name).join(', ')}`)

    messages.push({
      role: 'assistant',
      content,
      toolCalls: toolCalls as any,
    } as Message)

    // 执行工具（带错误处理）
    for (const tc of toolCalls) {
      const tool = tools.find(t => t.name === tc.name)

      if (!tool) {
        console.log(`❌ 未找到工具: ${tc.name}`)
        messages.push({
          role: 'tool',
          content: `错误：未找到工具 "${tc.name}"。可用的工具有: ${tools.map(t => t.name).join(', ')}`,
          toolCallId: tc.id,
          toolName: tc.name,
          isError: true,
        } as any)
        continue
      }

      try {
        console.log(`   ▶ 执行 ${tc.name}...`)

        // 对易失败的工具使用重试
        let result
        if (tc.name === 'weather') {
          result = await retryWithBackoff(() => tool.execute(tc.arguments), 3, 500)
        } else {
          result = await tool.execute(tc.arguments)
        }

        console.log(`   ✅ 成功: ${result.content}`)
        messages.push({
          role: 'tool',
          content: result.content,
          toolCallId: tc.id,
          toolName: tc.name,
        })
      } catch (error) {
        const errorMsg = (error as Error).message
        console.log(`   ❌ 失败: ${errorMsg}`)

        // 关键设计：将错误信息以 isError 标记返回给 LLM
        // LLM 看到后会决定如何处理（重试、换工具、或告知用户）
        messages.push({
          role: 'tool',
          content: `错误: ${errorMsg}`,
          toolCallId: tc.id,
          toolName: tc.name,
          isError: true,
        } as any)
      }
    }
  }
}

// ──────────── 3. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 7: 错误处理与重试机制')
  console.log('='.repeat(50))

  const model = createModel({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
  })

  // 测试 1：除零错误
  console.log('\n--- 测试 1: 除零错误 ---')
  await agentLoopWithErrorHandling('请计算 10 / 0 等于多少？', tools, model)

  // 重置失败计数
  weatherFailCount = 0

  // 测试 2：服务不可用 + 重试恢复
  console.log('\n--- 测试 2: 服务偶发失败 + 重试恢复 ---')
  await agentLoopWithErrorHandling('北京今天天气怎么样？', tools, model)

  console.log('\n' + '='.repeat(50))
  console.log('Demo 7 总结:')
  console.log('  • 工具失败时抛出错误（而非返回错误内容）')
  console.log('  • 错误信息以 isError 标记返回给 LLM')
  console.log('  • 指数退避重试策略：1s → 2s → 4s')
  console.log('  • LLM 看到错误后可自主决定重试或换工具')
  console.log('  • 备选工具（fallback）提供优雅降级')
  console.log('='.repeat(50))
}

main().catch(console.error)
