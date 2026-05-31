/**
 * 服务器入口
 */
import { Agent } from './agent/Agent.js'
import { createServer } from './server.js'

const PORT = process.env.PORT || 3001

const provider = (process.env.LLM_PROVIDER || 'mock') as 'mock' | 'openai' | 'anthropic'

const agent = new Agent({
  provider: {
    provider,
    modelId: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
  },
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT,
  maxTurns: Number(process.env.AGENT_MAX_TURNS) || 10,
})

const app = createServer(agent)

app.listen(PORT, () => {
  console.log(`\n  🚀 Pi Agent 服务器已启动`)
  console.log(`  📡 地址: http://localhost:${PORT}`)
  console.log(`  🤖 Provider: ${provider}`)
  console.log(`  🔧 工具数: ${agent.tools.length}`)
  console.log(`  📋 API 端点:`)
  console.log(`     POST http://localhost:${PORT}/api/chat`)
  console.log(`     GET  http://localhost:${PORT}/api/health`)
  console.log(`     GET  http://localhost:${PORT}/api/tools`)
  console.log(`\n  提示: 启动前端后访问 http://localhost:5173\n`)
})
