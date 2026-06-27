import { getSupabase } from './supabase'
import { Prospect } from '../types'

// ── Row shapes (snake_case as stored in Postgres) ─────────────────

interface CompanyRow {
  id: string
  name: string
  domain: string
  stage: string
  raised: number
  employees: number
  blog_url: string
  blog_score: number
  blog_score_reason: string
  source: 'csv' | 'manual' | null
}

interface ContactRow {
  id: string
  company_id: string
  name: string
  email: string
  title: string
  source: 'scraped' | 'constructed' | 'manual' | null
  email_verified: boolean | null
}

interface ProspectRow {
  id: string
  company_id: string
  contact_id: string | null
  status: 'pending' | 'drafted' | 'archived'
  selected_template_id: string | null
  custom_line: string | null
  companies: CompanyRow | null
  contacts: ContactRow | null
}

// ── Row → domain mapping ──────────────────────────────────────────

function rowToProspect(row: ProspectRow): Prospect {
  const c = row.companies
  const ct = row.contacts

  const prospect: Prospect = {
    company: {
      id: c?.id ?? row.company_id,
      name: c?.name ?? '',
      domain: c?.domain ?? '',
      stage: (c?.stage ?? 'Seed') as Prospect['company']['stage'],
      raised: c?.raised ?? 0,
      employees: c?.employees ?? 0,
      blogUrl: c?.blog_url ?? '',
      blogScore: c?.blog_score ?? 0,
      blogScoreReason: c?.blog_score_reason ?? '',
    },
    contact: {
      id: ct?.id ?? '',
      companyId: row.company_id,
      name: ct?.name ?? '',
      email: ct?.email ?? '',
      title: ct?.title ?? '',
    },
    status: row.status,
    selectedTemplateId: row.selected_template_id ?? undefined,
    customLine: row.custom_line ?? undefined,
  }

  // Only attach enrichment metadata when the company has a recorded source —
  // seed rows have NULL source and intentionally render no badges.
  if (c?.source) {
    prospect.source = {
      company: c.source,
      contact: ct?.source ?? 'manual',
      emailVerified: ct?.email_verified ?? false,
    }
  }

  return prospect
}

// ── Reads ─────────────────────────────────────────────────────────

export async function getProspects(): Promise<Prospect[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('prospects')
    .select(
      `id, company_id, contact_id, status, selected_template_id, custom_line,
       companies (*),
       contacts (*)`
    )
    .order('seq', { ascending: true })

  if (error) throw new Error(`Failed to load prospects: ${error.message}`)
  return (data as unknown as ProspectRow[]).map(rowToProspect)
}

// ── Review-state mutations ────────────────────────────────────────

export interface ProspectStatePatch {
  status?: 'pending' | 'drafted' | 'archived'
  selectedTemplateId?: string | null
  customLine?: string | null
}

export async function updateProspectState(
  companyId: string,
  patch: ProspectStatePatch
): Promise<void> {
  const supabase = getSupabase()

  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = patch.status
  if (patch.selectedTemplateId !== undefined) update.selected_template_id = patch.selectedTemplateId
  if (patch.customLine !== undefined) update.custom_line = patch.customLine

  if (Object.keys(update).length === 0) return

  const { error } = await supabase.from('prospects').update(update).eq('company_id', companyId)
  if (error) throw new Error(`Failed to update prospect: ${error.message}`)
}

// ── Writes (seed + enrichment) ────────────────────────────────────

/**
 * Insert new prospects (companies + contacts + prospect rows). Idempotent:
 * upserts by primary key / domain, so re-running won't duplicate. The prospect
 * row id is derived from the company id for determinism.
 */
export async function upsertProspects(prospects: Prospect[]): Promise<void> {
  if (prospects.length === 0) return
  const supabase = getSupabase()

  const companyRows = prospects.map((p) => ({
    id: p.company.id,
    name: p.company.name,
    domain: p.company.domain,
    stage: p.company.stage,
    raised: p.company.raised,
    employees: p.company.employees,
    blog_url: p.company.blogUrl,
    blog_score: p.company.blogScore,
    blog_score_reason: p.company.blogScoreReason,
    source: p.source?.company ?? null,
  }))

  const contactRows = prospects.map((p) => ({
    id: p.contact.id,
    company_id: p.company.id,
    name: p.contact.name,
    email: p.contact.email,
    title: p.contact.title,
    source: p.source?.contact ?? null,
    email_verified: p.source?.emailVerified ?? null,
  }))

  const prospectRows = prospects.map((p) => ({
    id: `p_${p.company.id}`,
    company_id: p.company.id,
    contact_id: p.contact.id || null,
    status: p.status,
    selected_template_id: p.selectedTemplateId ?? null,
    custom_line: p.customLine ?? null,
  }))

  const companyRes = await supabase.from('companies').upsert(companyRows, { onConflict: 'id' })
  if (companyRes.error) throw new Error(`Failed to upsert companies: ${companyRes.error.message}`)

  const contactRes = await supabase.from('contacts').upsert(contactRows, { onConflict: 'id' })
  if (contactRes.error) throw new Error(`Failed to upsert contacts: ${contactRes.error.message}`)

  const prospectRes = await supabase.from('prospects').upsert(prospectRows, { onConflict: 'id' })
  if (prospectRes.error) throw new Error(`Failed to upsert prospects: ${prospectRes.error.message}`)
}

/** Domains already in the database — used to skip duplicates during enrichment. */
export async function existingDomains(): Promise<Set<string>> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('companies').select('domain')
  if (error) throw new Error(`Failed to load domains: ${error.message}`)
  return new Set((data as { domain: string }[]).map((r) => r.domain))
}
