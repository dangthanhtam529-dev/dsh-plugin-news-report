# @deepseek-ai/dsh-news-report-guard

English | [中文](README.zh.md)

Runtime guard that backs the `news-report` skill with structural enforcement. The skill teaches the model **how** to write a news report; this guard ensures the report **does** follow the contract:

1. **Source routing** — domestic news queries must use `mcp__minimax__*`, international queries must use `mcp__tavily__*`. Other sources inject a `tools/post-execute` reminder.
2. **24h time window** — the current system time and the rolling window boundary are injected into every `system-prompt/assemble` so the model cannot drift outside the freshness contract.
3. **Failure code surface** — `NEWS_REPORT_GUARD_FAIL` is exported so providers can register it on the LLM retry policy.

Mount the plugin to enable enforcement. It has no configuration of its own; the shipped CLI composition includes the plugin as `disabled: true`; users must explicitly enable its `news-report-guard` row.

## Config

Defaults are fail-loud. None of these fields disable the guard at runtime; they only tune the time-window injection.

```yaml
- id: news-report-guard
  name: '@deepseek-ai/dsh-news-report-guard'
  config:
    windowHours: 24
    eveningWindowHours: 12
    injectTimeContext: true
```

| Key | Type | Default | Purpose |
|---|---|---|---|
| `windowHours` | integer >= 1 | 24 | Window applied to "morning" / "daily" reports. |
| `eveningWindowHours` | integer >= 1 | 12 | Window applied to "evening" reports. |
| `injectTimeContext` | boolean | true | Whether to inject the time-window context into `system-prompt/assemble`. |

Misconfiguration throws at plugin load (`windowHours` or `eveningWindowHours` < 1) — never a silent fall-back.

## Model Experience

#### What the model sees

- After every `mcp__*__web_search` call that isn't `minimax` or `tavily`, the model sees a `user` message stamped `{kind: 'plugin', plugin: 'news-report-guard', form: 'notice', summary: 'unknown source: ...'}` instructing it to switch tools.
- Every `system-prompt/assemble` cycle prepends a `news-report-time-window` context with the current system time and the morning/daily + evening window boundaries.

#### Token effect

The routing reminder rides only when a tool is mistargeted. The time-window context is small (a few lines, fixed format) and reuses a stable `order` so its KV prefix doesn't churn between turns.

#### KV Cache effect

Disabled by default. When enabled, the time-window context changes on each assembly (the timestamp is fresh), invalidating the KV prefix boundary at the `news-report-time-window` insertion point. Set `injectTimeContext: false` if you want to preserve cache for steady-state runs.

## Known Limitations and Deferred Work

- The guard is advisory: it nudges the model with `additionalContexts` and never throws on its own. Structural hard-fail requires a provider-level retry policy that recognises `NEWS_REPORT_GUARD_FAIL`.
- The guard does not validate report content (field completeness, character counts). Content validation is intentionally out of scope — the family guard convention is event-level, not content-level. Content checks live in a downstream consumer.
- Archive writes are not yet implemented inside this plugin; they belong in a host-side consumer that subscribes to `assistant/message` and writes to `~/.dsh/memory/news-archive/`.