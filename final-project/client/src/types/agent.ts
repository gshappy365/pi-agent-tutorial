/** Agent 事件类型 */
export interface AgentEvent {
  type: string
  [key: string]: unknown
}

/** 工具调用状态 */
export interface ToolCallState {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: string
  isError?: boolean
  isRunning: boolean
}

/** 聊天消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  isError?: boolean
  timestamp: number
  toolCalls?: ToolCallState[]
}

/** 工具信息 */
export interface ToolInfo {
  name: string
  description: string
}

/** SSE 事件 */
export interface SSEEvent {
  type: 'delta' | 'done' | 'error' | string
  content?: string
  message?: string
  [key: string]: unknown
}
