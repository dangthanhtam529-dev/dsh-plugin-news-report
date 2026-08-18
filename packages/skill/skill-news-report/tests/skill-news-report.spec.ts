import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillNewsReport from '@deepseek-ai/dsh-skill-news-report'

describe('dsh-skill-news-report', () => {
  it('registers and disposes the bundled news-report skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillNewsReport)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'news-report',
      description: 'Build a news report (morning briefing, evening wrap-up, or daily digest) by following the three-step pipeline — source search → data processing → layout. Use when the user asks for "today\'s news", a morning/evening briefing, a daily digest, a multi-domain news summary, or any task that should look like a structured newspaper-style report. Each item must carry the five required fields (title, date, source, link, full-coverage body of at least 300 characters) and be read through both the software-tester and the self-media-operator lenses.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'news-report',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('news-report')
    expect(loaded?.content).toContain('三步流水线')
    expect(loaded?.content).toContain('软件测试工程师')
    expect(loaded?.content).toContain('自媒体')
    expect(loaded?.content).toContain('5 字段')
    expect(loaded?.content).toContain('300 字')
    expect(loaded?.content).toContain('事件全貌')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })
})
