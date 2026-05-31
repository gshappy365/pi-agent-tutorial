# 常见问题

本页整理了学习和开发过程中最常遇到的问题，按类别组织。

---

## API Key 相关

### Q: 没有 API Key 能运行吗？

**现象**：不知道去哪里获取 API Key，担心无法运行教程代码。

**原因**：教程的 Demo 和最终项目都支持 Mock 模式。

**解决方案**：

- Mock 模式不需要任何 API Key，所有 Demo 默认使用 Mock 模式
- 最终项目默认也是 Mock 模式，直接 `npm run dev` 即可运行
- 只有切换到真实 LLM 时才需要 API Key

### Q: 配置了 API Key 但请求失败

**现象**：设置了 `LLM_API_KEY` 环境变量，但请求返回 401 或类似错误。

**原因**：可能是 API Key 格式错误、过期，或者环境变量未正确传递。

**解决方案**：

```bash
# 检查环境变量是否设置
echo $LLM_API_KEY

# 确保在启动命令中正确传递
LLM_API_KEY=sk-xxx LLM_PROVIDER=openai npm run dev

# 验证 API Key 是否有效（以 OpenAI 为例）
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY"
```

### Q: 使用 Anthropic 的 API Key 调用 OpenAI

**现象**：设置了 Anthropic 的 API Key，但 `LLM_PROVIDER=openai`，请求一直报错。

**原因**：Provider 和 API Key 不匹配。

**解决方案**：

```bash
# OpenAI 使用 sk- 开头的 Key
LLM_PROVIDER=openai LLM_API_KEY=sk-xxx npm run dev

# Anthropic 使用 sk-ant- 开头的 Key
LLM_PROVIDER=anthropic LLM_API_KEY=sk-ant-xxx npm run dev
```

---

## 后端相关

### Q: 端口被占用

**现象**：启动后端时提示 `EADDRINUSE: address already in use :::3001`。

**原因**：3001 端口已被其他进程占用。

**解决方案**：

```bash
# 方式一：查找并关闭占用进程
lsof -i :3001
kill -9 <PID>

# 方式二：使用其他端口
PORT=3002 npm run dev
```

### Q: tsx 命令未找到

**现象**：运行 `npm run dev` 时提示 `command not found: tsx`。

**原因**：依赖未安装。

**解决方案**：

```bash
cd final-project/server
npm install
```

### Q: TypeScript 编译错误

**现象**：启动时出现 TypeScript 类型错误。

**原因**：Node.js 版本过低或类型定义缺失。

**解决方案**：

```bash
# 检查 Node.js 版本（需要 18+）
node --version

# 重新安装依赖
rm -rf node_modules && npm install
```

---

## 前端相关

### Q: 前端页面空白

**现象**：访问 `http://localhost:5173` 只看到白屏。

**原因**：常见原因包括：

1. 后端未启动（请求 `/api` 失败）
2. 控制台有 JavaScript 错误
3. 依赖未安装

**解决方案**：

```bash
# 1. 打开浏览器开发者工具（F12），查看 Console 面板的错误信息
# 2. 确认后端已启动
curl http://localhost:3001/api/health

# 3. 确认前端依赖已安装
cd final-project/client && ls node_modules

# 4. 如果依赖缺失，重新安装
cd final-project/client && npm install
```

### Q: 消息发送后无响应

**现象**：点击发送按钮后，消息出现在列表中但 Agent 没有回复。

**原因**：SSE 连接可能中断或后端报错。

**解决方案**：

1. 打开浏览器 Network 面板，查看 `/api/chat` 请求的状态
2. 查看后端终端输出，检查是否有报错信息
3. 确认后端已启动且运行正常

### Q: 前端请求 404

**现象**：Network 面板中看到请求 `/api/chat` 返回 404。

**原因**：Vite Proxy 配置不正确，或后端未在正确的端口启动。

**解决方案**：

```bash
# 检查 vite.config.ts 中的 proxy 配置
# 确认 target 指向后端实际端口

# 检查后端是否在运行
curl http://localhost:3001/api/health
```

---

## SSE 相关

### Q: SSE 连接断开

**现象**：Agent 回复到一半突然停止，Network 面板显示 SSE 连接断开。

**原因**：

1. 后端处理超时
2. 工具执行时间过长
3. LLM API 调用超时

**解决方案**：

```bash
# 增加 LLM API 超时时间（在 LLMProvider.ts 中）
const response = await client.chat.completions.create({
  // ...
  timeout: 60000,  // 60 秒超时
})

# 或者增加 Agent 的 maxTurns
AGENT_MAX_TURNS=20 npm run dev
```

