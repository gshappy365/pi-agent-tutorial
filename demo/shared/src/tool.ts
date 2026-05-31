import type { TSchema } from '@sinclair/typebox'

/**
 * 工具定义 — 这是 Pi Agent 工具系统的核心类型
 *
 * Pi 使用 TypeBox 定义参数 schema 实现类型安全的工具调用。
 * 每个工具包含：名称、描述、参数定义、执行函数。
 */
export interface Tool<T extends TSchema = TSchema> {
  /** 工具名称，LLM 通过此名称选择调用哪个工具 */
  name: string
  /** 工具描述，LLM 通过描述理解工具的用途 */
  description: string
  /** 参数 schema，使用 TypeBox 定义，实现运行时校验 */
  parameters: T
  /** 执行函数，接收参数并返回结果 */
  execute: (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult
}

/** 工具执行结果 */
export interface ToolResult {
  content: string
  isError?: boolean
}

/** 工具调用请求 — LLM 返回的结构 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
