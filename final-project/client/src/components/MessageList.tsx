import type { ChatMessage, ToolCallState } from '../types/agent'
import { ToolCallCard } from './ToolCallCard'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🤖</div>
        <h3>Pi Agent 教学版</h3>
        <p>输入消息开始对话，Agent 可以使用工具来帮助你。</p>
        <div className="example-questions">
          <p>试试这些问题：</p>
          <ul>
            <li>"你好！"</li>
            <li>"请计算 25 * 4 等于多少？"</li>
            <li>"北京今天天气怎么样？"</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message message-${msg.role}`}>
          <div className="message-avatar">
            {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '🔧' : '🤖'}
          </div>
          <div className="message-content">
            {msg.toolName && (
              <div className="message-tool-badge">
                {msg.isError ? '❌' : '🔧'} {msg.toolName}
              </div>
            )}
            {/* 渲染工具调用卡片 */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls-container">
                {msg.toolCalls.map((tc: ToolCallState) => (
                  <ToolCallCard
                    key={tc.id}
                    toolName={tc.toolName}
                    args={tc.args}
                    result={tc.result}
                    isError={tc.isError}
                    isRunning={tc.isRunning}
                  />
                ))}
              </div>
            )}
            <div className="message-text">
              {msg.content || (isLoading ? '思考中...' : '')}
            </div>
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.content === '' && (
        <div className="message message-assistant">
          <div className="message-avatar">🤖</div>
          <div className="message-content">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
