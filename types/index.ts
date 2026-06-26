export interface Company {
  id: string
  name: string
  domain: string
  stage: 'Seed' | 'Series A' | 'Series B' | 'Series C'
  raised: number
  employees: number
  blogUrl: string
  blogScore: number
  blogScoreReason: string
}

export interface Contact {
  id: string
  companyId: string
  name: string
  email: string
  title: string
}

export interface Prospect {
  company: Company
  contact: Contact
  status: 'pending' | 'drafted' | 'archived'
  selectedTemplateId?: string
  customLine?: string
  // enrichment metadata
  source?: ProspectSource
}

export interface ProspectSource {
  company: 'csv' | 'manual'
  contact: 'scraped' | 'constructed' | 'manual'
  emailVerified: boolean
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

// ── Pipeline types ──────────────────────────────────────────────

export type FundingStage = 'Seed' | 'Series A' | 'Series B' | 'Series C'

export interface RawCompany {
  name: string
  domain: string
  stage: FundingStage
  raised: number
  employees: number
  source: 'csv' | 'manual'
}

export interface BlogPost {
  title: string
  date: string | null
  wordCountEstimate: number
}

export interface ValidatedCompany extends RawCompany {
  blogUrl: string
  blogScore: number
  blogScoreReason: string
  recentPosts: BlogPost[]
}

export type ContactConfidence = 'high' | 'medium' | 'low'
export type ContactSource = 'scraped' | 'constructed' | 'manual'

export interface PipelineContact {
  name: string
  title: string
  email: string | null
  confidence: ContactConfidence
  source: ContactSource
}

export interface EnrichedProspect {
  company: ValidatedCompany
  contact: PipelineContact | null
}

export type PipelineStage =
  | 'sourcing'
  | 'validating'
  | 'contacts'
  | 'emails'
  | 'done'
  | 'error'

export interface PipelineProgress {
  stage: PipelineStage
  message: string
  found?: number
  total?: number
}
