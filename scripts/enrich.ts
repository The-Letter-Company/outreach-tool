import fs from 'fs'
import path from 'path'
import { sourceCompanies } from './lib/stage1-source.js'
import { validateBlogs } from './lib/stage2-blog.js'
import { findContact } from './lib/stage3-contact.js'
import { resolveEmail } from './lib/stage4-email.js'
import { mergeProspects } from './lib/merge.js'
import { Prospect, EnrichedProspect, ValidatedCompany, PipelineContact } from '../types/index.js'

const CSV_PATH = path.join(process.cwd(), 'data', 'import.csv')
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
  console.log('\n🚀 Outreach enrichment pipeline starting...\n')
  const totalStart = Date.now()

  // ── Stage 1: Source ──────────────────────────────────────────
  console.log('── Stage 1: Source companies from CSV')
  const s1Start = Date.now()
  const { companies, skipped: s1Skipped, reason: s1Reasons } = await sourceCompanies(CSV_PATH)
  console.log(`   ✓ ${companies.length} companies loaded, ${s1Skipped} skipped (${fmt(Date.now() - s1Start)})`)
  if (s1Reasons.length > 0) {
    s1Reasons.forEach((r) => console.log(`     · ${r}`))
  }

  if (companies.length === 0) {
    console.log('\n⚠️  No companies to process. Add rows to data/import.csv and re-run.\n')
    process.exit(0)
  }

  // ── Stage 2: Blog validation ─────────────────────────────────
  console.log('\n── Stage 2: Validate blogs')
  const s2Start = Date.now()
  const { validated, skipped: s2Skipped } = await validateBlogs(companies)
  fs.writeFileSync(VALIDATED_PATH, JSON.stringify(validated, null, 2))
  console.log(`   ✓ ${validated.length} blogs validated, ${s2Skipped.length} skipped (${fmt(Date.now() - s2Start)})`)
  if (s2Skipped.length > 0) {
    s2Skipped.forEach((r) => console.log(`     · ${r}`))
  }

  if (validated.length === 0) {
    console.log('\n⚠️  No companies passed blog validation. Lower the score threshold or add better prospects to CSV.\n')
    process.exit(0)
  }

  // ── Stage 3: Find contacts ───────────────────────────────────
  console.log('\n── Stage 3: Find contacts')
  const s3Start = Date.now()
  const withContacts: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []

  for (const company of validated) {
    const result = await findContact(company)
    console.log(`   ${result.contact ? '✓' : '·'} ${company.name}: ${result.note}`)
    withContacts.push({ company, contact: result.contact })
  }
  console.log(`   ✓ Stage 3 complete (${fmt(Date.now() - s3Start)})`)

  // ── Stage 4: Resolve emails ──────────────────────────────────
  console.log('\n── Stage 4: Resolve emails')
  const s4Start = Date.now()
  const enriched: EnrichedProspect[] = []

  for (const { company, contact } of withContacts) {
    if (!contact) {
      enriched.push({ company, contact: null })
      continue
    }
    const result = await resolveEmail(contact, company.domain)
    console.log(`   ${result.contact.email ? '✓' : '·'} ${company.name}: ${result.note}`)
    enriched.push({ company, contact: result.contact })
  }
  console.log(`   ✓ Stage 4 complete (${fmt(Date.now() - s4Start)})`)

  // ── Merge ────────────────────────────────────────────────────
  console.log('\n── Merging into prospects.json')
  const existing = loadProspects()
  const merged = mergeProspects(existing, enriched)
  const added = merged.length - existing.length

  fs.writeFileSync(PROSPECTS_PATH, JSON.stringify({ prospects: merged }, null, 2))

  const totalMs = Date.now() - totalStart
  console.log(`\n✅ Done in ${fmt(totalMs)}`)
  console.log(`   ${added} new prospect${added !== 1 ? 's' : ''} added (${existing.length} existing preserved)`)
  console.log(`   Est. cost: $0.00 (free pipeline)\n`)
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err)
  process.exit(1)
})
