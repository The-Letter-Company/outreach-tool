import fs from 'fs'
import path from 'path'
import { sourceCompanies } from './lib/stage1-source.js'
import { validateBlogs } from './lib/stage2-blog.js'
import { findContact } from './lib/stage3-contact.js'
import { resolveEmail } from './lib/stage4-email.js'
import { mergeProspects } from './lib/merge.js'
import { Prospect, ValidatedCompany, PipelineContact } from '../types/index.js'

// Load .env.local for CLI runs (Next.js does this automatically for the server)
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}

const PROSPECTS_PATH = path.join(process.cwd(), 'data', 'prospects.json')
const VALIDATED_PATH = path.join(process.cwd(), 'data', 'pipeline', 'validated.json')

function loadProspects(): Prospect[] {
  try {
    const raw = JSON.parse(fs.readFileSync(PROSPECTS_PATH, 'utf-8')) as { prospects: Prospect[] }
    return raw.prospects ?? []
  } catch {
    return []
  }
}

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

async function main() {
  const apolloKey = process.env.APOLLO_API_KEY
  const hunterKey = process.env.HUNTER_API_KEY
  const hasApollo = !!apolloKey
  const hasHunter = !!hunterKey

  console.log('\n🚀 Outreach enrichment pipeline starting…\n')
  if (!hasApollo) console.log('  ⚠  APOLLO_API_KEY not set — Stage 1 and Stage 3 will be skipped')
  if (!hasHunter) console.log('  ⚠  HUNTER_API_KEY not set — Stage 4 will use guessed patterns only')

  let totalApolloCredits = 0
  let totalHunterLookups = 0
  const totalStart = Date.now()

  // ── Stage 1: Source from Apollo ─────────────────────────────
  console.log('\n── Stage 1: Source companies from Apollo')
  console.log('   Est. cost: ~1 Apollo credit')
  const s1Start = Date.now()
  const { companies, skipped: s1Skipped, reason: s1Reasons, apolloCreditCost: s1Credits } = await sourceCompanies()
  totalApolloCredits += s1Credits
  console.log(`   ✓ ${companies.length} companies found, ${s1Skipped} skipped (${fmt(Date.now() - s1Start)})`)
  console.log(`   Actual cost: ${s1Credits} Apollo credit`)
  if (s1Reasons.length > 0) {
    s1Reasons.forEach((r) => console.log(`     · ${r}`))
  }

  if (companies.length === 0) {
    console.log('\n⚠️  No companies to process. Check your APOLLO_API_KEY and filters.\n')
    process.exit(0)
  }

  // ── Stage 2: Blog validation ─────────────────────────────────
  console.log('\n── Stage 2: Validate blogs')
  const s2Start = Date.now()
  const { validated, skipped: s2Skipped } = await validateBlogs(companies)
  fs.mkdirSync(path.dirname(VALIDATED_PATH), { recursive: true })
  fs.writeFileSync(VALIDATED_PATH, JSON.stringify(validated, null, 2))
  console.log(`   ✓ ${validated.length} blogs validated, ${s2Skipped.length} skipped (${fmt(Date.now() - s2Start)})`)
  console.log('   Cost: $0 (no API calls)')
  if (s2Skipped.length > 0) {
    s2Skipped.forEach((r) => console.log(`     · ${r}`))
  }

  if (validated.length === 0) {
    console.log('\n⚠️  No companies passed blog validation.\n')
    process.exit(0)
  }

  // ── Stage 3: Find contacts via Apollo ───────────────────────
  console.log(`\n── Stage 3: Find contacts (${validated.length} companies)`)
  console.log(`   Est. cost: ~${validated.length} Apollo credits`)
  const s3Start = Date.now()
  const withContacts: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []
  let s3Credits = 0

  for (const company of validated) {
    const result = await findContact(company)
    s3Credits += result.apolloCreditCost
    totalApolloCredits += result.apolloCreditCost
    console.log(`   ${result.contact ? '✓' : '·'} ${company.name}: ${result.note}`)
    withContacts.push({ company, contact: result.contact })
  }
  const foundContacts = withContacts.filter((w) => w.contact !== null).length
  console.log(`   ✓ ${foundContacts}/${validated.length} contacts found (${fmt(Date.now() - s3Start)})`)
  console.log(`   Actual cost: ${s3Credits} Apollo credits`)

  // ── Stage 4: Verify emails via Hunter ───────────────────────
  console.log(`\n── Stage 4: Verify emails (${foundContacts} contacts)`)
  console.log(`   Est. cost: ~${foundContacts * 2} Hunter lookups`)
  const s4Start = Date.now()
  const enriched: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []
  let s4Lookups = 0

  for (const { company, contact } of withContacts) {
    if (!contact) {
      enriched.push({ company, contact: null })
      continue
    }
    const result = await resolveEmail(contact, company.domain)
    s4Lookups += result.hunterLookupCount
    totalHunterLookups += result.hunterLookupCount
    console.log(`   ${result.contact.email ? '✓' : '·'} ${company.name}: ${result.note}`)
    enriched.push({ company, contact: result.contact })
  }
  const foundEmails = enriched.filter((e) => e.contact?.email).length
  console.log(`   ✓ ${foundEmails} emails resolved (${fmt(Date.now() - s4Start)})`)
  console.log(`   Actual cost: ${s4Lookups} Hunter lookups`)

  // ── Merge ────────────────────────────────────────────────────
  console.log('\n── Merging into prospects.json')
  const existing = loadProspects()
  const { prospects: merged, added, skipped: dupSkipped } = mergeProspects(existing, enriched)

  fs.writeFileSync(PROSPECTS_PATH, JSON.stringify({ prospects: merged }, null, 2))

  const totalMs = Date.now() - totalStart
  console.log(`\n✅ Done in ${fmt(totalMs)}`)
  console.log(`   ${added} new prospect${added !== 1 ? 's' : ''} added (${dupSkipped} duplicate${dupSkipped !== 1 ? 's' : ''} skipped)`)
  console.log(`   Total API usage: ${totalApolloCredits} Apollo credits, ${totalHunterLookups} Hunter lookups\n`)
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err)
  process.exit(1)
})
