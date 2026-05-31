/**
 * 事件总线 — 最终项目版
 *
 * 相比 Demo 版，增加了：
 * - 泛型事件类型支持
 * - 异步监听器支持
 * - 一次性监听器
 */

export interface AgentEvent {
  type: string
  [key: string]: unknown
}

type Listener = (event: AgentEvent) => void | Promise<void>

export class EventBus {
  private listeners = new Set<Listener>()
  private onceListeners = new Set<Listener>()
  private history: AgentEvent[] = []

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  once(listener: Listener): () => void {
    this.onceListeners.add(listener)
    return () => this.onceListeners.delete(listener)
  }

  async emit(event: AgentEvent): Promise<void> {
    this.history.push(event)

    for (const listener of this.listeners) {
      await listener(event)
    }
    for (const listener of this.onceListeners) {
      this.onceListeners.delete(listener)
      await listener(event)
    }
  }

  getHistory(): AgentEvent[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }
}
