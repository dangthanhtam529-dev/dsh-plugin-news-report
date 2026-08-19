# Installing dsh-plugin-news-report into upstream deepseek-harness

The news-report plugin is two packages wired into the **base** bundle (so it works in both web and headless modes). To install them into a fresh upstream checkout, copy both packages and apply three diffs.

> **Status of `patch/*` diffs:** these diffs are a snapshot of the integration applied against the upstream tree as of this export. They become stale whenever upstream reorders `cordis.patch.yml`, the base `package.json`, or `tsconfig.host.json`. When the diffs stop applying, regenerate them against a fresh upstream checkout using `git diff` (see `Sync with upstream` in `README.md`), then re-apply.

## 1. Copy the packages

```bash
cp -r dsh-plugin-news-report/packages/skill/skill-news-report packages/skill/skill-news-report
cp -r dsh-plugin-news-report/packages/guard/news-report-guard packages/guard/news-report-guard
```

## 2. Apply the base-bundle patches

From the upstream repo root:

```bash
git apply dsh-plugin-news-report/patch/bundle-base-cordis.patch.yml.diff
git apply dsh-plugin-news-report/patch/bundle-base-package.json.diff
git apply dsh-plugin-news-report/patch/tsconfig.host.json.diff
```

These patches add `skill-news-report` and `news-report-guard` to the **base** bundle's `cordis.patch.yml`, declare both `workspace:^` dependencies in `packages/bundle/base/package.json`, and add the two `references` entries in `tsconfig.host.json`.

The skill is added under the skill section; the guard is added under the guard/invariant section.

If upstream has moved lines around, fall back to `--3way`:

```bash
git apply --3way dsh-plugin-news-report/patch/bundle-base-cordis.patch.yml.diff
```

## 3. Install and verify

```bash
pnpm install
pnpm exec tsc -b tsconfig.host.json
```

## 4. Enable the plugin

Both packages are registered as `disabled: true` (default). To enable:

```yaml
# your overlay cordis.patch.yml
- id: skill-news-report
  disabled: false
- id: news-report-guard
  disabled: false
```

Or enable from the **Settings → Plugins** panel in the web app once the build is running.

A minimal runnable leaf is also available at `examples/news-report/cordis.yml` in the upstream tree (after copying this plugin); it enables both plugins on the bare skill service.

## 5. Required tool availability — read this before enabling the guard

The news-report guard's source-routing hook only recognises two tool names as trusted news sources:

- `minimax` — domestic news (Chinese-language sources)
- `tavily` — international news

Neither tool ships in the upstream tree today (`grep -r "dsh-tool-minimax\|dsh-tool-tavily" packages` returns nothing). **Enabling the guard without one of these tools mounted will cause the guard to inject an advisory reminder on every news-shaped tool call** (any tool whose name matches `/search|fetch|extract/i`). This is advisory-only — the call still runs — but it adds noise to the model context and inflates token usage.

In typical dsh deployments the real news-search entry points are **skills**, not CLI tools with those exact names:

- `tavily-search` (skill) wraps the `tvly` CLI (`Bash(tvly *)`)
- `mmx-cli` (skill) wraps the `mmx` CLI (`Bash(mmx *)`)

Both ship in `$DSH_AGENTS_HOME/skills/` (default `~/.agents/skills/`). When the model loads either skill, the actual `ToolExecution.name` becomes `bash` (the skill uses a Bash tool call), not `tavily` or `minimax`. The guard therefore never misfires on the typical workflow — its `looksLikeNewsSearch` regex (`/search|fetch|extract/i`) does not match `bash`, and its `isRecognisedNewsTool` whitelist (`minimax` / `tavily`) does not match any tool name actually produced by the skill wrappers. **In practice the guard's source-routing reminder is dormant on a stock dsh deployment**; only the `system-prompt/assemble` window injection remains visible.

Three options:

1. **Leave the guard disabled** and rely solely on the skill body (`skill-news-report`'s `assets/news-report.md`) to teach the model the routing contract. The skill body alone is what the model sees; the guard exists to back that contract with structured reminders and a retryable failure code.
2. **Ship a thin dsh tool package** registered under the names `tavily` and `minimax` that wraps `tvly` and `mmx` respectively. The guard then treats them as known sources. (Not shipped upstream yet.)
3. **Keep the guard enabled and accept the advisory-only dormant behaviour.** The model still gets the 24h/12h time-window context on every system-prompt assembly, and `NEWS_REPORT_GUARD_FAIL` is exported for retry policies.

The bundled CLI composition defaults to `disabled: true` for both packages. Users opt in.

## 6. Skill body: Step 1.0 tool discovery order

The skill body in `packages/skill/skill-news-report/assets/news-report.md` was amended post-integration to add a mandatory `### 1.0 工具发现顺序` section before `Step 1 信息源检索`. The rule forces the model to read `available_skills` before reaching for CLI binaries — without this rule the model has been observed running `where tavily`, finding no match (the real binary is `tvly`), and incorrectly concluding the search tool is unavailable.

Rationale: the original wording taught the wrong names (`minimax` and `tavily`) for what are actually two CLI binaries (`mmx` and `tvly`). The skills already present in `$DSH_AGENTS_HOME/skills/` are the correct entry points. The skill body now names them explicitly.

## Updating when upstream moves

```bash
# in upstream harness checkout
git fetch upstream
git rebase upstream/master
cp -r packages/skill/skill-news-report/. /path/to/dsh-plugin-news-report/packages/skill/skill-news-report/
cp -r packages/guard/news-report-guard/. /path/to/dsh-plugin-news-report/packages/guard/news-report-guard/
```

If upstream has changed the base bundle wiring, regenerate the three diffs:

```bash
git diff upstream/master -- packages/bundle/base/cordis.patch.yml packages/bundle/base/package.json \
  > /tmp/news-bundle.diff
git diff upstream/master -- tsconfig.host.json \
  | grep -E "news-report|skill-news-report|^[+-]{3}|^@@" > /tmp/news-tsconfig.diff
```