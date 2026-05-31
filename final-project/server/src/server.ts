/**
 * Express 服务器 — 最终项目
 *
 * 提供两个端点：
 * 1. POST /api/chat — 发送消息，通过 SSE 返回流式响应
 * 2. GET /api/health — 健康检查
 * 3. GET /api/tools — 获取可用工具列表
 */
import express from 'express'
import cors from 'cors'
import { Agent } from './agent/Agent.js'

export function createServer(agent: Agent) {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // 获取可用工具
  app.get('/api/tools', (_req, res) => {
    const tools = agent.tools.map(t => ({
      name: t.name,
      description: t.description,
    }))
    res.json({ tools })
  })

  // 聊天接口 — SSE 流式响应
  app.post('/api/chat', async (req, res) => {
    const { message } = req.body

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message 字段为必填' })
      return
    }

    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // 订阅 Agent 事件，通过 SSE 推送
    const unsubscribe = agent.subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })

    // 处理客户端断开
    req.on('close', () => {
      unsubscribe()
    })

    try {
      // 流式输出回调
      let textBuffer = ''
      const response = await agent.chat(message, (delta) => {
        textBuffer += delta
        // 每收到一段文本就推送一次
        res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
      })

      // 发送最终完整响应
      res.write(`data: ${JSON.stringify({ type: 'done', content: response })}\n\n`)
    } catch (error) {
      const errMsg = (error as Error).message
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`)
    } finally {
      res.end()
    }
  })

  return app
}
