/**
 * News-report runtime guard.
 *
 * Enforces two runtime guarantees for news-report skill outputs that markdown
 * instructions alone cannot guarantee:
 *
 * 1. **Source routing** — domestic news searches must use `mcp__minimax__*`,
 *    international searches must use `mcp__tavily__*`. Other routes inject a
 *    `tools/post-execute` reminder (advisory, not blocking).
 *
 * 2. **24h time window** — injects the current system time and the 24h
 *    window boundaries into every `system-prompt/assemble` so the model
 *    cannot drift outside the freshness contract.
 *
 * 3. **Failure code surface** — `NEWS_REPORT_GUARD_FAIL` is exported so
 *    providers can register it on the LLM retry policy.
 *
 * The guard is advisory by design: it nudges the model with structured
 * `additionalContexts` and never throws on its own. The user must opt into
 * hard enforcement via a stricter provider retry policy.
 *
 * Family notes: mirrors `repeat-tool-reminder` (advisory-only, fold reminders
 * onto `PostToolDecision`) and `timeout-policy` (export a failure code for
 * the retry policy to recognise). Field-level validation is intentionally
 * out of scope — the family guard convention is event-level, not content-level.
 *
 * @module @deepseek-ai/dsh-news-report-guard
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { MessageSource, UserMessage } from '@deepseek-ai/dsh-llm'
import type { PostToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

/** Failure code surfaced to `llm-retry`'s `retryableCodes` for hard guard failures. */
export const NEWS_REPORT_GUARD_FAIL = 'NEWS_REPORT_GUARD_FAIL'

/** Cordis plugin name. */
export const name = 'news-report-guard'

/** MCP server name conventions. */
const MINIMAX_PREFIX = 'mcp__minimax__'
const TAVILY_PREFIX = 'mcp__tavily__'

/** A tool name is a recognised news source if it lives under the minimax MCP server. */
function isMinimaxTool(name: string): boolean {
  return name.startsWith(MINIMAX_PREFIX)
}

/** A tool name is a recognised news source if it lives under the tavily MCP server. */
function isTavilyTool(name: string): boolean {
  return name.startsWith(TAVILY_PREFIX)
}

/** A tool is a "news search" call if it lives under minimax or tavily and matches search/fetch/extract. */
function isNewsSearchTool(name: string): boolean {
  if (!isMinimaxTool(name) && !isTavilyTool(name)) return false
  const tail = name.slice(name.indexOf('__', 4) + 2)
  return tail.includes('search') || tail.includes('fetch') || tail.includes('extract')
}

/** The `{kind:'plugin'}` source stamped on every reminder this guard injects. */
const PLUGIN_SOURCE: MessageSource = { kind: 'plugin', plugin: 'news-report-guard' }

/**
 * Plugin config. Defaults are fail-loud; the guard never silently disables
 * itself at runtime.
 */
export interface Config {
  /** Window hours applied to "morning" / "daily" reports. */
  windowHours?: number
  /** Window hours applied to "evening" reports. */
  eveningWindowHours?: number
  /** Whether to inject the current system time into system-prompt/assemble. */
  injectTimeContext?: boolean
}

export const Config: z<Config> = z.object({
  windowHours: z.number().default(24),
  eveningWindowHours: z.number().default(12),
  injectTimeContext: z.boolean().default(true),
})

/** Format an ISO date as `YYYY-MM-DD HH:MM` in the local timezone. */
function formatLocal(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A reminder produced by the source-routing hook. */
function sourceRouteReminder(exec: ToolExecution): UserMessage | undefined {
  if (!isNewsSearchTool(exec.name)) return undefined
  if (isMinimaxTool(exec.name)) return undefined
  if (isTavilyTool(exec.name)) return undefined
  return createUserMessage({
    content: [{
      type: 'text',
      text:
        `news-report guard: tool "${exec.name}" is not a recognised news source.\n`
        + '- Domestic news → use `mcp__minimax__web_search`.\n'
        + '- International news → use `mcp__tavily__tavily_search`.\n'
        + 'Other sources cannot be trusted for the news-report freshness contract.',
    }],
    source: { ...PLUGIN_SOURCE, form: 'notice', summary: `unknown source: ${exec.name}` },
  })
}

/** Prepend a reminder while preserving every downstream context's source. */
function prependContext(ours: UserMessage, theirs: UserMessage[] | undefined): UserMessage[] {
  return [ours, ...theirs ?? []]
}

/**
 * Install the guard's listeners.
 * @param ctx - plugin context; listeners are scoped to it and disposed with it.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  // Validate config first so missing fields are filled with their schemastery
  // defaults before we cast the values to non-nullable types below.
  const validated = Config(config)
  const windowHours = validated.windowHours as number
  const eveningWindowHours = validated.eveningWindowHours as number
  const injectTimeContext = validated.injectTimeContext as boolean

  if (!Number.isInteger(windowHours) || windowHours < 1) {
    throw new Error(`news-report-guard: invalid windowHours ${windowHours} — must be integer >= 1`)
  }
  if (!Number.isInteger(eveningWindowHours) || eveningWindowHours < 1) {
    throw new Error(`news-report-guard: invalid eveningWindowHours ${eveningWindowHours} — must be integer >= 1`)
  }

  // Source routing — same waterfall shape as `repeat-tool-reminder`. Counts
  // nothing, blocks nothing; injects a reminder if the tool isn't minimax or
  // tavily. Delegates so downstream listeners can still veto the call.
  ctx.on('tools/post-execute', async (exec, _result, next): Promise<PostToolDecision> => {
    const reminder = sourceRouteReminder(exec)
    const downstream = await next()
    if (!reminder) return downstream
    if (downstream.kind === 'block') {
      return { kind: 'block', feedback: downstream.feedback, additionalContexts: prependContext(reminder, downstream.additionalContexts) }
    }
    return {
      ...downstream,
      additionalContexts: prependContext(reminder, downstream.additionalContexts),
    }
  })

  // Time-window injection — adds a `news-report-time-window` context entry
  // every time the system prompt is assembled so the model cannot drift
  // outside the freshness contract.
  if (injectTimeContext) {
    ctx.on('system-prompt/assemble', (assembly, _context, next) => {
      const now = new Date()
      const morningTo = new Date(now.getTime() - windowHours * 3_600_000)
      const eveningTo = new Date(now.getTime() - eveningWindowHours * 3_600_000)
      const windowText =
        `[news-report-guard] now=${formatLocal(now)}\n`
        + `morning/daily window: ${formatLocal(morningTo)} → ${formatLocal(now)} (past ${windowHours}h)\n`
        + `evening window: ${formatLocal(eveningTo)} → ${formatLocal(now)} (past ${eveningWindowHours}h)\n`
        + 'Reject any news item whose timestamp falls outside the window.'
      assembly.contexts.push({
        name: 'news-report-time-window',
        text: windowText,
      })
      return next()
    })
  }
}
