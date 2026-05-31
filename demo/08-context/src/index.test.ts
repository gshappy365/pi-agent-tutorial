/**
 * Demo 8: 上下文管理单元测试
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createModel } from '@tutorial/shared'
import type { Message } from '@tutorial/shared'

function estimateTokens(text: string): number {
  let tokens = 0
  for (const char of text) {
    if (/[一-鿿]/.test(char)) tokens += 1.5
    else if (/\s/.test(char)) tokens += 0.25
    else tokens += 0.3
  }
  return Math.ceil(tokens)
}

function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
}

function trimContext(messages: Message[], maxTokens: number, keepRatio: number = 0.5): Message[] {
  const currentTokens = estimateMessagesTokens(messages)
  if (currentTokens <= maxTokens) return messages

  const systemMessages = messages.filter(m => m.role === 'system')
  const otherMessages = messages.filter(m => m.role !== 'system')
  const targetTokens = maxTokens * keepRatio
  let keptTokens = 0
  const keptMessages: Message[] = []

  for (const msg of otherMessages.toReversed()) {
    const msgTokens = estimateTokens(msg.content)
    if (keptTokens + msgTokens <= targetTokens || keptMessages.length < 3) {
      keptMessages.unshift(msg)
      keptTokens += msgTokens
    } else {
      break
    }
  }

  return [...systemMessages, ...keptMessages]
}

async function summarizeContext(
  messages: Message[],
  maxTokens: number,
  model: ReturnType<typeof createModel>,
): Promise<Message[]> {
  const currentTokens = estimateMessagesTokens(messages)
  if (currentTokens <= maxTokens) return messages

  const splitIndex = Math.floor(messages.length * 0.4)
  const toSummarize = messages.slice(0, splitIndex)
  const keepMessages = messages.slice(splitIndex)

  const summaryPrompt = `请将以下对话压缩为一段简洁的摘要，保留关键信息（数字、名称、决定）：\n\n${toSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n')}`

  const { content } = await model.complete([
    { role: 'system', content: '你是一个专业的对话摘要生成器。请提取关键信息，包括具体数字、主题、人名和重要决定。保持客观，不要添加原文没有的信息。' },
    { role: 'user', content: summaryPrompt },
  ])

  const summaryMessage: Message = { role: 'system', content: `[对话摘要]: ${content}` }
  return [summaryMessage, ...keepMessages]
}

describe('Token 估算', () => {
  it('估算中文字符', () => {
    const tokens = estimateTokens('你好世界')
    assert.ok(tokens > 0)
  })

  it('估算英文文本', () => {
    const tokens = estimateTokens('hello world')
    assert.ok(tokens > 0)
  })

  it('空文本返回 0', () => {
    assert.equal(estimateTokens(''), 0)
  })
})

describe('裁剪策略', () => {
  const messages: Message[] = [
    { role: 'system', content: '你是一个助手。' },
    { role: 'user', content: '第一轮用户消息' },
    { role: 'assistant', content: '第一轮回复' },
    { role: 'user', content: '第二轮用户消息' },
    { role: 'assistant', content: '第二轮回复' },
  ]

  it('未超过限制不裁剪', () => {
    const result = trimContext(messages, 99999)
    assert.equal(result.length, messages.length)
  })

  it('超过限制时保留 system prompt', () => {
    const result = trimContext(messages, 10)
    assert.ok(result.some(m => m.role === 'system'))
  })

  it('超过限制时减少消息数', () => {
    const result = trimContext(messages, 30, 0.5)
    assert.ok(result.length < messages.length)
  })
})

describe('摘要策略', () => {
  const model = createModel({ provider: 'mock', modelId: 'mock' })

  it('未超过限制不压缩', async () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },
    ]
    const result = await summarizeContext(messages, 99999, model)
    assert.equal(result.length, messages.length)
  })

  it('超过限制时生成摘要消息', async () => {
    const messages: Message[] = [
      { role: 'user', content: '第一轮：用户说了很多关于苹果的信息' },
      { role: 'assistant', content: '第一轮回复：理解了苹果相关的信息' },
      { role: 'user', content: '第二轮：用户又说了很多关于香蕉的信息' },
      { role: 'assistant', content: '第二轮回复：理解了香蕉相关的信息' },
    ]
    const result = await summarizeContext(messages, 20, model)
    assert.ok(result.some(m => m.content.startsWith('[对话摘要]')))
  })
})
