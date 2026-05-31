interface ToolCallCardProps {
  toolName: string
  args: Record<string, unknown>
  result?: string
  isError?: boolean
  isRunning?: boolean
}

export function ToolCallCard({ toolName, args, result, isError, isRunning }: ToolCallCardProps) {
  return (
    <div className={`tool-call-card ${isError ? 'tool-call-error' : ''} ${isRunning ? 'tool-call-running' : ''}`}>
      <div className="tool-call-header">
        <span className="tool-call-icon">{isError ? '❌' : isRunning ? '⏳' : '🔧'}</span>
        <span className="tool-call-name">{toolName}</span>
        <code className="tool-call-args">{JSON.stringify(args)}</code>
      </div>
      {result && (
        <div className="tool-call-result">{result}</div>
      )}
    </div>
  )
}
