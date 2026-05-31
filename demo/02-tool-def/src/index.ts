/**
 * Demo 2: 定义和调用工具
 *
 * 目标：展示如何定义工具、注册工具、手动调用工具。
 * 这是 Agent 工具系统的基础。
 *
 * 核心知识点：
 * - 使用 TypeBox 定义工具参数 schema
 * - 工具注册机制
 * - 手动模拟 LLM 选择工具的过程
 */
import { Type } from '@sinclair/typebox'
import type { Tool } from '@tutorial/shared'

// ──────────── 1. 定义工具 ────────────

/**
 * 计算器工具
 *
 * TypeBox schema 定义：
 * - type: 'object' 表示参数是一个对象
 * - properties: 定义每个参数的名称、类型和描述
 * - required: 标记必填参数
 *
 * 这些 schema 会被传给 LLM，LLM 根据描述生成符合 schema 的参数。
 */
const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学运算（加、减、乘、除）',
  parameters: Type.Object({
    a: Type.Number({ description: '第一个数字' }),
    b: Type.Number({ description: '第二个数字' }),
    operator: Type.String({ description: '运算符: +, -, *, /' }),
  }),
  execute: (args) => {
    const { a, b, operator } = args as { a: number; b: number; operator: string }
    let result: number
    switch (operator) {
      case '+': result = a + b; break
      case '-': result = a - b; break
      case '*': result = a * b; break
      case '/':
        if (b === 0) return { content: '错误：除数不能为零', isError: true }
        result = a / b
        break
      default:
        return { content: `错误：不支持的运算符 ${operator}`, isError: true }
    }
    return { content: `${a} ${operator} ${b} = ${result}` }
  },
}

/**
 * 天气查询工具
 *
 * 这是一个 Mock 工具，模拟查询天气。
 * 在实际项目中，这里可以接入真实的天气 API。
 */
const weatherTool: Tool = {
  name: 'weather',
  description: '查询指定城市的当前天气',
  parameters: Type.Object({
    location: Type.String({ description: '城市名称，如：北京、上海' }),
  }),
  execute: async (args) => {
    const { location } = args as { location: string }
    // 模拟网络延迟
    await new Promise(r => setTimeout(r, 500))
    const conditions = ['晴朗', '多云', '小雨', '阴天']
    const temp = Math.floor(Math.random() * 30) + 5
    return {
      content: `${location}天气：${conditions[Math.floor(Math.random() * conditions.length)]}，${temp}°C`,
    }
  },
}

// ──────────── 2. 注册工具 ────────────

/** 工具注册表 — 简单的 Map 实现 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return Array.from(this.tools.values())
  }
}

// ──────────── 3. 模拟 LLM 工具调用 ────────────

/**
 * 模拟 LLM 根据用户输入选择工具
 *
 * 在真实场景中，LLM 会返回 tool_calls 结构，
 * 这里我们手动模拟这个过程。
 */
function simulateLLMToolSelection(
  userInput: string,
  tools: ToolRegistry,
): { toolName: string; args: Record<string, unknown> } | null {
  const input = userInput.toLowerCase()

  if (/计算|\d+\s*[+\-*/]\s*\d+/.test(input)) {
    const match = userInput.match(/(\d+)\s*([+\-*/])\s*(\d+)/)
    if (match) {
      return {
        toolName: 'calculator',
        args: { a: Number(match[1]), b: Number(match[3]), operator: match[2] },
      }
    }
  }

  if (/天气|气温/.test(input)) {
    const cityMatch = userInput.match(/(北京|上海|广州|深圳|杭州)/)
    return {
      toolName: 'weather',
      args: { location: cityMatch?.[1] || '北京' },
    }
  }

  return null
}

// ──────────── 4. 主流程 ────────────

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 2: 定义和调用工具')
  console.log('='.repeat(50))

  // 注册工具
  const registry = new ToolRegistry()
  registry.register(calculatorTool)
  registry.register(weatherTool)

  console.log('\n📋 已注册的工具:')
  for (const tool of registry.list()) {
    console.log(`   • ${tool.name}: ${tool.description}`)
  }

  // 模拟用户输入
  const userInputs = [
    '请计算 123 + 456 等于多少？',
    '北京今天天气怎么样？',
    '你好，今天有什么新闻？',
  ]

  for (const input of userInputs) {
    console.log('\n' + '-'.repeat(40))
    console.log(`👤 用户: ${input}`)

    // 模拟 LLM 选择工具
    const selection = simulateLLMToolSelection(input, registry)

    if (selection) {
      console.log(`🤖 LLM: 选择调用工具 "${selection.toolName}"`)
      console.log(`   参数: ${JSON.stringify(selection.args)}`)

      // 执行工具
      const tool = registry.get(selection.toolName)!
      const result = await tool.execute(selection.args)

      if (result.isError) {
        console.log(`❌ 工具执行失败: ${result.content}`)
      } else {
        console.log(`✅ 工具执行结果: ${result.content}`)
      }
    } else {
      console.log('🤖 LLM: 无需调用工具，直接回复')
    }
  }

  // 总结
  console.log('\n' + '='.repeat(50))
  console.log('Demo 2 总结:')
  console.log('  • 工具 = 名称 + 描述 + 参数 schema + 执行函数')
  console.log('  • TypeBox 提供类型安全的参数定义')
  console.log('  • LLM 根据用户输入选择工具并生成参数')
  console.log('  • 工具执行结果可以包含错误信息')
  console.log('='.repeat(50))
}

main().catch(console.error)
