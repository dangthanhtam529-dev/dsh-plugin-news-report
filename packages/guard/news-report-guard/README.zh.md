# @deepseek-ai/dsh-news-report-guard

[English](README.md) | 中文

为 `news-report` skill 提供运行时强制保障的 guard。Skill 教会模型**怎么**写新闻报；本 guard 保证报告**确实**遵守契约：

1. **数据源路由** — 国内查询必须用 `minimax` CLI，国际查询必须用 `tavily` CLI。其它看上去像 search/fetch/extract 的工具调用会在 `tools/post-execute` 注入提醒。
2. **时间窗** — 当前系统时间与滚动 24h / 12h 时间窗边界注入到每次 `system-prompt/assemble`，模型无法漂出时效契约。
3. **失败码接口** — 导出 `NEWS_REPORT_GUARD_FAIL`，供 provider 在 LLM 重试策略中注册。

挂载该插件即可启用强制。它自身没有配置。随附的 CLI 组合以 `disabled: true` 包含该插件；用户必须显式启用其 `news-report-guard` 配置行。

## 配置

默认是 fail-loud。这些字段都不会在运行时静默关闭 guard，只调节时间窗注入。

```yaml
- id: news-report-guard
  name: '@deepseek-ai/dsh-news-report-guard'
  config:
    windowHours: 24
    eveningWindowHours: 12
    injectTimeContext: true
```

| 键 | 类型 | 默认 | 用途 |
|---|---|---|---|
| `windowHours` | integer >= 1 | 24 | 用于「早报 / 日报」的时间窗。 |
| `eveningWindowHours` | integer >= 1 | 12 | 用于「晚报」的时间窗。 |
| `injectTimeContext` | boolean | true | 是否在 `system-prompt/assemble` 注入时间窗上下文。 |

错误配置在插件加载时抛出（`windowHours` 或 `eveningWindowHours` < 1），不会静默回退。

## 模型体验

#### 模型看到什么

- 每次不是 `minimax` / `tavily` 的 search/fetch/extract 调用后，模型会看到一条 `user` 消息，打印标记 `{kind: 'plugin', plugin: 'news-report-guard', form: 'notice', summary: 'unknown source: ...'}`，提示切换 CLI 工具。
- 每次 `system-prompt/assemble` 周期会插入一个 `news-report-time-window` 上下文，包含当前系统时间和早报 / 日报 + 晚报的时间窗边界。

#### Token 效果

路由提醒仅在工具被错用时出现。时间窗上下文较小（数行固定格式）并使用稳定的插入点，跨轮 KV 前缀不抖动。

#### KV Cache 影响

默认禁用。启用后，时间窗上下文每次都会变（时间戳是新鲜的），会使 `news-report-time-window` 插入点的 KV 前缀失效。如果需要保持稳态运行的缓存，请设置 `injectTimeContext: false`。

## 已知限制与暂缓事项

- guard 是建议性的：只通过 `additionalContexts` 提示模型，本身从不抛错。硬性失败需要 provider 层的重试策略识别 `NEWS_REPORT_GUARD_FAIL`。
- guard 不验证报告内容（字段完整性、字符数）。内容验证刻意不在范围内 — 家族 guard 的约定是事件级，不是内容级。内容检查应在下游消费方实现。
- 归档写入尚未在本插件内实现；应放在 host 侧订阅 `assistant/message` 并写入 `~/.dsh/memory/news-archive/` 的消费方。