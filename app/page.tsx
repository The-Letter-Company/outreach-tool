'use client'

import { useEffect, useState, useCallback } from 'react'
import { Prospect, ProspectSource } from '@/types'
import BlogViewer from '@/app/components/BlogViewer'
import TemplateSelector from '@/app/components/TemplateSelector'
import EmailComposer from '@/app/components/EmailComposer'
import VideoRecorder from '@/app/components/VideoRecorder'
import EnrichModal from '@/app/components/EnrichModal'


function formatRaised(amount: number): string {
  const millions = amount / 1_000_000
  return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
}

function scoreColor(score: number): string {
  if (score > 70) return '#2D7A45'
  if (score >= 40) return '#B95737'
  return '#C0392B'
}

function scoreBg(score: number): string {
  if (score > 70) return '#EAF4EE'
  if (score >= 40) return '#FBF0EB'
  return '#FAEAEA'
}

function scoreLabel(score: number): string {
  if (score > 70) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Weak'
}

type QueueFilter = 'all' | 'verified' | 'unverified'

function SourceBadge({ label, variant }: { label: string; variant: 'neutral' | 'warning' }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600,
      padding: '2px 7px', borderRadius: '4px',
      backgroundColor: variant === 'warning' ? '#FBF0EB' : '#EDE9DC',
      color: variant === 'warning' ? '#B95737' : 'rgba(32,30,31,0.55)',
      border: `1px solid ${variant === 'warning' ? '#E8C4B0' : '#D9D4C7'}`,
      letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  )
}

function sourceBadges(source: ProspectSource | undefined, email: string) {
  if (!source) return null
  const badges: { label: string; variant: 'neutral' | 'warning' }[] = []
  badges.push({ label: source.company === 'csv' ? 'CSV' : 'Manual', variant: 'neutral' })
  if (!email) {
    badges.push({ label: 'Contact needed', variant: 'warning' })
  } else if (!source.emailVerified) {
    badges.push({ label: 'Unverified email', variant: 'warning' })
  } else {
    badges.push({ label: source.contact === 'scraped' ? 'Scraped' : 'Manual', variant: 'neutral' })
  }
  return badges
}

async function reloadProspects(): Promise<Prospect[]> {
  const res = await fetch('/api/prospects')
  if (!res.ok) return []
  const data = await res.json() as { prospects: Prospect[] }
  return data.prospects ?? []
}

interface ProspectStatePatch {
  status?: Prospect['status']
  selectedTemplateId?: string
}

// Fire-and-forget persistence of review state to Supabase.
async function persistState(companyId: string, patch: ProspectStatePatch): Promise<void> {
  try {
    await fetch('/api/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...patch }),
    })
  } catch {
    // Optimistic UI already updated; a failed write is non-fatal for the session.
  }
}

