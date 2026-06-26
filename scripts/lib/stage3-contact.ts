import { ValidatedCompany, PipelineContact, RawCompany } from '../../types/index.js'

const FETCH_TIMEOUT_MS = 8000
const RATE_LIMIT_MS = 1200

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    clearTimeout(timer)
    return null
  }
}

const TARGET_TITLES = [
  'head of content',
  'content marketing manager',
  'vp marketing',
  'vp of marketing',
  'head of marketing',
  'director of content',
  'director of marketing',
  'content lead',
  'marketing lead',
]

function matchesTargetTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return TARGET_TITLES.some((t) => lower.includes(t))
}

function titlePriority(title: string): number {
  const lower = title.toLowerCase()
  if (lower.includes('head of content') || lower.includes('content lead')) return 0
  if (lower.includes('content marketing')) return 1
  if (lower.includes('vp marketing') || lower.includes('vp of marketing')) return 2
  if (lower.includes('head of marketing') || lower.includes('director of marketing')) return 3
  return 4
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

interface ScrapedPerson {
  name: string
  title: string
}

function scrapeTeamPage(html: string): ScrapedPerson[] {
  const people: ScrapedPerson[] = []
  const seen = new Set<string>()

  // Look for schema.org Person markup
  const jsonLdMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]) as unknown
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const obj = item as Record<string, unknown>
        if (obj['@type'] === 'Person') {
          const name = typeof obj['name'] === 'string' ? obj['name'] : null
          const jobTitle = typeof obj['jobTitle'] === 'string' ? obj['jobTitle'] : null
          if (name && jobTitle && matchesTargetTitle(jobTitle) && !seen.has(name)) {
            seen.add(name)
            people.push({ name, title: jobTitle })
          }
        }
      }
    } catch {
      // malformed JSON-LD, skip
    }
  }

  if (people.length > 0) return people

  // Heuristic: find name+title pairs near each other in the DOM
  // Pattern: element with a person name followed closely by a title element
  const chunks = html.split(/<(?:div|li|article|section)[^>]*>/i)
  for (const chunk of chunks) {
    const text = stripTags(chunk)
    // Look for "Name\nTitle" or similar proximity
    const lines = text.split(/[\n\r,|·•]+/).map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 80)
    for (let i = 0; i < lines.length - 1; i++) {
      const possibleName = lines[i]
      const possibleTitle = lines[i + 1]
      // Name heuristic: 2-3 words, each capitalised
      const nameWords = possibleName.split(' ')
      const looksLikeName = nameWords.length >= 2 && nameWords.length <= 4 &&
        nameWords.every((w) => /^[A-Z]/.test(w))
      if (looksLikeName && matchesTargetTitle(possibleTitle) && !seen.has(possibleName)) {
        seen.add(possibleName)
        people.push({ name: possibleName, title: possibleTitle })
      }
    }
  }

  return people
}

export interface ContactResult {
  contact: PipelineContact | null
  note: string
}

export async function findContact(
  company: ValidatedCompany | (RawCompany & { blogUrl?: string })
): Promise<ContactResult> {
  const domain = company.domain

  // Check if CSV row pre-populated a contact
  const csvRow = company as RawCompany & {
    contactName?: string
    contactTitle?: string
    contactEmail?: string
  }
  if (csvRow.contactName && csvRow.contactTitle) {
    return {
      contact: {
        name: csvRow.contactName,
        title: csvRow.contactTitle,
        email: csvRow.contactEmail ?? null,
        confidence: csvRow.contactEmail ? 'high' : 'low',
        source: 'manual',
      },
      note: 'from CSV',
    }
  }

  const candidates: ScrapedPerson[] = []

  const teamUrls = [
    `https://${domain}/about`,
    `https://${domain}/team`,
    `https://${domain}/about-us`,
    `https://${domain}/company`,
  ]

  for (const url of teamUrls) {
    await sleep(RATE_LIMIT_MS)
    const html = await fetchWithTimeout(url)
    if (!html) continue
    const found = scrapeTeamPage(html)
    candidates.push(...found)
    if (candidates.length > 0) break
  }

  if (candidates.length === 0) {
    return { contact: null, note: 'no contact found — scraping returned nothing' }
  }

  // Pick best match by title priority
  candidates.sort((a, b) => titlePriority(a.title) - titlePriority(b.title))
  const best = candidates[0]

  return {
    contact: {
      name: best.name,
      title: best.title,
      email: null, // filled in Stage 4
      confidence: 'medium',
      source: 'scraped',
    },
    note: `scraped from /about or /team`,
  }
}
