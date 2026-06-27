import { NextRequest, NextResponse } from 'next/server'
import { getProspects, updateProspectState, ProspectStatePatch } from '@/lib/prospects-store'

// Always run at request time — this reads live data from Supabase.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const prospects = await getProspects()
    return NextResponse.json({ prospects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load prospects'
    return NextResponse.json({ prospects: [], error: message }, { status: 500 })
  }
}

interface PatchBody extends ProspectStatePatch {
  companyId?: string
}

// Persist per-prospect review state (status, selected template, custom line).
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as PatchBody
    const { companyId, ...patch } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    await updateProspectState(companyId, patch)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update prospect'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
