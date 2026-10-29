import type { Band, CheckId, CheckResult } from './types'

export const PROMPT_VERSION = 'compliance-prompt@1.4.0'
export const MODEL_VERSION = 'vision-llm-2026-08 (simulated)'

export const CHECK_LABELS: Record<CheckId, string> = {
  foreign_logo: 'Foreign logos',
  brand: 'Brand & compliance documents',
  mas: 'MAS advertising rules',
}

export const CHECK_QUESTIONS: Record<CheckId, string> = {
  foreign_logo: 'Does the design contain a logo or mark belonging to another brand or system?',
  brand: 'Does the asset contradict anything in the guideline documents the client provides?',
  mas: 'Does it breach the financial advertising rules that apply in the client’s market?',
}

export function band(score: number): Band {
  if (score >= 71) return 'pass'
  if (score >= 31) return 'review'
  return 'fail'
}

export function effectiveVerdict(c: CheckResult): Band {
  if (c.human) return c.human.verdict
  return band(c.score)
}

interface Rule {
  ref: string
  text: string
  hard: string[]
  soft: string[]
  hardReason: string
  softReason: string
}

const RULES: Record<CheckId, Rule[]> = {
  foreign_logo: [
    {
      ref: 'Logo library · third-party marks',
      text: 'Third-party logos (card schemes, app stores, partner brands) may only appear with a signed co-branding approval.',
      hard: ['visa', 'mastercard', 'apple pay', 'google pay', 'competitor', 'grabpay', 'paypal', 'amex'],
      soft: ['partner', 'co-brand', 'app store', 'badge'],
      hardReason: 'A mark matching a known third-party brand was detected in the artwork',
      softReason: 'A possible partner or third-party mark appears; confirm a co-branding approval exists',
    },
  ],
  brand: [
    {
      ref: 'Brand Guidelines v3 · §2.3 Logo usage',
      text: 'The primary logo must not be stretched, recoloured, rotated or placed on a busy background.',
      hard: ['stretched logo', 'recoloured logo', 'recolored logo', 'old logo', 'rotated logo'],
      soft: ['logo', 'busy background'],
      hardReason: 'The logo treatment contradicts the logo usage rules',
      softReason: 'The logo placement could not be confirmed against the clear-space rule',
    },
    {
      ref: 'Brand Guidelines v3 · §4.1 Typography',
      text: 'Only the corporate typefaces may be used in customer-facing material.',
      hard: ['comic sans', 'papyrus'],
      soft: ['handwritten', 'script font'],
      hardReason: 'A non-approved typeface is used',
      softReason: 'Typeface may fall outside the approved families',
    },
    {
      ref: 'Brand Guidelines v3 · §3.2 Colour palette',
      text: 'Primary surfaces use the corporate palette; neon and off-palette colours are not permitted.',
      hard: ['neon', 'off-brand colour', 'off-brand color'],
      soft: ['gradient'],
      hardReason: 'Off-palette colours are used on primary surfaces',
      softReason: 'A gradient is used; confirm it is built from palette colours',
    },
  ],
  mas: [
    {
      ref: 'MAS Guidelines on Fair Dealing / FAA-G09 · Guaranteed returns',
      text: 'An advertisement must not state or imply that returns are guaranteed unless the product is capital-guaranteed.',
      hard: ['guaranteed return', 'guaranteed returns', 'risk-free', 'risk free', 'no risk', '100% safe'],
      soft: ['secure returns', 'safe investment'],
      hardReason: 'The copy implies guaranteed or risk-free returns',
      softReason: 'Copy suggests safety of returns; check it is qualified',
    },
    {
      ref: 'MAS FAA-G09 · Balanced presentation',
      text: 'Benefits must be presented together with material risks, and superlatives must be substantiated.',
      hard: ['best rates in singapore', 'highest returns'],
      soft: ['best', 'highest', 'no.1', '#1', 'up to'],
      hardReason: 'An unsubstantiated superlative is used about returns or rates',
      softReason: 'A superlative or "up to" claim appears; it needs substantiation and a risk statement',
    },
    {
      ref: 'MAS FAA-G09 · Required disclaimers',
      text: 'Investment advertisements must carry the prescribed risk warning and have not been reviewed by MAS statement.',
      hard: [],
      soft: ['invest', 'fund', 'returns'],
      hardReason: '',
      softReason: 'Investment content detected; confirm the prescribed risk warning is present',
    },
  ],
}

