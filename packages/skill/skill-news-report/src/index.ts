/**
 * Bundled `news-report` skill provider.
 *
 * @module @deepseek-ai/dsh-skill-news-report
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'

const PROVIDER_NAME = 'news-report'
const SKILL_BODY_URL = new URL('../assets/news-report.md', import.meta.url)
const RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('../assets/', import.meta.url)),
} as const
const INVOCATION = { modelInvocable: true, userInvocable: true } as const
const DESCRIPTION = 'Build a news report (morning briefing, evening wrap-up, or daily digest) by following the three-step pipeline — source search → data processing → layout. Use when the user asks for "today\'s news", a morning/evening briefing, a daily digest, a multi-domain news summary, or any task that should look like a structured newspaper-style report. Each item must carry the five required fields (title, date, source, link, body) and be read through both the software-tester and the self-media-operator lenses.'
const CANDIDATE: SkillCandidate = {
  name: 'news-report',
  description: DESCRIPTION,
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: RESOURCE_BASE,
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_BODY_URL,
}

const provider: SkillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get(_candidate): Promise<SkillDefinition> {
    return {
      name: CANDIDATE.name,
      description: CANDIDATE.description,
      invocation: CANDIDATE.invocation,
      provider: CANDIDATE.provider,
      source: CANDIDATE.source,
      resourceBase: RESOURCE_BASE,
      content: await readFile(SKILL_BODY_URL, 'utf8'),
    }
  },
}

/** Cordis plugin name. */
export const name = 'skill-news-report'
/** Service required by the bundled provider. */
export const inject = ['skills']

/** Register the bundled `news-report` provider on `ctx.skills`. */
export function apply(ctx: Context): void {
  ctx.skills.registerProvider(() => provider)
}
