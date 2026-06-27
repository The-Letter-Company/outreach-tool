import path from 'path'
import { NextResponse } from 'next/server'
import { sourceCompanies } from '@/scripts/lib/stage1-source'
import { validateBlogs } from '@/scripts/lib/stage2-blog'
import { findContact } from '@/scripts/lib/stage3-contact'
import { resolveEmail } from '@/scripts/lib/stage4-email'
import { mergeProspects } from '@/scripts/lib/merge'
import { getProspects, upsertProspects } from '@/lib/prospects-store'
import { EnrichedProspect, PipelineProgress, PipelineContact, ValidatedCompany } from '@/types'

export const dynamic = 'force-dynamic'

const CSV_PATH = path.join(process.cwd(), 'data', 'import.csv')

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
        // Stage 1
        emit({ stage: 'sourcing', message: 'Reading companies from CSV…' })
        const { companies, skipped: s1Skip } = await sourceCompanies(CSV_PATH)
        emit({
          stage: 'sourcing',
          message: `Found ${companies.length} companies (${s1Skip} skipped)`,
          found: companies.length,
        })

        if (companies.length === 0) {
          emit({ stage: 'done', message: 'No companies in CSV. Add rows to data/import.csv.' })
          controller.close()
          return
        }

        // Stage 2
        emit({ stage: 'validating', message: `Validating blogs for ${companies.length} companies…`, total: companies.length })
        const { validated, skipped: s2Skip } = await validateBlogs(companies)
        emit({
          stage: 'validating',
          message: `${validated.length} blogs passed (${s2Skip.length} skipped)`,
          found: validated.length,
          total: companies.length,
        })

        if (validated.length === 0) {
          emit({ stage: 'done', message: 'No companies passed blog validation.' })
          controller.close()
          return
        }

        // Stage 3
        emit({ stage: 'contacts', message: `Finding contacts for ${validated.length} companies…`, total: validated.length })
        const withContacts: Array<{ company: ValidatedCompany; contact: PipelineContact | null }> = []

        for (const company of validated) {
          const result = await findContact(company)
          withContacts.push({ company, contact: result.contact })
        }
        const foundContacts = withContacts.filter((w) => w.contact !== null).length
        emit({ stage: 'contacts', message: `${foundContacts} contacts found`, found: foundContacts, total: validated.length })

        // Stage 4
        emit({ stage: 'emails', message: 'Resolving email addresses…', total: withContacts.length })
        const enriched: EnrichedProspect[] = []

        for (const { company, contact } of withContacts) {
          if (!contact) {
            enriched.push({ company, contact: null })
            continue
          }
          const result = await resolveEmail(contact, company.domain)
          enriched.push({ company, contact: result.contact })
        }
        const foundEmails = enriched.filter((e) => e.contact?.email).length
        emit({ stage: 'emails', message: `${foundEmails} emails resolved`, found: foundEmails, total: withContacts.length })

        // Merge into the database (skips companies whose domain already exists)
        const existing = await getProspects()
        const merged = mergeProspects(existing, enriched)
        const newProspects = merged.slice(existing.length)
        await upsertProspects(newProspects)
        const added = newProspects.length

        emit({
          stage: 'done',
          message: added > 0
            ? `${added} new prospect${added !== 1 ? 's' : ''} added to the queue`
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
