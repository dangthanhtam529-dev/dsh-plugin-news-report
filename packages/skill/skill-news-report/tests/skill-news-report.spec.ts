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
      description: 'Generate a structured news report (morning briefing, evening wrap-up, or daily digest). Use when the user asks for the day\'s news, a morning/evening briefing, a daily digest, a news summary across AI / tech / politics / business, or anything that should look like a structured newspaper-style report. Always produce the full report and never summarize it down to a single title per item.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'news-report',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('news-report')
    expect(loaded?.content).toContain('3 步流水线')
    expect(loaded?.content).toContain('150')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })
})
