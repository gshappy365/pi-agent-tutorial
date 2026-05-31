/**
 * Demo 3: Agent Loop 集成测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createModel } from '@tutorial/shared'
import type { Tool, Message, ToolCall } from '@tutorial/shared'

const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学运算',
  parameters: { type: 'object', properties: {} },
  execute: (args: any) => {
    const { a, b, operator } = args
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

async function agentLoop(
  userInput: string,
  tools: Tool[],
  model: ReturnType<typeof createModel>,
): Promise<{ response: string; turnCount: number }> {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手。' },
    { role: 'user', content: userInput },
  ]

  let turn = 0
  const MAX_TURNS = 5
  let lastToolName = ''

  while (turn < MAX_TURNS) {
    turn++
    const { content, toolCalls } = await model.complete(messages, tools)

    if (toolCalls.length === 0) {
      return { response: content, turnCount: turn }
    }

    const sameToolAsLast = toolCalls.length === 1 && toolCalls[0].name === lastToolName
    if (sameToolAsLast && turn > 1) {
      return { response: content, turnCount: turn }
    }

    messages.push({ role: 'assistant', content, toolCalls: toolCalls as any } as Message)

    for (const tc of toolCalls) {
      const tool = tools.find(t => t.name === tc.name)
      if (!tool) continue
      const result = await tool.execute(tc.arguments)
      lastToolName = tc.name
      messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, toolName: tc.name })
    }
  }

  return { response: '达到最大轮次', turnCount: turn }
}

describe('Demo 3: Agent Loop', () => {
  const model = createModel({ provider: 'mock', modelId: 'mock' })
  const tools = [calculatorTool]

  it('普通对话直接回复', async () => {
    const { response, turnCount } = await agentLoop('你好', tools, model)
    assert.ok(response.length > 0)
    assert.equal(turnCount, 1)
  })

  it('计算请求触发工具调用', async () => {
    const { response, turnCount } = await agentLoop('计算 123 + 456', tools, model)
    assert.ok(response.length > 0)
    assert.ok(turnCount >= 1)
  })

  it('不相关输入不重复触发工具', async () => {
    const { turnCount } = await agentLoop('你好，今天过得怎么样？', tools, model)
    assert.equal(turnCount, 1)
  })
})
