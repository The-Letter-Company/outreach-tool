import { RawCompany, ValidatedCompany, BlogPost } from '../../types/index.js'

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

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function estimateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseDate(raw: string): Date | null {
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function extractPosts(html: string): BlogPost[] {
  const posts: BlogPost[] = []

  // Try to find article entries — look for <article> or common blog list patterns
  const articleBlocks = [...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)]
  const blocks: string[] = articleBlocks.length > 0
    ? articleBlocks.map((m) => m[1])
    : [html] // fall back to whole page

  for (const block of blocks.slice(0, 10)) {
    const h2 = block.match(/<h[123][^>]*>([^<]{5,})<\/h[123]>/i)
    const h3 = block.match(/<h[23][^>]*>([^<]{5,})<\/h[23]>/i)
    const title = decodeHtmlEntities(h2?.[1] ?? h3?.[1] ?? '')
    if (!title) continue

    // Date from time element or meta
    const timeEl = block.match(/<time[^>]+datetime="([^"]+)"/i)
    const dateRaw = timeEl?.[1] ?? null
    const date = dateRaw ? parseDate(dateRaw) : null
    const dateStr = date ? date.toISOString().slice(0, 10) : null

    // Word count estimate from paragraphs in this block
    const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    const text = paragraphs.map((m) => stripTags(m[1])).join(' ')
    const wordCount = estimateWordCount(text)

    posts.push({ title, date: dateStr, wordCountEstimate: wordCount })
  }

  return posts.slice(0, 5)
}

function scoreBlog(posts: BlogPost[], html: string): { score: number; reason: string } {
  let score = 0
  const parts: string[] = []

  const now = Date.now()
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000

  // 25 pts: at least 2 posts in last 60 days
  const recentPosts = posts.filter((p) => {
    if (!p.date) return false
    const d = parseDate(p.date)
    return d && d.getTime() >= sixtyDaysAgo
  })
  if (recentPosts.length >= 2) {
    score += 25
    parts.push('active (2+ posts in 60 days)')
  } else {
    parts.push(`low cadence (${recentPosts.length} recent post${recentPosts.length !== 1 ? 's' : ''})`)
  }

  // 25 pts: average word count > 500
  const postsWithWords = posts.filter((p) => p.wordCountEstimate > 0)
  const avgWords = postsWithWords.length > 0
    ? postsWithWords.reduce((s, p) => s + p.wordCountEstimate, 0) / postsWithWords.length
    : 0
  if (avgWords >= 500) {
    score += 25
    parts.push('longform content')
  } else if (avgWords >= 200) {
    parts.push('medium-length posts')
  } else {
    parts.push('short posts')
  }

  // 25 pts: editorial / thought leadership (not changelog or press releases)
  const lowerHtml = html.toLowerCase()
  const changelogSignals = ['changelog', 'release notes', 'version ', 'v1.', 'v2.', 'bug fix', 'patch notes']
  const editorialSignals = ['how we', 'lessons', 'why we', 'deep dive', 'case study', 'research', 'analysis', 'we built', 'we learned', 'behind the scenes']
  const changelogHits = changelogSignals.filter((s) => lowerHtml.includes(s)).length
  const editorialHits = editorialSignals.filter((s) => lowerHtml.includes(s)).length
  if (editorialHits >= 2 && changelogHits <= 1) {
    score += 25
    parts.push('editorial voice')
  } else if (changelogHits >= 3) {
    parts.push('changelog-heavy')
  } else {
    parts.push('mixed content')
  }

  // 25 pts: niche/discerning audience signals
  const nicheSignals = ['infrastructure', 'architecture', 'benchmark', 'tradeoff', 'latency', 'scalab', 'enterprise', 'compliance', 'technical debt', 'system design', 'api design', 'data model', 'observabilit', 'kubernetes', 'distributed', 'ml ', 'llm', 'cfo', 'revenue', 'arr ', 'churn', 'unit economics']
  const nicheHits = nicheSignals.filter((s) => lowerHtml.includes(s)).length
  if (nicheHits >= 3) {
    score += 25
    parts.push('niche technical or business audience')
  } else if (nicheHits >= 1) {
    parts.push('some niche signals')
  } else {
    parts.push('broad/generic audience')
  }

  return { score, reason: parts.join('; ') }
}

async function findBlogUrl(domain: string): Promise<string | null> {
  const candidates = [
    `https://${domain}/blog`,
    `https://blog.${domain}`,
    `https://${domain}/insights`,
    `https://${domain}/resources`,
  ]

  for (const url of candidates) {
    await sleep(RATE_LIMIT_MS)
    const html = await fetchWithTimeout(url)
    if (html && html.length > 500) return url
  }

  // Scrape homepage for nav links
  await sleep(RATE_LIMIT_MS)
  const homepage = await fetchWithTimeout(`https://${domain}`)
  if (homepage) {
    const navMatch = homepage.match(
      /href="([^"]*(?:blog|insights|resources|articles|posts)[^"]*)"/i
    )
    if (navMatch) {
      const href = navMatch[1]
      if (href.startsWith('http')) return href
      return `https://${domain}${href.startsWith('/') ? '' : '/'}${href}`
    }
  }

  return null
}

export interface BlogValidationResult {
  validated: ValidatedCompany[]
  skipped: string[]
}

export async function validateBlogs(companies: RawCompany[]): Promise<BlogValidationResult> {
  const validated: ValidatedCompany[] = []
  const skipped: string[] = []

  for (const company of companies) {
    console.log(`  Checking ${company.name}...`)
    await sleep(RATE_LIMIT_MS)

    // Use Apollo-supplied blog URL as first candidate if available
    const apolloBlogUrl = (company as RawCompany & { blogUrl?: string }).blogUrl ?? null
    const blogUrl = apolloBlogUrl ?? await findBlogUrl(company.domain)
    if (!blogUrl) {
      skipped.push(`${company.name}: no blog URL found`)
      continue
    }

    await sleep(RATE_LIMIT_MS)
    const html = await fetchWithTimeout(blogUrl)
    if (!html) {
      skipped.push(`${company.name}: blog URL unreachable (${blogUrl})`)
      continue
    }

    const posts = extractPosts(html)
    if (posts.length === 0) {
      skipped.push(`${company.name}: no post entries found on blog page`)
      continue
    }

    const { score, reason } = scoreBlog(posts, html)
    if (score < 40) {
      skipped.push(`${company.name}: blog score ${score}/100 — ${reason}`)
      continue
    }

    validated.push({
      ...company,
      blogUrl,
      blogScore: score,
      blogScoreReason: reason,
      recentPosts: posts,
    })
  }

  return { validated, skipped }
}
