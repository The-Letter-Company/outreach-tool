import { NextResponse } from 'next/server'

interface BlogFetchResult {
  postTitle?: string
  excerpt?: string
  date?: string
  error?: boolean
}

export async function POST(request: Request): Promise<NextResponse<BlogFetchResult>> {
  let url: string

  try {
    const body = await request.json() as { url?: unknown }
    if (typeof body.url !== 'string' || !body.url) {
      return NextResponse.json({ error: true }, { status: 400 })
    }
    url = body.url
  } catch {
    return NextResponse.json({ error: true }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: true })
    }

    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const pageTitle = titleMatch ? titleMatch[1].trim() : undefined

    // Try to find article/post title: first <h1> or <h2> inside article
    const articleH1Match = html.match(/<article[^>]*>[\s\S]*?<h1[^>]*>([^<]+)<\/h1>/i)
    const articleH2Match = html.match(/<article[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/i)
    const firstH1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const firstH2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i)

    const rawPostTitle =
      (articleH1Match?.[1] ?? articleH2Match?.[1] ?? firstH1Match?.[1] ?? firstH2Match?.[1] ?? pageTitle)

    const postTitle = rawPostTitle
      ?.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim()

    // Try to extract a date from meta tags
    const dateMatch =
      html.match(/<meta[^>]+(?:property="article:published_time"|name="pubdate"|name="date")[^>]+content="([^"]+)"/i) ??
      html.match(/content="([^"]+)"[^>]+(?:property="article:published_time"|name="pubdate"|name="date")/i)

    let date: string | undefined
    if (dateMatch?.[1]) {
      try {
        const d = new Date(dateMatch[1])
        if (!isNaN(d.getTime())) {
          date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
      } catch {
        // ignore
      }
    }

    // Find first paragraph with >100 chars
    const paragraphMatches = [...html.matchAll(/<p[^>]*>([^<]{100,})<\/p>/gi)]
    const excerpt = paragraphMatches[0]?.[1]
      ?.replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .trim()

    return NextResponse.json({ postTitle, excerpt, date })
  } catch {
    return NextResponse.json({ error: true })
  }
}
