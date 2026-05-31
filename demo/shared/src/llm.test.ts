/**
 * LLM 抽象层单元测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createModel } from './llm.js'
import type { Tool } from './tool.js'

const mockTool: Tool = {
  name: 'test_tool',
  description: '测试工具',
  parameters: { type: 'object', properties: {} },
  execute: () => ({ content: 'ok' }),
}

const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学运算',
  parameters: { type: 'object', properties: {} },
  execute: () => ({ content: '0' }),
}

const weatherTool: Tool = {
  name: 'weather',
  description: '查询天气',
  parameters: { type: 'object', properties: {} },
  execute: () => ({ content: '晴朗' }),
}

describe('MockModel', () => {
  const model = createModel({ provider: 'mock', modelId: 'mock' })

  it('complete() 返回文本回复', async () => {
    const { content, toolCalls } = await model.complete([
      { role: 'user', content: '你好' },
    ])
    assert.ok(content.length > 0)
    assert.equal(toolCalls.length, 0)
  })

  it('complete() 触发计算器工具', async () => {
    const { toolCalls } = await model.complete([
      { role: 'user', content: '请计算 123 + 456' },
    ], [calculatorTool])
    assert.equal(toolCalls.length, 1)
    assert.equal(toolCalls[0].name, 'calculator')
  })

  it('complete() 触发天气工具并提取城市', async () => {
    const { toolCalls } = await model.complete([
      { role: 'user', content: '上海天气怎么样' },
    ], [weatherTool])
    assert.equal(toolCalls.length, 1)
    assert.equal(toolCalls[0].name, 'weather')
    assert.equal(toolCalls[0].arguments.location, '上海')
  })

  it('complete() 天气工具默认城市为北京', async () => {
    const { toolCalls } = await model.complete([
      { role: 'user', content: '天气怎么样' },
    ], [weatherTool])
    assert.equal(toolCalls.length, 1)
    assert.equal(toolCalls[0].arguments.location, '北京')
  })

  it('complete() 工具结果回传后返回最终回复', async () => {
    const { content, toolCalls } = await model.complete([
      { role: 'user', content: '计算 1+1' },
      { role: 'assistant', content: '', toolCalls: [{ id: '1', name: 'calculator', arguments: {} }] },
      { role: 'tool', content: '2', toolCallId: '1', toolName: 'calculator' },
    ], [calculatorTool])
    assert.ok(content.includes('根据工具执行结果'))
    assert.equal(toolCalls.length, 0)
  })

  it('stream() 产出 text_delta 和 done 事件', async () => {
    const events: any[] = []
    for await (const e of model.stream([{ role: 'user', content: '你好' }])) {
      events.push(e)
    }
    assert.ok(events.some(e => e.type === 'text_delta'))
    assert.ok(events.some(e => e.type === 'done'))
  })

  it('stream() 产出 tool_call 事件', async () => {
    const events: any[] = []
    for await (const e of model.stream([{ role: 'user', content: '计算 1+1' }], [calculatorTool])) {
      events.push(e)
    }
    assert.ok(events.some(e => e.type === 'tool_call'))
  })

  it('无工具时不触发工具调用', async () => {
    const { toolCalls } = await model.complete([
      { role: 'user', content: '计算 1+1' },
    ])
    assert.equal(toolCalls.length, 0)
  })

  it('不相关输入不触发工具', async () => {
    const { toolCalls } = await model.complete([
      { role: 'user', content: '你好，今天过得怎么样？' },
    ], [calculatorTool, weatherTool])
    assert.equal(toolCalls.length, 0)
  })
})
