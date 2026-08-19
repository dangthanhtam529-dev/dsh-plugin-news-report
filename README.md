# dsh-plugin-news-report

A two-package DeepSeek Harness plugin that teaches a session to produce structured news reports (morning briefing, evening wrap-up, daily digest) and backs that teaching with a runtime guard.

The plugin is intentionally split:

- `packages/skill/skill-news-report` — the model-facing skill provider. It bundles a `news-report` candidate plus its body (`assets/news-report.md`). When the user asks for a news report, the harness loads this skill and the model reads the body.
- `packages/guard/news-report-guard` — the runtime guard. It listens on `system-prompt/assemble` to inject a fresh-news time window into every turn, and on `tools/post-execute` to flag news-shaped calls routed through untrusted sources.

The skill teaches the contract. The guard backs it with events.

## What the report contract is

Every item in a news report must carry five fields:

- `title`
- `date`
- `source`
- `link`
- `body` — at least 300 characters of full coverage, not a one-line summary

Every report must be read through both lenses the user implicitly expects:

- **software-tester** — what was tested, what regressed, what shipped
- **self-media-operator** — what is the hook, what is the share-worthy framing

Every report must respect a time window: 24 hours for morning / daily, 12 hours for evening. Items outside the window must be rejected, not folded in.

## How the skill body constrains the model

The skill body (`packages/skill/skill-news-report/assets/news-report.md`) is a three-step pipeline:

```
Step 1  信息源检索  →  raw search results
Step 2  数据加工    →  structured items + lens analysis
Step 3  排版展示    →  formatted report
```

Hard rule between steps: **Step 1 failure stops the run.** Never carry dirty data into Step 2.

The skill body starts with a mandatory discovery rule (`### 1.0 工具发现顺序`):

1. Read `## Skills` in the system prompt and check `available_skills`.
2. If `tavily-search` is listed, use it (it wraps `tvly` via `Bash(tvly *)`).
3. If `mmx-cli` is listed, use it (it wraps `mmx` via `Bash(mmx *)`).
4. Only fall back to the bare `tvly` / `mmx` CLI when the corresponding skill is missing.

The reason this rule exists: the original body taught the wrong names (`tavily` and `minimax`) for what are actually two CLI binaries (`tvly` and `mmx`). Without this rule, the model has been observed running `where tavily`, finding nothing, and wrongly concluding the search tool is unavailable. The `tavily-search` and `mmx-cli` skills are the real entry points in a typical dsh deployment (they ship under `$DSH_AGENTS_HOME/skills/`, default `~/.agents/skills/`).

Step 1 then routes per subject:

- Domestic / Chinese-language sources → `mmx-cli` skill (fallback: `mmx web_search`)
- International / English sources → `tavily-search` skill (fallback: `tvly search`)
- Mixed → run both in parallel

Step 2 turns each raw result into a five-field, 300+ character body and applies both lenses. Step 3 lays the result out as a newspaper-style report.

## How the guard backs the contract at runtime

The guard is a Cordis plugin. Its `apply(ctx, config)` installs two listeners:

```ts
// 1. Time-window injection — fires on every system-prompt assembly.
ctx.on('system-prompt/assemble', (assembly, _ctx, next) => {
  const now = new Date()
  const morningTo = new Date(now.getTime() - windowHours * 3_600_000)
  const eveningTo = new Date(now.getTime() - eveningWindowHours * 3_600_000)
  assembly.contexts.push({
    name: 'news-report-time-window',
    text: `[news-report-guard] now=${formatLocal(now)}\n` +
          `morning/daily window: ${formatLocal(morningTo)} → ${formatLocal(now)}\n` +
          `evening window: ${formatLocal(eveningTo)} → ${formatLocal(now)}\n` +
          'Reject any news item whose timestamp falls outside the window.',
  })
  return next()
})

// 2. Source routing — fires after every tool call.
ctx.on('tools/post-execute', async (exec, _result, next) => {
  const reminder = sourceRouteReminder(exec) // checks exec.name
  const downstream = await next()
  // prepends an advisory reminder if the tool is not minimax/tavily
  return downstream
})
```

Both listeners are passive by default:

- The time-window injection is always active and visible. Every system prompt the model sees during a news-report session contains a `news-report-time-window` context entry with the current clock and the rolling 24h/12h windows. This is what stops the model from drifting outside the freshness contract.
- The source-routing reminder is dormant on a stock dsh deployment. The whitelist is `minimax` / `tavily` (CLI tool names); neither ships in upstream, and the actual search entry points (`tavily-search`, `mmx-cli`) reach the model through `Bash`, whose `exec.name` is `bash` — which does not match the regex `/search|fetch|extract/i` and does not match the whitelist. So the reminder never fires on the typical workflow.

The guard also exports `NEWS_REPORT_GUARD_FAIL` for retry policies that want to treat a hard guard failure as a retryable condition.

## How the two halves fit together

The skill body and the guard are not redundant — they enforce different layers of the same contract:

| Concern | Where enforced |
|---|---|
| Three-step pipeline (search → process → format) | skill body |
| Five-field-per-item, 300+ char body, two-lens analysis | skill body |
| Discover skills before reaching for CLI binaries | skill body `1.0 工具发现顺序` |
| Current time + 24h/12h rolling window in context | guard `system-prompt/assemble` |
| "Don't use untrusted news sources" advisory | guard `tools/post-execute` |
| Retryable failure code for hard guard hits | guard `NEWS_REPORT_GUARD_FAIL` |

The skill body teaches. The guard reminds.

## Configuration

The guard accepts three options (all defaulted by `z.object`):

```ts
{
  windowHours: 24,          // morning / daily window
  eveningWindowHours: 12,   // evening window
  injectTimeContext: true,  // whether to inject the time-window context
}
```

Invalid values throw fail-loud at plugin load. The skill provider takes no configuration.

## Defaults

Both packages are registered as `disabled: true` in the base bundle, matching the upstream convention for opt-in capabilities (the same as `repeat-tool-reminder`, `skill-badge`, etc.). Users opt in by overriding the `disabled` flag in their profile's `cordis.patch.yml` or via the web UI's Settings → Plugins panel.

## Install

See `INSTALL.md` for the three base-bundle patches and the steps to enable the plugins.