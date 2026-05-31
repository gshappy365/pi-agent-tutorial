/**
 * 工具注册器 — 最终项目版
 *
 * 管理工具的生命周期：注册、查找、执行。
 * 支持 TypeBox schema 的参数校验。
 */
import { Type } from '@sinclair/typebox'
import type { ToolDefinition, ToolCall } from './LLMProvider.js'

export interface ToolResult {
  content: string
  isError?: boolean
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult
}

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.get(toolCall.name)
    if (!tool) {
      return { content: `错误：未找到工具 "${toolCall.name}"`, isError: true }
    }

    try {
      return await tool.execute(toolCall.arguments)
    } catch (error) {
      return { content: `错误：工具执行失败 - ${(error as Error).message}`, isError: true }
    }
  }
}

// ──────────── 内置工具 ────────────

export function createBuiltinTools(): ToolRegistry {
  const registry = new ToolRegistry()

  registry.register({
    name: 'calculator',
    description: '执行数学运算（加、减、乘、除）',
    parameters: Type.Object({
      a: Type.Number({ description: '第一个数字' }),
      b: Type.Number({ description: '第二个数字' }),
      operator: Type.String({ description: '运算符: +, -, *, /' }),
    }),
    execute: (args) => {
      const { a, b, operator } = args as { a: number; b: number; operator: string }
      const ops: Record<string, number> = { '+': a + b, '-': a - b, '*': a * b, '/': a / b }
      if (!ops[operator]) throw new Error(`不支持的运算符: ${operator}`)
      if (operator === '/' && b === 0) throw new Error('除数不能为零')
      return { content: `${a} ${operator} ${b} = ${ops[operator]}` }
    },
  })

  registry.register({
    name: 'weather',
    description: '查询指定城市的当前天气',
    parameters: Type.Object({
      location: Type.String({ description: '城市名称，如：北京、上海' }),
    }),
    execute: async (args) => {
      const { location } = args as { location: string }
      await new Promise(r => setTimeout(r, 500))
      const conditions = ['晴朗', '多云', '小雨', '阴天']
      const temp = Math.floor(Math.random() * 25) + 5
      return { content: `${location}天气：${conditions[Math.floor(Math.random() * conditions.length)]}，${temp}°C` }
    },
  })

  registry.register({
    name: 'search',
    description: '搜索网络信息',
    parameters: Type.Object({
      query: Type.String({ description: '搜索关键词' }),
    }),
    execute: async (args) => {
      const { query } = args as { query: string }
      await new Promise(r => setTimeout(r, 400))
      return { content: `关于"${query}"的搜索结果：\n1. ${query} 的相关介绍\n2. ${query} 的最新进展\n3. ${query} 的深度分析文章` }
    },
  })

  return registry
}
