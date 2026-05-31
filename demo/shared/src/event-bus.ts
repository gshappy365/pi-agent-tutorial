/**
 * 事件总线 — 实现发布-订阅模式
 *
 * Pi Agent 的事件系统基于此模式：Agent 运行过程中产生各种事件，
 * 外部通过 subscribe 监听，实现对 Agent 状态的实时观察。
 */

/** Agent 事件类型 */
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end' }
  | { type: 'turn_start'; turn: number }
  | { type: 'turn_end'; turn: number }
  | { type: 'message_start'; role: string }
  | { type: 'message_update'; delta: string }
  | { type: 'message_end'; role: string; content: string }
  | { type: 'tool_execution_start'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_execution_update'; toolName: string; output: string }
  | { type: 'tool_execution_end'; toolName: string; result: string }

/** 事件监听器类型 */
type Listener = (event: AgentEvent) => void | Promise<void>

/**
 * 事件总线类
 *
 * 核心设计：
 * 1. 订阅者注册监听器，按注册顺序依次执行
 * 2. 发布者 emit 事件，同步通知所有订阅者
 * 3. 支持取消订阅
 */
export class EventBus {
  private listeners: Set<Listener> = new Set()
  private history: AgentEvent[] = []

  /** 订阅事件，返回取消订阅函数 */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 发布事件 */
  emit(event: AgentEvent): void {
    this.history.push(event)
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  /** 获取事件历史 */
  getHistory(): AgentEvent[] {
    return [...this.history]
  }

  /** 清空历史 */
  clearHistory(): void {
    this.history = []
  }
}
