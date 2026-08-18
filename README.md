# dsh-plugin-news-report

Mirror of the news-report plugin: `packages/skill/skill-news-report` (the news-reading skill body) + `packages/guard/news-report-guard` (the runtime guard that enforces the fresh-news + dual-audience contract).

## What's inside

```
packages/skill/skill-news-report/  ← the model-facing skill + asset
packages/guard/news-report-guard/  ← the runtime guard that enforces the contract
```

## Install

See `INSTALL.md`. Three patches are needed against the base bundle: `patch/bundle-base-cordis.patch.yml.diff`, `patch/bundle-base-package.json.diff`, and `patch/tsconfig.host.json.diff`.

## Sync with upstream

```bash
# from upstream harness checkout
cp -r packages/skill/skill-news-report/. /path/to/dsh-plugin-news-report/packages/skill/skill-news-report/
cp -r packages/guard/news-report-guard/. /path/to/dsh-plugin-news-report/packages/guard/news-report-guard/
git diff --stat
git commit -am "sync with upstream"
```

If upstream renames either package, regenerate the patch diffs.
