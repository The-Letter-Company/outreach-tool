import { Prospect, EnrichedProspect } from '../../types/index.js'

let _idCounter = 0

function nextId(): string {
  _idCounter++
  return String(Date.now()) + String(_idCounter)
}

export function mergeProspects(
  existing: Prospect[],
  enriched: EnrichedProspect[]
): Prospect[] {
  const existingDomains = new Set(existing.map((p) => p.company.domain))
  const result = [...existing]
  let added = 0

  for (const { company, contact } of enriched) {
    if (existingDomains.has(company.domain)) continue

    const companyId = nextId()
    const contactId = nextId()

    result.push({
      company: {
        id: companyId,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
        raised: company.raised,
        employees: company.employees,
        blogUrl: company.blogUrl,
        blogScore: company.blogScore,
        blogScoreReason: company.blogScoreReason,
      },
      contact: {
        id: contactId,
        companyId,
        name: contact?.name ?? '',
        email: contact?.email ?? '',
        title: contact?.title ?? '',
      },
      status: 'pending',
      source: {
        company: company.source,
        contact: contact?.source ?? 'manual',
        emailVerified: contact?.confidence === 'high',
      },
    })

    existingDomains.add(company.domain)
    added++
  }

  return result
}
