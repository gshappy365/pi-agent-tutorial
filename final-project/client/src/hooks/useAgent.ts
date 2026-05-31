import { useState, useRef, useCallback } from 'react'
import type { ChatMessage, ToolCallState } from '../types/agent'

const API_BASE = '/api'

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    setError(null)
    setIsLoading(true)

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])

    // 添加占位的 assistant 消息
    const assistantMsg: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'delta') {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + data.content }
              }
              return updated
            })
          }

          if (data.type === 'tool_start') {
            // 工具开始执行 — 在最新的 assistant 消息中添加 tool call
            const newToolCall: ToolCallState = {
              id: `tc_${Date.now()}`,
              toolName: data.toolName as string,
              args: data.args as Record<string, unknown>,
              isRunning: true,
            }
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                const toolCalls = [...(last.toolCalls || []), newToolCall]
                updated[updated.length - 1] = { ...last, toolCalls }
              }
              return updated
            })
          }

          if (data.type === 'tool_end') {
            // 工具执行完成 — 更新对应的 tool call 状态
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant' && last.toolCalls) {
                const toolCalls = last.toolCalls.map(tc =>
                  tc.toolName === data.toolName && tc.isRunning
                    ? { ...tc, result: data.result as string, isError: data.isError as boolean, isRunning: false }
                    : tc,
                )
                updated[updated.length - 1] = { ...last, toolCalls }
              }
              return updated
            })
          }

          if (data.type === 'error') {
            setError(data.message || '未知错误')
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  }
}