### Q: SSE 数据格式错误

**现象**：前端收到 SSE 事件但无法解析。

**原因**：SSE 数据格式不符合规范。

**解决方案**：

检查后端输出的 SSE 格式是否正确：

```
# 正确格式
data: {"type":"delta","content":"你好"}

# 错误格式（缺少 data: 前缀）
{"type":"delta","content":"你好"}

# 错误格式（缺少空行分隔）
data: {"type":"delta","content":"你好"}data: {"type":"done","content":"..."}
```

### Q: 消息内容乱码

**现象**：中文消息显示为乱码。

**原因**：字符编码问题。

**解决方案**：

```bash
# 确保 HTML 中设置了 UTF-8
# 在 index.html 中：
<meta charset="UTF-8" />

# 确保后端响应头包含编码
res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
```

---

## CORS 相关

### Q: 跨域请求被阻止

**现象**：浏览器控制台显示 CORS 错误。

**原因**：前端直接请求了后端端口（`http://localhost:3001`），而不是通过 Vite Proxy。

**解决方案**：

```bash
# 方式一：通过 Vite Proxy 访问（推荐）
# 前端使用 /api/chat 而不是 http://localhost:3001/api/chat

# 方式二：在 useAgent.ts 中检查 API_BASE
# 确保 API_BASE = '/api' 而不是 'http://localhost:3001/api'
```

### Q: 后端 CORS 配置错误

**现象**：即使通过代理访问，仍然出现 CORS 错误。

**原因**：后端的 CORS 中间件未正确配置。

**解决方案**：

```typescript
// 在 server.ts 中
import cors from 'cors'

// 允许所有来源（开发环境）
app.use(cors())

// 或指定允许的来源（生产环境）
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-domain.com'],
}))
```

---

## 上下文管理

### Q: Agent 忘记了之前的对话内容

**现象**：对话进行几轮后，Agent 开始"失忆"，无法引用之前提到的信息。

**原因**：消息历史被截断或 Agent Loop 中没有正确维护消息历史。

**解决方案**：

检查 `AgentLoop.ts` 中的消息历史管理：

```typescript
// 确保消息历史在循环中正确累积
messages.push({ role: 'assistant', content, toolCalls })
messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, toolName: tc.name })
```

### Q: 上下文溢出

**现象**：长时间对话后，LLM 调用失败，提示 token 超出限制。

**原因**：消息历史超过了 LLM 的上下文窗口限制。

**解决方案**：

```typescript
// 在 AgentLoop 中添加上下文截断逻辑
const MAX_TOKENS = 128000  // 根据模型调整

function truncateMessages(messages: Message[]): Message[] {
  let totalTokens = 0
  const truncated = []

  // 始终保留 system 消息
  const systemMsg = messages.find(m => m.role === 'system')
  if (systemMsg) truncated.push(systemMsg)

  // 从最新的消息开始保留
  for (const msg of messages.slice().reverse()) {
    if (msg === systemMsg) continue
    totalTokens += estimateTokens(msg.content)
    if (totalTokens > MAX_TOKENS) break
    truncated.push(msg)
  }

  return truncated.reverse()
}
```

---

## 环境与依赖

### Q: npm install 失败

**现象**：安装依赖时出现各种错误。

**原因**：网络问题、Node.js 版本不兼容、npm 缓存问题。

**解决方案**：

```bash
# 清理 npm 缓存
npm cache clean --force

# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com

# 升级 Node.js 到 18+
nvm install 18
nvm use 18
```

### Q: @anthropic-ai/sdk 安装失败

**现象**：安装 Anthropic SDK 时出错。

**原因**：该包需要 Node.js 18+，且可能依赖 native 模块。

**解决方案**：

```bash
# 确认 Node.js 版本
node --version  # 需要 >= 18

# 如果不需要 Anthropic，可以移除依赖
npm uninstall @anthropic-ai/sdk
# 然后在 LLMProvider.ts 中注释掉 AnthropicProvider 相关代码
```

---

## 小结

大多数问题都可以归结为三个原因：环境配置、依赖安装、端口冲突。遇到问题时，建议按以下顺序排查：

1. 检查终端输出（后端日志）
2. 检查浏览器控制台（前端错误）
3. 检查 Network 面板（网络请求）
4. 对照本 FAQ 查找对应解决方案

## 小练习

1. 故意制造一个 CORS 错误：修改前端代码直接请求 `http://localhost:3001/api/chat`，观察错误信息
2. 模拟一个"上下文溢出"场景：持续对话直到 Agent 出错，观察错误现象
3. 尝试用错误的 API Key 启动 OpenAI Provider，观察错误提示
