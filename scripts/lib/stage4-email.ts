import { PipelineContact, ContactConfidence } from '../../types/index.js'

const RATE_LIMIT_MS = 500

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface HunterVerifierResponse {
  data?: {
    result?: string // 'valid' | 'invalid' | 'risky' | 'accept_all' | 'unknown'
    email?: string
  }
  errors?: { details: string }[]
}

interface HunterDomainSearchResponse {
  data?: {
    emails?: Array<{ value?: string }>
  }
  errors?: { details: string }[]
}

async function verifyEmail(
  email: string,
  apiKey: string
): Promise<{ confidence: ContactConfidence; valid: boolean }> {
  await sleep(RATE_LIMIT_MS)

  let response: Response
  try {
    response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`
    )
  } catch {
    return { confidence: 'low', valid: true }
  }

  if (response.status === 429) {
    console.log(`  Hunter rate limited — waiting 30s and retrying once…`)
    await sleep(30_000)
    try {
      response = await fetch(
        `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`
      )
    } catch {
      return { confidence: 'low', valid: true }
    }
  }

  if (!response.ok) return { confidence: 'low', valid: true }

  const data = (await response.json()) as HunterVerifierResponse
  const result = data.data?.result

  if (result === 'valid' || result === 'accept_all') return { confidence: 'high', valid: true }
  if (result === 'risky') return { confidence: 'medium', valid: true }
  if (result === 'invalid') return { confidence: 'low', valid: false }
  return { confidence: 'low', valid: true }
}

async function findEmailViaDomainSearch(
  domain: string,
  firstName: string,
  lastName: string,
  apiKey: string
): Promise<string | null> {
  await sleep(RATE_LIMIT_MS)

  const params = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: apiKey,
  })

  let response: Response
  try {
    response = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`)
  } catch {
    return null
  }

  if (response.status === 429) {
    console.log(`  Hunter rate limited — waiting 30s and retrying once…`)
    await sleep(30_000)
    try {
      response = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`)
    } catch {
      return null
    }
  }

  if (!response.ok) return null

  const data = (await response.json()) as HunterDomainSearchResponse
  const emails = data.data?.emails ?? []
  return emails[0]?.value ?? null
}

export interface EmailResult {
  contact: PipelineContact
  note: string
  hunterLookupCount: number
}

export async function resolveEmail(
  contact: PipelineContact,
  domain: string
): Promise<EmailResult> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    const nameParts = contact.name.toLowerCase().split(/\s+/)
    const firstName = nameParts[0] ?? ''
    const guessedEmail = firstName ? `${firstName}@${domain}` : null
    return {
      contact: { ...contact, email: guessedEmail, confidence: 'low' },
      note: 'HUNTER_API_KEY not set — email guessed from name pattern',
      hunterLookupCount: 0,
    }
  }

  const nameParts = contact.name.split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts[nameParts.length - 1] ?? ''

  // Case A — Apollo already returned an email
  if (contact.email) {
    const { confidence, valid } = await verifyEmail(contact.email, apiKey)
    if (!valid) {
      // Try Hunter domain search to find a replacement
      const hunterEmail = await findEmailViaDomainSearch(domain, firstName, lastName, apiKey)
      if (hunterEmail) {
        const { confidence: hConf, valid: hValid } = await verifyEmail(hunterEmail, apiKey)
        if (!hValid) {
          const guess = firstName ? `${firstName.toLowerCase()}@${domain}` : null
          return {
            contact: { ...contact, email: guess, confidence: 'low' },
            note: 'Apollo email invalid, Hunter email also invalid — guessed pattern',
            hunterLookupCount: 3,
          }
        }
        return {
          contact: { ...contact, email: hunterEmail, confidence: hConf },
          note: `Apollo email invalid; replaced with Hunter email (${hConf})`,
          hunterLookupCount: 3,
        }
      }
      const guess = firstName ? `${firstName.toLowerCase()}@${domain}` : null
      return {
        contact: { ...contact, email: guess, confidence: 'low' },
        note: 'Apollo email invalid, Hunter found nothing — guessed pattern',
        hunterLookupCount: 2,
      }
    }
    return {
      contact: { ...contact, confidence },
      note: `Apollo email verified via Hunter (${confidence})`,
      hunterLookupCount: 1,
    }
  }

  // Case B — No email from Apollo; try Hunter domain search
  const hunterEmail = await findEmailViaDomainSearch(domain, firstName, lastName, apiKey)
  if (hunterEmail) {
    const { confidence, valid } = await verifyEmail(hunterEmail, apiKey)
    if (!valid) {
      const guess = firstName ? `${firstName.toLowerCase()}@${domain}` : null
      return {
        contact: { ...contact, email: guess, confidence: 'low' },
        note: 'Hunter domain email invalid — guessed pattern',
        hunterLookupCount: 2,
      }
    }
    return {
      contact: { ...contact, email: hunterEmail, confidence },
      note: `Hunter domain search (${confidence})`,
      hunterLookupCount: 2,
    }
  }

  // Case C — Hunter also returned nothing; guess pattern
  const guess = firstName ? `${firstName.toLowerCase()}@${domain}` : null
  return {
    contact: { ...contact, email: guess, confidence: 'low' },
    note: 'Hunter found nothing — constructed pattern (unverified)',
    hunterLookupCount: 1,
  }
}
