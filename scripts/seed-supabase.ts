/**
 * One-time seed: load data/prospects.json into Supabase.
 *
 *   npm run seed
 *
 * Idempotent — upserts by id/domain, so re-running won't duplicate rows. It
 * does NOT overwrite review state you've already changed in the app, because
 * existing prospect rows are upserted with their seed status ('pending'); run
 * this only for initial population (or to re-add seed rows that were removed).
 */
import { loadEnvConfig } from '@next/env'
import fs from 'fs'
import path from 'path'

loadEnvConfig(process.cwd())

import { upsertProspects } from '../lib/prospects-store'
import { Prospect } from '../types'

async function main() {
  const file = path.join(process.cwd(), 'data', 'prospects.json')
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as { prospects: Prospect[] }
  const prospects = raw.prospects ?? []

  if (prospects.length === 0) {
    console.log('No prospects in data/prospects.json — nothing to seed.')
    return
  }

  console.log(`Seeding ${prospects.length} prospects into Supabase…`)
  await upsertProspects(prospects)
  console.log(`✅ Seeded ${prospects.length} prospects (companies, contacts, prospects).`)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
