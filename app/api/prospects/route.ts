import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { Prospect } from '@/types'

const PROSPECTS_PATH = path.join(process.cwd(), 'data', 'prospects.json')

export function GET() {
  try {
    const raw = JSON.parse(fs.readFileSync(PROSPECTS_PATH, 'utf-8')) as { prospects: Prospect[] }
    return NextResponse.json({ prospects: raw.prospects ?? [] })
  } catch {
    return NextResponse.json({ prospects: [] })
  }
}
