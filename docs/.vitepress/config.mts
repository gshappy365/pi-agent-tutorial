import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'Pi Agent 原理与实现',
  description: '从零到一实现一个 AI Agent — 渐进式教程',
  lang: 'zh-CN',
  lastUpdated: true,
  cleanUrls: true,
  base: '/pi-agent-tutorial/',

  themeConfig: {
    logo: '/images/pi-logo.svg',
    siteTitle: 'Pi Agent 教程',

    nav: [
      { text: '首页', link: '/' },
      { text: '教程', link: '/01-introduction/' },
      { text: '核心原理', link: '/02-principles/' },
      { text: '基础 Demo', link: '/03-demo-basics/' },
      { text: '进阶 Demo', link: '/04-demo-advanced/' },
      { text: '最终项目', link: '/05-final-project/' },
      { text: '附录', link: '/06-appendix/' },
    ],

    sidebar: {
      '/01-introduction/': [
        {
          text: '第一章：认识 AI Agent',
          items: [
            { text: '概述', link: '/01-introduction/' },
            { text: '什么是 AI Agent', link: '/01-introduction/01-what-is-agent' },
            { text: '为什么选择 Pi Agent', link: '/01-introduction/02-why-pi' },
            { text: '核心概念预热', link: '/01-introduction/03-core-concepts' },
          ],
        },
      ],
      '/02-principles/': [
        {
          text: '第二章：Pi Agent 核心原理',
          items: [
            { text: '概述', link: '/02-principles/' },
            { text: 'LLM 统一抽象层', link: '/02-principles/01-llm-abstraction' },
            { text: 'Agent Loop', link: '/02-principles/02-agent-loop' },
            { text: '工具系统', link: '/02-principles/03-tool-system' },
            { text: '事件系统', link: '/02-principles/04-event-system' },
            { text: '整体架构总览', link: '/02-principles/05-architecture' },
          ],
        },
      ],
      '/03-demo-basics/': [
        {
          text: '第三章：基础 Demo',
          items: [
            { text: '概述', link: '/03-demo-basics/' },
            { text: '项目初始化', link: '/03-demo-basics/01-project-setup' },
            { text: 'Demo 1: 调用 LLM API', link: '/03-demo-basics/02-demo-llm-call' },
            { text: 'Demo 2: 定义和调用工具', link: '/03-demo-basics/03-demo-tool-def' },
            { text: 'Demo 3: 最简单的 Agent Loop', link: '/03-demo-basics/04-demo-agent-loop' },
            { text: 'Demo 4: 流式输出与事件分发', link: '/03-demo-basics/05-demo-stream' },
          ],
        },
      ],
      '/04-demo-advanced/': [
        {
          text: '第四章：进阶 Demo',
          items: [
            { text: '概述', link: '/04-demo-advanced/' },
            { text: 'Demo 5: 多工具协作', link: '/04-demo-advanced/01-demo-multi-tool' },
            { text: 'Demo 6: 有状态 Agent', link: '/04-demo-advanced/02-demo-state-mgmt' },
            { text: 'Demo 7: 错误处理', link: '/04-demo-advanced/03-demo-error-handling' },
            { text: 'Demo 8: 上下文管理', link: '/04-demo-advanced/04-demo-context' },
          ],
        },
      ],
      '/05-final-project/': [
        {
          text: '第五章：构建教学版 Pi Agent',
          items: [
            { text: '概述', link: '/05-final-project/' },
            { text: '架构设计', link: '/05-final-project/01-architecture' },
            { text: '后端实现', link: '/05-final-project/02-backend' },
            { text: '前端实现', link: '/05-final-project/03-frontend' },
            { text: '前后端联调', link: '/05-final-project/04-integration' },
            { text: '运行与扩展', link: '/05-final-project/05-run-and-extend' },
          ],
        },
      ],
      '/06-appendix/': [
        {
          text: '附录',
          items: [
            { text: '术语表', link: '/06-appendix/01-glossary' },
            { text: '常见问题', link: '/06-appendix/02-faq' },
            { text: '参考资源', link: '/06-appendix/03-references' },
            { text: '部署指南', link: '/06-appendix/04-deployment' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/earendil-works/pi' },
    ],

    footer: {
      message: '基于 MIT 协议开源 — 学习使用，请支持 Pi Agent 原项目',
      copyright: '教程内容基于 Pi Agent 项目设计思想',
    },

    editLink: {
      pattern: '',
      text: '',
    },

    lastUpdatedText: '最后更新',
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    outline: {
      label: '本章目录',
      level: [2, 3],
    },
  },

  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true,
    },
  },

  head: [
    ['link', { rel: 'icon', href: '/images/favicon.svg' }],
  ],

  mermaid: {
    theme: 'default',
  },
})
