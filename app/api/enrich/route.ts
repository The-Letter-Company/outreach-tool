import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { sourceCompanies } from '@/scripts/lib/stage1-source'
import { validateBlogs } from '@/scripts/lib/stage2-blog'
import { findContact } from '@/scripts/lib/stage3-contact'
import { resolveEmail } from '@/scripts/lib/stage4-email'
import { mergeProspects } from '@/scripts/lib/merge'
import { Prospect, PipelineProgress, PipelineContact, ValidatedCompany } from '@/types'

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

function sse(event: PipelineProgress): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(): Promise<Response> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: PipelineProgress) {
        controller.enqueue(encoder.encode(sse(event)))
      }

      try {
        // Stage 1 — Apollo org search
        emit({ stage: 'sourcing', message: 'Sourcing companies from Apollo…' })
        const { companies, skipped: s1Skip } = await sourceCompanies()
        emit({
          stage: 'sourcing',
          message: `Found ${companies.length} companies (${s1Skip} filtered out)`,
          found: companies.length,
        })

        if (companies.length === 0) {
          emit({ stage: 'done', message: 'No companies returned from Apollo. Check your API key and filters.' })
          controller.close()
          return
        }

        // Stage 2 — Blog scoring
        emit({ stage: 'validating', message: `Scoring blogs for ${companies.length} companies…`, total: companies.length })
        const { validated, skipped: s2Skip } = await validateBlogs(companies)
        fs.mkdirSync(path.dirname(VALIDATED_PATH), { recursive: true })
        fs.writeFileSync(VALIDATED_PATH, JSON.stringify(validated, null, 2))
        emit({
          stage: 'validating',
          message: `${validated.length} passed (${s2Skip.length} filtered out)`,
          found: validated.length,
          total: companies.length,
        })

        if (validated.length === 0) {
          emit({ stage: 'done', message: 'No companies passed blog validation.' })
          controller.close()
          return
        }

        // Stage 3 — Apollo people search
        emit({ stage: 'contacts', message: `Finding contacts for ${validated.length} companies…`, total: validated.length })
        const withContacts: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []

        for (const company of validated) {
          const result = await findContact(company)
          withContacts.push({ company, contact: result.contact })
        }
        const foundContacts = withContacts.filter((w) => w.contact !== null).length
        emit({ stage: 'contacts', message: `${foundContacts} contacts found`, found: foundContacts, total: validated.length })

        // Stage 4 — Hunter email verify
        emit({ stage: 'emails', message: 'Verifying emails via Hunter…', total: foundContacts })
        const enriched: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []

        for (const { company, contact } of withContacts) {
          if (!contact) {
            enriched.push({ company, contact: null })
            continue
          }
          const result = await resolveEmail(contact, company.domain)
          enriched.push({ company, contact: result.contact })
        }
        const foundEmails = enriched.filter((e) => e.contact?.email).length
        emit({ stage: 'emails', message: `${foundEmails} verified`, found: foundEmails, total: foundContacts })

        // Merge
        const existing = loadProspects()
        const { prospects: merged, added, skipped: dupSkipped } = mergeProspects(existing, enriched)
        fs.writeFileSync(PROSPECTS_PATH, JSON.stringify({ prospects: merged }, null, 2))

        emit({
          stage: 'done',
          message: added > 0
            ? `${added} new prospect${added !== 1 ? 's' : ''} added to your queue (${dupSkipped} duplicate${dupSkipped !== 1 ? 's' : ''} skipped)`
            : 'No new prospects — all companies already in queue',
          found: added,
        })
      } catch (err) {
        emit({
          stage: 'error',
          message: err instanceof Error ? err.message : 'Pipeline failed',
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// Health check
export function GET() {
  return NextResponse.json({ ok: true })
}
