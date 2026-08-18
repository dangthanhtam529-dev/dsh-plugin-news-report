import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as NewsReportGuard from '@deepseek-ai/dsh-news-report-guard'

describe('dsh-news-report-guard', () => {
  it('exports the expected identifiers', () => {
    expect(NewsReportGuard.name).toBe('news-report-guard')
    expect(typeof NewsReportGuard.apply).toBe('function')
    expect(NewsReportGuard.NEWS_REPORT_GUARD_FAIL).toBe('NEWS_REPORT_GUARD_FAIL')
    expect(NewsReportGuard.Config).toBeDefined()
  })

  it('throws fail-loud on invalid windowHours', () => {
    const ctx = new Context()
    expect(() => NewsReportGuard.apply(ctx, { windowHours: 0 })).toThrow(/windowHours/)
  })

  it('throws fail-loud on invalid eveningWindowHours', () => {
    const ctx = new Context()
    expect(() => NewsReportGuard.apply(ctx, { eveningWindowHours: 0 })).toThrow(/eveningWindowHours/)
  })

  it('applies with default config and registers listeners', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(NewsReportGuard, {})
    expect(fiber).toBeDefined()
    await fiber.dispose()
  })
})
