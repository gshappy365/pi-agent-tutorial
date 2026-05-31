/**
 * Demo 1: 调用 LLM API
 *
 * 目标：展示如何通过统一的 Model 接口调用不同的 LLM Provider。
 * 默认使用 Mock Provider（无需 API Key），也支持切换到 OpenAI 或 Anthropic。
 *
 * 核心知识点：
 * - Model 接口的 stream() 和 complete() 两种调用方式
 * - 流式输出 vs 一次性输出
 * - Provider 切换对上层代码透明
 */
import { createModel } from '@tutorial/shared'

async function main() {
  console.log('='.repeat(50))
  console.log('Demo 1: 调用 LLM API')
  console.log('='.repeat(50))

  // 1. 创建 Model 实例（默认使用 Mock Provider）
  //    尝试读取环境变量，如果没有配置则使用 Mock
  const provider = process.env.LLM_PROVIDER || 'mock'
  const apiKey = process.env.LLM_API_KEY || ''
  const modelId = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

  const model = createModel({
    provider: provider as 'mock' | 'openai' | 'anthropic',
    modelId,
    apiKey,
  })

  console.log(`\n📋 配置信息:`)
  console.log(`   Provider: ${model.config.provider}`)
  console.log(`   Model:    ${model.config.modelId}`)
  console.log(`   API Key:  ${apiKey ? '✓ 已配置' : '✗ 未配置（使用 Mock）'}`)

  // 2. 使用 complete() 方式调用
  console.log('\n--- complete() 调用 ---')
  const response = await model.complete([
    { role: 'system', content: '你是一个有帮助的助手。' },
    { role: 'user', content: '你好！请简单介绍一下你自己。' },
  ])
  console.log(`完整响应: ${response.content}`)

  // 3. 使用 stream() 方式调用
  console.log('\n--- stream() 调用 ---')
  let fullText = ''
  for await (const event of model.stream([
    { role: 'system', content: '你是一个有帮助的助手。' },
    { role: 'user', content: '用一句话说明什么是 AI Agent。' },
  ])) {
    if (event.type === 'text_delta') {
      fullText += event.delta
      process.stdout.write(event.delta) // 逐字输出
    }
    if (event.type === 'done') {
      console.log('\n--- 流式输出完成 ---')
    }
  }

  // 4. 总结
  console.log('\n' + '='.repeat(50))
  console.log('Demo 1 总结:')
  console.log('  • complete() 一次性返回完整结果')
  console.log('  • stream() 逐块返回，适合实时展示')
  console.log('  • 切换 Provider 只需修改配置，调用代码不变')
  console.log('  • Mock Provider 无需 API Key，方便本地开发')
  console.log('='.repeat(50))
}

main().catch(console.error)
