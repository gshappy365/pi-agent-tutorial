/**
 * Demo 3: 最简单的 Agent Loop
 *
 * 目标：实现最核心的 Agent 循环 —「思考 → 行动 → 观察」的往复。
 * 这是 Pi Agent 最核心的机制。
 *
 * Agent Loop 流程:
 * ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 * │ 用户输入  │────→│ LLM 调用  │────→│ 检测工具  │────→│ 执行工具  │
 * └──────────┘     └──────────┘     └──────────┘     └──────────┘
 *                                       │                   │
 *                                       │ 有工具调用         │ 完成
 *                                       ▼                   ▼
 *                                    ┌──────────┐     ┌──────────┐
 *                                    │ 继续循环  │←────│ 结果回传  │
 *                                    └──────────┘     └──────────┘
 *                                       │
 *                                       │ 无工具调用
 *                                       ▼
 *                                    ┌──────────┐
 *                                    │ 输出回复  │
 *                                    └──────────┘
 */
import { Type } from '@sinclair/typebox'
import { createModel } from '@tutorial/shared'
import type { Tool, Message, ToolCall } from '@tutorial/shared'

// ──────────── 1. 定义工具 ────────────

const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学运算（加、减、乘、除）',
  parameters: Type.Object({
    a: Type.Number({ description: '第一个数字' }),
    b: Type.Number({ description: '第二个数字' }),
    operator: Type.String({ description: '运算符: +, -, *, /' }),
  }),
  execute: (args) => {
    const { a, b, operator } = args as { a: number; b: number; operator: string }
    let result: number
    switch (operator) {
      case '+': result = a + b; break
      case '-': result = a - b; break
      case '*': result = a * b; break
      case '/':
        if (b === 0) return { content: '错误：除数不能为零', isError: true }
        result = a / b; break
      default:
        return { content: `错误：不支持的运算符 ${operator}`, isError: true }
    }
    return { content: `${a} ${operator} ${b} = ${result}` }
  },
}

const weatherTool: Tool = {
  name: 'weather',
  description: '查询指定城市的当前天气',
  parameters: Type.Object({
    location: Type.String({ description: '城市名称' }),
  }),
  execute: async (args) => {
    const { location } = args as { location: string }
    await new Promise(r => setTimeout(r, 300))
    return { content: `${location}：晴朗，22°C` }
  },
}

// ──────────── 2. 实现 Agent Loop ────────────

/**
 * 核心 Agent Loop 函数
 *
 * 这是 Pi Agent 最核心的机制简化版：
 * 1. 调用 LLM
 * 2. 检查是否有 tool_calls
 * 3. 有 → 执行工具 → 结果回传 → 返回步骤 1
 * 4. 无 → 输出最终回复
 */
async function agentLoop(
  userInput: string,
  tools: Tool[],
  model: ReturnType<typeof createModel>,
): Promise<void> {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手。你可以使用工具来回答用户的问题。' },
    { role: 'user', content: userInput },
  ]

  let turn = 0
  const MAX_TURNS = 5 // 防止无限循环
  let lastToolName = '' // 追踪上一轮执行的工具名，防止 Mock 模式重复调用

  console.log(`\n👤 用户: ${userInput}`)

  while (turn < MAX_TURNS) {
    turn++
    console.log(`\n🔄 Turn ${turn}: 调用 LLM...`)

    // Step 1: 调用 LLM
    const { content, toolCalls } = await model.complete(messages, tools)

    // Step 2: 检测是否有工具调用
    if (toolCalls.length === 0) {
      // 无工具调用 → 输出回复，结束循环
      console.log(`🤖 Agent: ${content}`)
      break
    }

    // Mock 模式检测：如果 LLM 连续请求同一个工具且参数相同，说明是 Mock 的
    // 关键词匹配缺陷导致的重复，直接退出循环
    const sameToolAsLast = toolCalls.length === 1 && toolCalls[0].name === lastToolName
    if (sameToolAsLast && turn > 1) {
      console.log(`🤖 Agent: ${content}`)
      break
    }

    // Step 3: 有工具调用 → 逐个执行
    console.log(`🔧 LLM 请求调用工具: ${toolCalls.map(t => t.name).join(', ')}`)

    // 将 LLM 的回复加入消息历史
    messages.push({
      role: 'assistant',
      content,
      toolCalls: toolCalls as any,
    } as Message)

    // 执行每个工具
    for (const toolCall of toolCalls) {
      const tool = tools.find(t => t.name === toolCall.name)
      if (!tool) {
        console.log(`❌ 未找到工具: ${toolCall.name}`)
        messages.push({
          role: 'tool',
          content: `错误：未找到工具 ${toolCall.name}`,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        })
        continue
      }

      console.log(`   ▶ 执行 ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`)
      const result = await tool.execute(toolCall.arguments)
      lastToolName = toolCall.name

      console.log(`   ✅ 结果: ${result.content}`)

      // Step 4: 将工具结果回传给消息历史
      messages.push({
        role: 'tool',
        content: result.content,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      })
    }

    // 继续循环 — LLM 会看到工具结果并决定下一步
    console.log(`   ↻ 将结果回传 LLM，继续下一轮...`)
  }

  if (turn >= MAX_TURNS) {
    console.log(`\n⚠️ 达到最大轮次限制 (${MAX_TURNS})，自动停止`)
  }
}

// ──────────── 3. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 3: 最简单的 Agent Loop')
  console.log('='.repeat(50))

  const model = createModel({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
  })

  const tools = [calculatorTool, weatherTool]

  // 运行多个测试用例
  const testCases = [
    '你好！',
    '请计算 123 + 456 等于多少？',
    '北京今天天气怎么样？',
  ]

  for (const input of testCases) {
    await agentLoop(input, tools, model)
    console.log('\n' + '='.repeat(40))
  }

  console.log('\nDemo 3 总结:')
  console.log('  • Agent Loop = 循环: LLM → 检测工具 → 执行 → 回传 → LLM')
  console.log('  • 每次工具执行结果都追加到消息历史')
  console.log('  • LLM 看到工具结果后决定继续调用工具还是回复用户')
  console.log('  • 必须设置最大轮次限制，防止无限循环')
  console.log('='.repeat(50))
}

main().catch(console.error)
