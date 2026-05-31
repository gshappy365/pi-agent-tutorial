import { useAgent } from '../hooks/useAgent'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface ChatPanelProps {
  title?: string
}

export function ChatPanel({ title = 'Pi Agent' }: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useAgent()

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h1>{title}</h1>
        <div className="chat-header-actions">
          <span className="status-dot" data-active={isLoading}>
            {isLoading ? '处理中' : '就绪'}
          </span>
          {messages.length > 0 && (
            <button className="clear-button" onClick={clearMessages}>
              清空对话
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {error && (
        <div className="chat-error">
          ❌ {error}
        </div>
      )}

      <div className="chat-input-area">
        <MessageInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  )
}
