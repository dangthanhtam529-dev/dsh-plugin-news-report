# @deepseek-ai/dsh-skill-news-report

[English](README.md) | 中文

为 DeepSeek Harness 提供内置的 `news-report` skill（技能）。该 skill 为模型提供结构化的三步流水线 —— 信息源检索 → 数据加工 → 排版展示 —— 用于生成新闻报（早报 / 晚报 / 日报）。

挂载该插件即可启用提供方。它没有配置。随附的 CLI 组合以 `disabled: true` 包含该插件；用户必须显式启用其 `skill-news-report` 配置行，该 skill 才会进入目录。

该提供方将随包分发的 `assets/` 目录作为 skill 资源基底公开。`news-report.md` 是技能正文，包含路由指令与必填的输出格式。

## 模型体验

通过 `@deepseek-ai/dsh-tool-skill` 间接影响模型；该包会渲染目录条目和所选 skill 的正文。

#### KV Cache 影响

该插件默认禁用，不会改变任何请求。启用后，其目录条目和任何已加载正文都会在各自插入点改变提供方的 KV 前缀。

## 已知限制与暂缓事项

- 技能正文约束的是结构，而非模型行为；调用方不应把"skill 成功加载"等同于"模型严格遵守"。
- 地域分流是模型侧的约定，提供方不拦截工具调用，也不代理重试。
- 归档由模型侧的工具调用完成（`minimax-cli`、`tavily` 以及宿主文件工具），本包不内置。