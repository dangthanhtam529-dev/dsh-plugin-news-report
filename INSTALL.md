# Installing dsh-plugin-news-report into upstream deepseek-harness

The news-report plugin is two packages wired into the **base** bundle (so it works in both web and headless modes). To install them into a fresh upstream checkout, copy both packages and apply three diffs.

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
