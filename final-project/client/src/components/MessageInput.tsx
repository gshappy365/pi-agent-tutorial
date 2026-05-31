import { useState, useRef, useEffect } from 'react'

interface MessageInputProps {
  onSend: (text: string) => void
  isLoading: boolean
}

export function MessageInput({ onSend, isLoading }: MessageInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="message-input-container">
      <textarea
        ref={inputRef}
        className="message-input"
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        disabled={isLoading}
      />
      <button
        className="send-button"
        onClick={handleSubmit}
        disabled={!text.trim() || isLoading}
      >
        {isLoading ? '⏳' : '发送'}
      </button>
    </div>
  )
}
