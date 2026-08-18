# @deepseek-ai/dsh-skill-news-report

English | [中文](README.zh.md)

Bundled `news-report` skill provider for DeepSeek Harness. The skill gives the model a structured three-step pipeline — information-source retrieval → data processing → layout — for producing a news report (morning briefing, evening wrap-up, or daily digest).

Mount the plugin to enable the provider. It has no configuration. The shipped CLI composition includes the plugin as `disabled: true`; users must explicitly enable its `skill-news-report` row before the skill enters a catalog.

The provider exposes its packaged `assets/` directory as the skill resource base. The `news-report.md` body contains the routing instructions and required output format.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-skill`, which renders the catalog entry and selected skill body.

#### KV Cache effect

Disabled by default, the plugin changes no request. When enabled, its catalog entry and any loaded body change the provider KV prefix at their insertion points.

## Known Limitations and Deferred Work

- The skill body enforces structure but cannot force the model to comply; callers should not treat a successful skill load as proof that the model followed every rule.
- Region routing is a model-side convention; the provider does not intercept tool calls or retry on the model's behalf.
- Archiving is delegated to the model's tool use (`minimax-cli`, `tavily`, and host file tools), not implemented inside this package.