export default function Home() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [videoFilename, setVideoFilename] = useState<string | null>(null)
  const [showEnrich, setShowEnrich] = useState(false)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')

  const pendingProspects = prospects.filter((p) => p.status === 'pending')
  const filteredQueue = pendingProspects.filter((p) => {
    if (queueFilter === 'verified') return !p.source || p.source.emailVerified
    if (queueFilter === 'unverified') return p.source && !p.source.emailVerified
    return true
  })

  const total = filteredQueue.length
  const current = filteredQueue[currentIndex]
  const remaining = filteredQueue.slice(currentIndex + 1)

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1)
    setSelectedTemplateId(undefined)
    setCopied(false)
    setVideoFilename(null)
  }, [])

  const handleArchive = useCallback(() => {
    if (!current) return
    setProspects((prev) =>
      prev.map((p) => p.company.id === current.company.id ? { ...p, status: 'archived' as const } : p)
    )
    persistState(current.company.id, { status: 'archived' })
    advance()
  }, [current, advance])

  const handleDrafted = useCallback(() => {
    if (!current) return
    setProspects((prev) =>
      prev.map((p) =>
        p.company.id === current.company.id
          ? { ...p, status: 'drafted' as const, selectedTemplateId }
          : p
      )
    )
    persistState(current.company.id, { status: 'drafted', selectedTemplateId })
    advance()
  }, [current, advance, selectedTemplateId])

  // Load persisted prospects from Supabase on mount.
  useEffect(() => {
    reloadProspects().then((fresh) => setProspects(fresh))
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'a' || e.key === 'A') handleArchive()
      if (e.key === 'd' || e.key === 'D') handleDrafted()
      if (e.key === '1') setSelectedTemplateId('1')
      if (e.key === '2') setSelectedTemplateId('2')
      if (e.key === '3') setSelectedTemplateId('3')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleArchive, handleDrafted])

  const doneCount = prospects.filter((p) => p.status !== 'pending').length
  const stackDepth = Math.min(remaining.length, 3)

  const topBar = (
    <div style={{ height: '56px', backgroundColor: '#201E1F', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
      <span style={{ color: '#FFFFF8', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '17px', fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.01em' }}>Letterstory</span>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Outreach</span>
        </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {current && (
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
            <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{currentIndex + 1}</strong> of {total}
          </span>
        )}
        {current && (
          <div style={{ display: 'flex', gap: '3px' }}>
            {filteredQueue.map((p, i) => (
              <div key={p.company.id} style={{
                width: '16px', height: '3px', borderRadius: '2px',
                backgroundColor: i < currentIndex
                  ? (p.status === 'drafted' ? '#EE724A' : 'rgba(255,255,255,0.2)')
                  : i === currentIndex ? '#FFFFF8' : 'rgba(255,255,255,0.12)',
              }} />
            ))}
          </div>
        )}
        <button
          onClick={() => setShowEnrich(true)}
          style={{
            fontSize: '12px', fontWeight: 500, color: '#FFFFF8',
            backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '7px', padding: '6px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          + Add Prospects
        </button>
      </div>
    </div>
  )

  if (currentIndex >= total) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFF8', fontFamily: 'var(--font-sans)' }}>
        {topBar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
          {total === 0 && queueFilter !== 'all' ? (
            <>
              <div style={{ fontSize: '24px', fontWeight: 400, color: '#201E1F', fontFamily: 'var(--font-serif)' }}>No prospects match this filter.</div>
              <button onClick={() => { setQueueFilter('all'); setCurrentIndex(0) }} style={{ fontSize: '13px', color: 'rgba(32,30,31,0.5)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>
                Show all
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '36px', fontWeight: 400, color: '#201E1F', fontFamily: 'var(--font-serif)' }}>All caught up.</div>
              <div style={{ fontSize: '16px', color: 'rgba(32,30,31,0.55)', fontWeight: 400 }}>{doneCount} prospect{doneCount !== 1 ? 's' : ''} reviewed</div>
              <button onClick={() => setShowEnrich(true)} style={{
                marginTop: '12px', fontSize: '13px', fontWeight: 500,
                color: '#FFFFF8', backgroundColor: '#201E1F', border: 'none',
                borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                + Add more prospects
              </button>
            </>
          )}
        </div>
        {showEnrich && (
          <EnrichModal
            onClose={() => setShowEnrich(false)}
            onComplete={() => { /* pipeline disabled */ }}
          />
        )}
      </div>
    )
  }

  const badges = sourceBadges(current.source, current.contact.email)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFF8', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>

      {topBar}

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ══ LEFT PANEL — 50% ══ */}
        <div style={{ flex: 1, borderRight: '1px solid #EDE9DC', backgroundColor: '#FFFFF8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Scrollable: queue + cards + template + email */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

            {/* ── Queue header ── */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(32,30,31,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Queue</span>
                <span style={{ fontSize: '12px', color: 'rgba(32,30,31,0.4)' }}>{remaining.length} remaining</span>
              </div>

              {prospects.some((p) => p.source) && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                  {(['all', 'verified', 'unverified'] as QueueFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setQueueFilter(f); setCurrentIndex(0) }}
                      style={{
                        fontSize: '10px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: '5px',
                        border: `1px solid ${queueFilter === f ? '#201E1F' : '#EDE9DC'}`,
                        backgroundColor: queueFilter === f ? '#201E1F' : 'transparent',
                        color: queueFilter === f ? '#FFFFF8' : 'rgba(32,30,31,0.4)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize',
                      }}
                    >
                      {f === 'all' ? 'All' : f === 'verified' ? 'Verified' : 'Unverified'}
                    </button>
                  ))}
                </div>
              )}

              {/* Stacked deck */}
              <div style={{ position: 'relative', height: `${62 + stackDepth * 5}px` }}>
                {remaining.slice(0, 3).reverse().map((p, ri) => {
                  const depth = remaining.slice(0, 3).length - 1 - ri
                  return (
                    <div key={p.company.id} style={{
                      position: 'absolute',
                      top: `${depth * 5}px`, left: `${depth * 3}px`, right: `-${depth * 3}px`,
                      height: '62px', borderRadius: '10px',
                      backgroundColor: depth === 0 ? '#E8E3D8' : depth === 1 ? '#ECEADF' : '#F0EEE5',
                      border: '1px solid #D9D4C7', zIndex: depth,
                      display: 'flex', alignItems: 'center', padding: '0 14px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(32,30,31,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.company.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(32,30,31,0.3)' }}>{p.contact.name}</div>
                      </div>
                    </div>
                  )
                })}
                {/* Active card */}
                <div style={{
                  position: 'absolute',
                  top: `${stackDepth * 5}px`, left: `${stackDepth * 3}px`, right: `-${stackDepth * 3}px`,
                  height: '62px', borderRadius: '10px',
                  backgroundColor: '#201E1F', zIndex: 10,
                  display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFF8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.company.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,240,0.45)' }}>{current.contact.name} · {current.contact.title}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,240,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: current.company.blogScore > 70 ? '#7ECBA1' : current.company.blogScore >= 40 ? '#EE724A' : '#E07070' }}>{current.company.blogScore}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Company + Contact — side by side, compact ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {/* Company */}
              <div style={{ flex: 1, backgroundColor: '#FFFFFF', border: '1px solid #EDE9DC', borderRadius: '10px', padding: '12px 14px', minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(32,30,31,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px' }}>Company</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#201E1F', letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{current.company.name}</div>
                  <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 500, color: 'rgba(32,30,31,0.55)', backgroundColor: '#EDE9DC', borderRadius: '5px', padding: '3px 7px', marginTop: '1px' }}>
                    {current.company.stage}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#201E1F', fontWeight: 500 }}>{formatRaised(current.company.raised)}</span>
                    <span style={{ fontSize: '12px', color: 'rgba(32,30,31,0.55)' }}>{current.company.employees} employees</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(32,30,31,0.38)' }}>{current.company.domain}</span>
                </div>
                {badges && (
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {badges.map((b) => <SourceBadge key={b.label} label={b.label} variant={b.variant} />)}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div style={{ flex: 1, backgroundColor: '#FFFFFF', border: '1px solid #EDE9DC', borderRadius: '10px', padding: '12px 14px', minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(32,30,31,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px' }}>Contact</div>
                {current.contact.name ? (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#201E1F', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.contact.name}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(32,30,31,0.55)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.contact.title}</div>
                    {current.contact.email ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#201E1F', fontFamily: 'ui-monospace, monospace', backgroundColor: '#FAFAF7', border: '1px solid #EDE9DC', borderRadius: '5px', padding: '4px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {current.contact.email}
                        </div>
                        {current.source?.emailConfidence === 'high' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#2D7A45', backgroundColor: '#EAF4EE', borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start' }}>✓ Verified</span>
                        )}
                        {current.source?.emailConfidence === 'medium' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#B95737', backgroundColor: '#FBF0EB', borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start' }}>~ Likely</span>
                        )}
                        {(current.source?.emailConfidence === 'low' || (current.source && !current.source.emailConfidence && !current.source.emailVerified)) && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#888', backgroundColor: '#F0F0F0', borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start' }}>? Unverified</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#B95737', fontStyle: 'italic' }}>No email</div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#B95737', fontStyle: 'italic' }}>Contact needed</div>
                )}
              </div>
            </div>

            {/* ── Template selector ── */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(32,30,31,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Template</div>
              <TemplateSelector selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
            </div>

            {/* ── Email composer — always visible ── */}
            <div style={{ marginBottom: '0' }}>
              <EmailComposer
                prospect={current}
                selectedTemplateId={selectedTemplateId}
                copied={copied}
                setCopied={setCopied}
                videoFilename={videoFilename}
              />
            </div>

            {/* spacer so content clears the pinned footer */}
            <div style={{ height: '80px' }} />
          </div>

          {/* ── Pinned action bar ── */}
          <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid #EDE9DC', backgroundColor: '#FFFFF8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleArchive} style={{
                flex: 1, padding: '11px 0', fontSize: '14px', fontWeight: 500,
                color: 'rgba(32,30,31,0.5)', backgroundColor: '#FFFFF8', border: '1px solid #EDE9DC',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                Archive
              </button>
              <button onClick={handleDrafted} style={{
                flex: 2, padding: '11px 0', fontSize: '14px', fontWeight: 600,
                color: '#FFFFF8', backgroundColor: '#EE724A', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                Mark Drafted →
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '11px', color: 'rgba(32,30,31,0.3)', margin: 0 }}>A — archive · D — drafted · 1/2/3 — template</p>
              <VideoRecorder companyName={current.company.name} onRecorded={setVideoFilename} />
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL — Blog only, 50% ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F7F4ED' }}>

          <div style={{ backgroundColor: '#FFFFF8', borderBottom: '1px solid #EDE9DC', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  backgroundColor: scoreBg(current.company.blogScore),
                  border: `1.5px solid ${scoreColor(current.company.blogScore)}30`,
                  borderRadius: '8px', padding: '5px 12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: scoreColor(current.company.blogScore), textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blog Score</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: scoreColor(current.company.blogScore), lineHeight: 1 }}>{current.company.blogScore}</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: scoreColor(current.company.blogScore), opacity: 0.7 }}>{scoreLabel(current.company.blogScore)}</span>
                </div>
                <div style={{ flex: 1, maxWidth: '320px' }}>
                  <div style={{ height: '4px', backgroundColor: '#EDE9DC', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${current.company.blogScore}%`, backgroundColor: scoreColor(current.company.blogScore), borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'rgba(32,30,31,0.5)', fontStyle: 'italic', flex: 1 }}>{current.company.blogScoreReason}</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <BlogViewer company={current.company} hideBlogScore />
          </div>

        </div>
      </div>

      {showEnrich && (
        <EnrichModal
          onClose={() => setShowEnrich(false)}
          onComplete={() => { /* pipeline disabled */ }}
        />
      )}
    </div>
  )
}
