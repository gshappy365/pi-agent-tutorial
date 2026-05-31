/**
 * Agent Loop — 最终项目版核心循环
 *
 * 实现"思考 → 行动 → 观察"的完整循环。
 * 与 EventBus 集成，支持流式事件推送。
 */
import type { ILLMProvider, Message, ToolCall } from './LLMProvider.js'
import type { ToolRegistry } from './ToolRegistry.js'
import type { EventBus, AgentEvent } from './EventBus.js'

export interface AgentLoopConfig {
  maxTurns: number
  systemPrompt: string
}

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxTurns: 10,
  systemPrompt: '你是一个有帮助的 AI 助手。你可以使用提供的工具来回答用户的问题。请根据用户需求选择合适的工具，并将工具执行结果整理成清晰的回答。',
}

export async function runAgentLoop(
  userInput: string,
  provider: ILLMProvider,
  toolRegistry: ToolRegistry,
  eventBus: EventBus,
  config: AgentLoopConfig = DEFAULT_CONFIG,
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: config.systemPrompt },
    { role: 'user', content: userInput },
  ]

  await eventBus.emit({ type: 'agent_start', input: userInput })

  let turn = 0
  let finalResponse = ''

  while (turn < config.maxTurns) {
    turn++
    await eventBus.emit({ type: 'turn_start', turn })

    // 调用 LLM
    await eventBus.emit({ type: 'llm_start', turn })
    const { content, toolCalls } = await provider.complete(messages, toolRegistry.getDefinitions())
    await eventBus.emit({ type: 'llm_end', turn, content })

    // 无工具调用 → 最终回复
    if (toolCalls.length === 0) {
      finalResponse = content
      await eventBus.emit({ type: 'message', role: 'assistant', content })
      await eventBus.emit({ type: 'turn_end', turn, final: true })
      break
    }

    // 有工具调用
    await eventBus.emit({ type: 'tool_calls', toolCalls: toolCalls.map(t => ({ name: t.name, args: t.arguments })) })

    // 将 assistant 消息加入历史
    messages.push({ role: 'assistant', content, toolCalls: toolCalls as any })

    // 执行工具
    for (const tc of toolCalls) {
      await eventBus.emit({ type: 'tool_start', toolName: tc.name, args: tc.arguments })

      const result = await toolRegistry.execute(tc)

      await eventBus.emit({
        type: 'tool_end',
        toolName: tc.name,
        result: result.content,
        isError: result.isError || false,
      })

      messages.push({
        role: 'tool',
        content: result.content,
        toolCallId: tc.id,
        toolName: tc.name,
      })
    }

    await eventBus.emit({ type: 'turn_end', turn, final: false })
  }

  if (turn >= config.maxTurns) {
    finalResponse = `⚠️ 已达到最大对话轮次限制 (${config.maxTurns})，请简化您的问题。`
    await eventBus.emit({ type: 'max_turns_reached', maxTurns: config.maxTurns })
  }

  await eventBus.emit({ type: 'agent_end', response: finalResponse })

  return finalResponse
}

/**
 * 流式版本的 Agent Loop
 * 通过 onDelta 回调实时推送文本增量
 */
export async function runAgentLoopStreaming(
  userInput: string,
  provider: ILLMProvider,
  toolRegistry: ToolRegistry,
  eventBus: EventBus,
  onDelta: (delta: string) => void,
  config: AgentLoopConfig = DEFAULT_CONFIG,
): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: config.systemPrompt },
    { role: 'user', content: userInput },
  ]

  await eventBus.emit({ type: 'agent_start', input: userInput })

  let turn = 0
  let finalResponse = ''

  while (turn < config.maxTurns) {
    turn++
    await eventBus.emit({ type: 'turn_start', turn })

    const { content, toolCalls } = await provider.stream(messages, toolRegistry.getDefinitions(), onDelta)

    if (toolCalls.length === 0) {
      finalResponse = content
      await eventBus.emit({ type: 'message', role: 'assistant', content })
      await eventBus.emit({ type: 'turn_end', turn, final: true })
      break
    }

    await eventBus.emit({ type: 'tool_calls', toolCalls: toolCalls.map(t => ({ name: t.name, args: t.arguments })) })
    messages.push({ role: 'assistant', content, toolCalls: toolCalls as any })

    for (const tc of toolCalls) {
      await eventBus.emit({ type: 'tool_start', toolName: tc.name, args: tc.arguments })
      const result = await toolRegistry.execute(tc)
      await eventBus.emit({ type: 'tool_end', toolName: tc.name, result: result.content, isError: result.isError || false })
      messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, toolName: tc.name })
    }

    await eventBus.emit({ type: 'turn_end', turn, final: false })
  }

  await eventBus.emit({ type: 'agent_end', response: finalResponse })
  return finalResponse
}
