import fs from 'fs'
import path from 'path'
import { RawCompany, FundingStage } from '../../types/index.js'

const VALID_STAGES: FundingStage[] = ['Seed', 'Series A', 'Series B', 'Series C']

function parseRaised(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function parseStage(val: string): FundingStage | null {
  const trimmed = val.trim() as FundingStage
  return VALID_STAGES.includes(trimmed) ? trimmed : null
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

export interface SourceResult {
  companies: RawCompany[]
  skipped: number
  reason: string[]
}

export async function sourceCompanies(csvPath: string): Promise<SourceResult> {
  const companies: RawCompany[] = []
  const skipReasons: string[] = []

  if (!fs.existsSync(csvPath)) {
    return { companies: [], skipped: 0, reason: [`CSV not found at ${csvPath}`] }
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCsv(content)

  for (const row of rows) {
    const name = row['name']?.trim()
    const domain = row['domain']?.trim()
    const stageRaw = row['stage']?.trim()
    const raisedRaw = row['raised']?.trim()
    const employeesRaw = row['employees']?.trim()

    if (!name || !domain) {
      skipReasons.push(`Skipped row: missing name or domain`)
      continue
    }

    const stage = parseStage(stageRaw)
    if (!stage) {
      skipReasons.push(`${name}: unrecognised stage "${stageRaw}"`)
      continue
    }

    const raised = parseRaised(raisedRaw)
    if (raised < 5_000_000) {
      skipReasons.push(`${name}: raised $${raised.toLocaleString()} < $5M minimum`)
      continue
    }

    const employees = parseInt(employeesRaw, 10)
    if (isNaN(employees) || employees < 10 || employees > 500) {
      skipReasons.push(`${name}: employee count ${employeesRaw} outside 10–500 range`)
      continue
    }

    companies.push({ name, domain, stage, raised, employees, source: 'csv' })
  }

  // Write raw results
  const rawPath = path.join(process.cwd(), 'data', 'pipeline', 'raw.json')
  fs.mkdirSync(path.dirname(rawPath), { recursive: true })
  fs.writeFileSync(rawPath, JSON.stringify(companies, null, 2))

  return { companies, skipped: rows.length - companies.length, reason: skipReasons }
}