const INJECTION = /(ignore|disregard|forget)\s+(all\s+|the\s+|any\s+|previous\s+|prior\s+)*(instructions|guidelines|rules|checks)|pass this|approve this|you are now|system prompt/i

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function jitter(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1))
}

function excerpt(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term)
  if (i < 0) return term
  const start = Math.max(0, i - 25)
  const end = Math.min(text.length, i + term.length + 25)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

export interface ScoringOutput {
  scores: CheckResult[]
  injectionFlag?: string
}

/**
 * Simulated model call. The extracted text is treated strictly as data:
 * it is matched against rules, never interpreted as instructions.
 */
export function scoreVersion(fileName: string, extractedText: string, seed: string): ScoringOutput {
  const evidence = `${fileName.replace(/[-_.]/g, ' ')} ${extractedText}`
  const lower = evidence.toLowerCase()
  const injectionMatch = extractedText.match(INJECTION)

  const scores: CheckResult[] = (Object.keys(RULES) as CheckId[]).map((check) => {
    for (const rule of RULES[check]) {
      const hit = rule.hard.find((t) => lower.includes(t))
      if (hit) {
        return {
          check,
          score: jitter(seed + check + 'h', 6, 26),
          reason: `${rule.hardReason}: “${excerpt(evidence, hit)}”.`,
          ruleRef: rule.ref,
          quote: rule.text,
        }
      }
    }
    for (const rule of RULES[check]) {
      const hit = rule.soft.find((t) => lower.includes(t))
      if (hit) {
        return {
          check,
          score: jitter(seed + check + 's', 38, 66),
          reason: `${rule.softReason} (found “${excerpt(evidence, hit)}”).`,
          ruleRef: rule.ref,
          quote: rule.text,
        }
      }
    }
    return {
      check,
      score: jitter(seed + check + 'p', 78, 97),
      reason: 'No conflict with the attached rules was found in the artwork or its extracted text.',
      ruleRef: RULES[check].map((r) => r.ref.split(' · ')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    }
  })

  // Guard against confident wrong answers: a failing score needs a source quote.
  for (const s of scores) {
    if (band(s.score) === 'fail' && !s.quote) {
      s.score = 45
      s.reason += ' Downgraded to "needs a human look": no source quote supports a fail.'
    }
  }

  let injectionFlag: string | undefined
  if (injectionMatch) {
    injectionFlag = `Possible prompt injection in the asset text: “${excerpt(extractedText, injectionMatch[0].toLowerCase())}”. It was treated as data and ignored.`
    const brand = scores.find((s) => s.check === 'brand')!
    if (brand.score > 60) {
      brand.score = 40
      brand.reason = 'The asset contains text that tries to instruct the reviewer or model. It was ignored as data; a human should confirm the asset.'
      brand.ruleRef = 'Platform policy · untrusted input'
    }
  }
  return { scores, injectionFlag }
}

/** Simulated provider faults: timeouts and rate limits are normal operating conditions. */
export function simulateFault(fileName: string, attempt: number): string | null {
  const lower = fileName.toLowerCase()
  if (lower.includes('timeout')) return 'Model call timed out after 30s'
  if (lower.includes('flaky') && attempt < 2) return '429 Rate limited by provider'
  if (Math.random() < 0.12) return Math.random() < 0.5 ? 'Model call timed out after 30s' : '429 Rate limited by provider'
  return null
}
