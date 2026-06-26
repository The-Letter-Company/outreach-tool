import dns from 'dns'
import { promisify } from 'util'
import { PipelineContact } from '../../types/index.js'

const resolveMx = promisify(dns.resolveMx)

async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain)
    return records.length > 0
  } catch {
    return false
  }
}

function buildEmailPatterns(name: string, domain: string): string[] {
  const parts = name.toLowerCase().split(/\s+/)
  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  if (!first) return []

  const patterns: string[] = [
    `${first}@${domain}`,
  ]
  if (last && last !== first) {
    patterns.push(`${first}.${last}@${domain}`)
    patterns.push(`${first[0]}.${last}@${domain}`)
    patterns.push(`${first}${last}@${domain}`)
  }
  return [...new Set(patterns)]
}

export interface EmailResult {
  contact: PipelineContact
  note: string
}

export async function resolveEmail(
  contact: PipelineContact,
  domain: string
): Promise<EmailResult> {
  // Already has an email from CSV
  if (contact.email) {
    return { contact: { ...contact, confidence: 'high' }, note: 'email from CSV' }
  }

  // Check MX records — if domain can't receive email, don't bother
  const hasMx = await hasMxRecords(domain)
  if (!hasMx) {
    return {
      contact: { ...contact, email: null, confidence: 'low' },
      note: `${domain} has no MX records`,
    }
  }

  // Construct patterns and flag as unverified
  const patterns = buildEmailPatterns(contact.name, domain)
  if (patterns.length === 0) {
    return {
      contact: { ...contact, email: null, confidence: 'low' },
      note: 'could not construct email pattern from name',
    }
  }

  // Use the most common pattern (firstname@domain) as the best guess
  const bestGuess = patterns[0]
  return {
    contact: {
      ...contact,
      email: bestGuess,
      confidence: 'low', // always low for constructed emails
    },
    note: `constructed — MX verified, email unconfirmed. Patterns: ${patterns.join(', ')}`,
  }
}
