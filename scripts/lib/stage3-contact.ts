import { ValidatedCompany, PipelineContact } from '../../types/index.js'

const RATE_LIMIT_MS = 1000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const TARGET_TITLES = [
  'Head of Content',
  'Content Marketing Manager',
  'VP of Marketing',
  'Head of Marketing',
  'Director of Content',
]

interface ApolloPerson {
  first_name?: string | null
  last_name?: string | null
  title?: string | null
  email?: string | null
  linkedin_url?: string | null
}

interface ApolloPeopleResponse {
  people?: ApolloPerson[]
}

export interface ContactResult {
  contact: PipelineContact | null
  note: string
  apolloCreditCost: number
}

export async function findContact(company: ValidatedCompany): Promise<ContactResult> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    return { contact: null, note: 'APOLLO_API_KEY not set', apolloCreditCost: 0 }
  }

  await sleep(RATE_LIMIT_MS)

  let response: Response
  try {
    response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        organization_domains: [company.domain],
        titles: TARGET_TITLES,
        per_page: 1,
      }),
    })
  } catch (err) {
    return {
      contact: null,
      note: `Apollo network error: ${err instanceof Error ? err.message : String(err)}`,
      apolloCreditCost: 0,
    }
  }

  if (response.status === 429) {
    console.log(`  Apollo rate limited for ${company.name} — waiting 60s and retrying once…`)
    await sleep(60_000)
    try {
      response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          organization_domains: [company.domain],
          titles: TARGET_TITLES,
          per_page: 1,
        }),
      })
    } catch (err) {
      return {
        contact: null,
        note: `Apollo retry failed: ${err instanceof Error ? err.message : String(err)}`,
        apolloCreditCost: 0,
      }
    }
  }

  if (!response.ok) {
    return {
      contact: null,
      note: `Apollo responded ${response.status} for ${company.domain}`,
      apolloCreditCost: 0,
    }
  }

  const data = (await response.json()) as ApolloPeopleResponse
  const people = data.people ?? []

  if (people.length === 0) {
    return { contact: null, note: 'no matching contact in Apollo', apolloCreditCost: 1 }
  }

  const person = people[0]
  const firstName = person.first_name ?? ''
  const lastName = person.last_name ?? ''
  const name = [firstName, lastName].filter(Boolean).join(' ')

  if (!name) {
    return { contact: null, note: 'Apollo returned person with no name', apolloCreditCost: 1 }
  }

  return {
    contact: {
      name,
      title: person.title ?? '',
      email: person.email ?? null,
      confidence: person.email ? 'medium' : 'low',
      source: 'scraped',
    },
    note: `found via Apollo: ${name} (${person.title ?? 'unknown title'})`,
    apolloCreditCost: 1,
  }
}
