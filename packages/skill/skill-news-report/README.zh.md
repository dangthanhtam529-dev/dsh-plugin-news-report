# @deepseek-ai/dsh-skill-news-report

[English](README.md) | 中文

为 DeepSeek Harness 提供内置的 `news-report` skill（技能）。该 skill 的正文告诉模型一份新闻报该怎么处理才"合理"——**信息源检索 → 数据加工 → 排版展示** 三步流水线。每条新闻必须带 5 字段（标题 / 时间 / 来源 / 链接 / 主体），并从用户既有的两个读者身份出发 —— **软件测试工程师** 与 **自媒体运营** —— 各看一眼。

挂载该插件即可启用提供方。它没有配置。随附的 CLI 组合以 `disabled: true` 包含该插件；用户必须显式启用其 `skill-news-report` 配置行，该 skill 才会进入目录。

该提供方将随包分发的 `assets/` 目录作为 skill 资源基底公开。`news-report.md` 是技能正文，包含路由指令与必填的输出格式。

## 模型体验

通过 `@deepseek-ai/dsh-tool-skill` 间接影响模型；该包会渲染目录条目和所选 skill 的正文。

#### KV Cache 影响

该插件默认禁用，不会改变任何请求。启用后，其目录条目和任何已加载正文都会在各自插入点改变提供方的 KV 前缀。

## 已知限制与暂缓事项

- 技能正文约束的是结构，而非模型行为；调用方不应把"skill 成功加载"等同于"模型严格遵守"。
- 地域分流是模型侧的约定：skill 正文会指引国内事件用 `minimax` CLI、国际事件用 `tavily` CLI。提供方既不拦截工具调用，也不代理重试 —— 配套的 `news-report-guard` 运行时护栏负责源路由的提示。
- 归档由模型侧的工具调用完成（`minimax` / `tavily` CLI 以及宿主文件工具），本包不内置。