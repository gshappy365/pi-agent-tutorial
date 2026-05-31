/**
 * Demo 8: 上下文管理
 *
 * 目标：展示 Agent 如何管理上下文窗口（Context Window）。
 * LLM 有固定的上下文长度限制，当对话过长时需要裁剪或压缩。
 *
 * 核心知识点：
 * - Token 估算：粗略估算消息的 token 数
 * - 消息裁剪：移除最早的非关键消息
 * - 上下文摘要：将早期对话压缩为摘要
 * - Pi Agent 的 compaction 机制
 */
import { createModel } from '@tutorial/shared'
import type { Message } from '@tutorial/shared'

// ──────────── 1. Token 估算 ────────────

/**
 * 粗略估算文本的 token 数
 *
 * 实际项目中应使用 tiktoken 等库精确计算，
 * 这里使用 1 token ≈ 2 个中文字符的粗略估算。
 */
function estimateTokens(text: string): number {
  // 中文字符算 1.5 token，英文算 0.3 token
  let tokens = 0
  for (const char of text) {
    if (/[一-鿿]/.test(char)) {
      tokens += 1.5
    } else if (/\s/.test(char)) {
      tokens += 0.25
    } else {
      tokens += 0.3
    }
  }
  return Math.ceil(tokens)
}

function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
}

// ──────────── 2. 上下文压缩策略 ────────────

/**
 * 策略 1: 简单裁剪
 * 当上下文超过限制时，移除最早的消息（保留 system prompt 和最近的消息）
 */
function trimContext(
  messages: Message[],
  maxTokens: number,
  keepRatio: number = 0.5,
): Message[] {
  const currentTokens = estimateMessagesTokens(messages)

  if (currentTokens <= maxTokens) {
    return messages // 不需要裁剪
  }

  // 保留 system prompt
  const systemMessages = messages.filter(m => m.role === 'system')
  const otherMessages = messages.filter(m => m.role !== 'system')

  // 计算要保留的非系统消息数
  const targetTokens = maxTokens * keepRatio
  let keptTokens = 0
  const keptMessages: Message[] = []

  // 从后往前保留（保留最近的对话）
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

/**
 * 策略 2: 摘要压缩
 * 将早期对话压缩为一段摘要
 */
async function summarizeContext(
  messages: Message[],
  maxTokens: number,
  model: ReturnType<typeof createModel>,
): Promise<Message[]> {
  const currentTokens = estimateMessagesTokens(messages)

  if (currentTokens <= maxTokens) {
    return messages
  }

  // 找到需要压缩的部分（前 60% 的消息）
  const splitIndex = Math.floor(messages.length * 0.4)
  const toSummarize = messages.slice(0, splitIndex)
  const keepMessages = messages.slice(splitIndex)

  // 生成摘要
  const summaryPrompt = `请将以下对话压缩为一段简洁的摘要，保留关键信息（数字、名称、决定）：\n\n${toSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n')}`

  const { content } = await model.complete([
    { role: 'system', content: '你是一个专业的对话摘要生成器。请提取关键信息，包括具体数字、主题、人名和重要决定。保持客观，不要添加原文没有的信息。' },
    { role: 'user', content: summaryPrompt },
  ])

  const summaryMessage: Message = {
    role: 'system',
    content: `[对话摘要]: ${content}`,
  }

  return [summaryMessage, ...keepMessages]
}

// ──────────── 3. 模拟长对话 ────────────

function generateLongConversation(): Message[] {
  const messages: Message[] = [
    { role: 'system', content: '你是一个有帮助的助手。' },
  ]

  // 生成 20 轮对话
  for (let i = 1; i <= 20; i++) {
    messages.push({
      role: 'user',
      content: `这是第 ${i} 轮的用户消息，包含一些具体信息：用户在第 ${i} 轮提到了一些重要数据，比如数字 ${i * 100} 和关键词「${['苹果', '香蕉', '橙子', '西瓜', '葡萄'][i % 5]}」。`,
    })
    messages.push({
      role: 'assistant',
      content: `这是第 ${i} 轮的助手回复。我已经理解了用户提到的信息，包括数字 ${i * 100} 和 ${['苹果', '香蕉', '橙子', '西瓜', '葡萄'][i % 5]} 相关的讨论。让我继续跟进这个话题。`,
    })
  }

  return messages
}

// ──────────── 4. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 8: 上下文管理')
  console.log('='.repeat(50))

  const model = createModel({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
  })

  // 生成长对话
  const conversation = generateLongConversation()
  const totalTokens = estimateMessagesTokens(conversation)

  console.log(`\n📊 原始对话统计:`)
  console.log(`   消息数: ${conversation.length}`)
  console.log(`   估算 Token: ${totalTokens}`)
  console.log(`   上下文限制: 4096 tokens`)

  // 演示裁剪
  console.log(`\n--- 策略 1: 简单裁剪 ---`)
  const maxTokens = 800
  const trimmed = trimContext(conversation, maxTokens, 0.6)
  console.log(`   裁剪前: ${conversation.length} 条消息, ${totalTokens} tokens`)
  console.log(`   裁剪后: ${trimmed.length} 条消息, ${estimateMessagesTokens(trimmed)} tokens`)
  console.log(`   保留的消息角色: ${trimmed.map(m => m.role).join(' → ')}`)

  // 演示摘要压缩
  console.log(`\n--- 策略 2: 摘要压缩 ---`)
  const summarized = await summarizeContext(conversation, maxTokens, model)
  console.log(`   压缩前: ${conversation.length} 条消息, ${totalTokens} tokens`)
  console.log(`   压缩后: ${summarized.length} 条消息, ${estimateMessagesTokens(summarized)} tokens`)
  console.log(`   摘要内容: ${summarized[0]?.content.slice(0, 100)}...`)

  // 对比
  console.log(`\n--- 策略对比 ---`)
  console.log(`| 策略 | 消息数 | Token 数 | 信息完整性 |`)
  console.log(`|------|--------|----------|-----------|`)
  console.log(`| 原始 | ${conversation.length} | ${totalTokens} | 完整 |`)
  console.log(`| 裁剪 | ${trimmed.length} | ${estimateMessagesTokens(trimmed)} | 丢失早期信息 |`)
  console.log(`| 摘要 | ${summarized.length} | ${estimateMessagesTokens(summarized)} | 保留关键信息 |`)

  console.log('\n' + '='.repeat(50))
  console.log('Demo 8 总结:')
  console.log('  • 上下文窗口是 LLM 的核心限制之一')
  console.log('  • 裁剪策略：移除早期消息，保留最近对话')
  console.log('  • 摘要策略：将早期对话压缩为摘要')
  console.log('  • Pi Agent 使用 compaction 机制自动管理上下文')
  console.log('  • 实际项目中应使用 tiktoken 精确计算 token')
  console.log('='.repeat(50))
}

main().catch(console.error)
