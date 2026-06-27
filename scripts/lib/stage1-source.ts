import fs from 'fs'
import path from 'path'
import { RawCompany, FundingStage } from '../../types/index.js'

const MAX_COMPANIES = 20
const RATE_LIMIT_MS = 1000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function mapFundingStage(raw: string | null | undefined): FundingStage | null {
  if (!raw) return null
  const lower = raw.toLowerCase().replace(/_/g, ' ')
  if (lower === 'seed') return 'Seed'
  if (lower === 'series a') return 'Series A'
  if (lower === 'series b') return 'Series B'
  if (lower === 'series c') return 'Series C'
  return null
}

interface ApolloOrg {
  name?: string | null
  primary_domain?: string | null
  estimated_num_employees?: number | null
  funding_stage?: string | null
  total_funding?: number | null
  organization_blog_url?: string | null
}

interface ApolloSearchResponse {
  organizations?: ApolloOrg[]
  pagination?: { total_entries?: number }
}

export interface SourceResult {
  companies: RawCompany[]
  skipped: number
  reason: string[]
  apolloCreditCost: number
}

export async function sourceCompanies(): Promise<SourceResult> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    return {
      companies: [],
      skipped: 0,
      reason: ['APOLLO_API_KEY not set in environment'],
      apolloCreditCost: 0,
    }
  }

  await sleep(RATE_LIMIT_MS)

  let response: Response
  try {
    response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        organization_num_employees_ranges: ['11,200'],
        funding_stage: ['seed', 'series_a', 'series_b', 'series_c'],
        minimum_funding: 5000000,
        per_page: MAX_COMPANIES,
        page: 1,
      }),
    })
  } catch (err) {
    return {
      companies: [],
      skipped: 0,
      reason: [`Apollo network error: ${err instanceof Error ? err.message : String(err)}`],
      apolloCreditCost: 0,
    }
  }

  if (response.status === 429) {
    console.log('  Apollo rate limited — waiting 60s and retrying once…')
    await sleep(60_000)
    try {
      response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          organization_num_employees_ranges: ['11,200'],
          funding_stage: ['seed', 'series_a', 'series_b', 'series_c'],
          minimum_funding: 5000000,
          per_page: MAX_COMPANIES,
          page: 1,
        }),
      })
    } catch (err) {
      return {
        companies: [],
        skipped: 0,
        reason: [`Apollo retry failed: ${err instanceof Error ? err.message : String(err)}`],
        apolloCreditCost: 0,
      }
    }
  }

  if (!response.ok) {
    return {
      companies: [],
      skipped: 0,
      reason: [`Apollo responded ${response.status}: ${response.statusText}`],
      apolloCreditCost: 0,
    }
  }

  const data = (await response.json()) as ApolloSearchResponse
  const orgs = data.organizations ?? []
  const companies: RawCompany[] = []
  const skipReasons: string[] = []

  for (const org of orgs) {
    if (!org.name || !org.primary_domain) {
      skipReasons.push('Skipped: missing name or domain')
      continue
    }
    const stage = mapFundingStage(org.funding_stage)
    if (!stage) {
      skipReasons.push(`${org.name}: unrecognised stage "${org.funding_stage}"`)
      continue
    }
    const raised = org.total_funding ?? 0
    if (raised < 5_000_000) {
      skipReasons.push(`${org.name}: raised $${raised.toLocaleString()} < $5M minimum`)
      continue
    }
    const employees = org.estimated_num_employees ?? 0
    if (employees < 11 || employees > 200) {
      skipReasons.push(`${org.name}: ${employees} employees outside 11–200 range`)
      continue
    }
    companies.push({
      name: org.name,
      domain: org.primary_domain,
      stage,
      raised,
      employees,
      source: 'csv', // 'csv' reused for Apollo-sourced to satisfy the union type
      blogUrl: org.organization_blog_url ?? undefined,
    } as RawCompany & { blogUrl?: string })
  }

  const rawPath = path.join(process.cwd(), 'data', 'pipeline', 'raw.json')
  fs.mkdirSync(path.dirname(rawPath), { recursive: true })
  fs.writeFileSync(rawPath, JSON.stringify(companies, null, 2))

  return {
    companies,
    skipped: orgs.length - companies.length,
    reason: skipReasons,
    apolloCreditCost: 1,
  }
}
