'use client'

import { useEffect, useState, useCallback } from 'react'
import { Prospect, ProspectSource } from '@/types'
import prospectData from '@/data/prospects.json'
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
  if (score > 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

function scoreBg(score: number): string {
  if (score > 70) return '#f0fdf4'
  if (score >= 40) return '#fffbeb'
  return '#fef2f2'
}

function scoreLabel(score: number): string {
  if (score > 70) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Weak'
}

type RightTab = 'blog' | 'email'
type QueueFilter = 'all' | 'verified' | 'unverified'

function SourceBadge({ label, variant }: { label: string; variant: 'neutral' | 'warning' }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600,
      padding: '2px 7px', borderRadius: '4px',
      backgroundColor: variant === 'warning' ? '#fffbeb' : '#F0EFED',
      color: variant === 'warning' ? '#d97706' : '#78716C',
      border: `1px solid ${variant === 'warning' ? '#fde68a' : '#E7E5E4'}`,
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

export default function Home() {
  const [prospects, setProspects] = useState<Prospect[]>(
    prospectData.prospects as Prospect[]
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [customLine, setCustomLine] = useState('')
  const [copied, setCopied] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>('blog')
  const [videoFilename, setVideoFilename] = useState<string | null>(null)
  const [showEnrich, setShowEnrich] = useState(false)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')

  const pendingProspects = prospects.filter((p) => p.status === 'pending')
  const filteredQueue = pendingProspects.filter((p) => {
    if (queueFilter === 'verified') return !p.source || p.source.emailVerified
    if (queueFilter === 'unverified') return p.source && !p.source.emailVerified
    return true
  })

  // currentIndex always indexes into filteredQueue for display
  const total = filteredQueue.length
  const current = filteredQueue[currentIndex]
  const remaining = filteredQueue.slice(currentIndex + 1)

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1)
    setSelectedTemplateId(undefined)
    setCustomLine('')
    setCopied(false)
    setRightTab('blog')
    setVideoFilename(null)
  }, [])

  const handleArchive = useCallback(() => {
    if (!current) return
    setProspects((prev) =>
      prev.map((p) => p.company.id === current.company.id ? { ...p, status: 'archived' as const } : p)
    )
    advance()
  }, [current, advance])

  const handleDrafted = useCallback(() => {
    if (!current) return
    setProspects((prev) =>
      prev.map((p) =>
        p.company.id === current.company.id
          ? { ...p, status: 'drafted' as const, selectedTemplateId, customLine }
          : p
      )
    )
    advance()
  }, [current, advance, selectedTemplateId, customLine])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'a' || e.key === 'A') handleArchive()
      if (e.key === 'd' || e.key === 'D') handleDrafted()
      if (e.key === '1') setSelectedTemplateId('1')
      if (e.key === '2') setSelectedTemplateId('2')
      if (e.key === '3') setSelectedTemplateId('3')
      if (e.key === 'b' || e.key === 'B') setRightTab('blog')
      if (e.key === 'e' || e.key === 'E') setRightTab('email')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleArchive, handleDrafted])

  const doneCount = prospects.filter((p) => p.status !== 'pending').length
  const stackDepth = Math.min(remaining.length, 3)

  const topBar = (
    <div style={{ height: '56px', backgroundColor: 'white', borderBottom: '1px solid #E7E5E4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
      <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em', color: '#111' }}>Outreach</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {current && (
          <span style={{ fontSize: '14px', color: '#78716C' }}>
            <strong style={{ color: '#111' }}>{currentIndex + 1}</strong> of {total}
          </span>
        )}
        {current && (
          <div style={{ display: 'flex', gap: '3px' }}>
            {filteredQueue.map((p, i) => (
              <div key={p.company.id} style={{
                width: '16px', height: '4px', borderRadius: '3px',
                backgroundColor: i < currentIndex
                  ? (p.status === 'drafted' ? '#16a34a' : '#D4D0CB')
                  : i === currentIndex ? '#111' : '#E7E5E4',
              }} />
            ))}
          </div>
        )}
        <button
          onClick={() => setShowEnrich(true)}
          style={{
            fontSize: '12px', fontWeight: 600, color: '#111',
            backgroundColor: 'white', border: '1.5px solid #E7E5E4',
            borderRadius: '7px', padding: '6px 12px', cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          + Add Prospects
        </button>
      </div>
    </div>
  )

  if (currentIndex >= total) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F5F5F4', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {topBar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
          {total === 0 && queueFilter !== 'all' ? (
            <>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>No prospects match this filter.</div>
              <button onClick={() => { setQueueFilter('all'); setCurrentIndex(0) }} style={{ fontSize: '14px', color: '#78716C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Show all
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#111' }}>All caught up.</div>
              <div style={{ fontSize: '17px', color: '#78716C' }}>{doneCount} prospect{doneCount !== 1 ? 's' : ''} reviewed</div>
              <button onClick={() => setShowEnrich(true)} style={{
                marginTop: '8px', fontSize: '13px', fontWeight: 600,
                color: '#111', backgroundColor: 'white', border: '1.5px solid #E7E5E4',
                borderRadius: '7px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                + Add more prospects
              </button>
            </>
          )}
        </div>
        {showEnrich && (
          <EnrichModal
            onClose={() => setShowEnrich(false)}
            onComplete={async () => {
              const fresh = await reloadProspects()
              if (fresh.length > 0) {
                setProspects(fresh)
                setCurrentIndex(0)
              }
            }}
          />
        )}
      </div>
    )
  }

  const badges = sourceBadges(current.source, current.contact.email)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F5F5F4', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>

      {topBar}

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid #E7E5E4', backgroundColor: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '0' }}>

            {/* ── Queue header with filter ── */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Queue</span>
                <span style={{ fontSize: '12px', color: '#A8A29E' }}>{remaining.length} remaining</span>
              </div>

              {/* Filter pills — only shown when enriched prospects exist */}
              {prospects.some((p) => p.source) && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                  {(['all', 'verified', 'unverified'] as QueueFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setQueueFilter(f); setCurrentIndex(0) }}
                      style={{
                        fontSize: '10px', fontWeight: 600,
                        padding: '3px 8px', borderRadius: '5px',
                        border: `1px solid ${queueFilter === f ? '#111' : '#E7E5E4'}`,
                        backgroundColor: queueFilter === f ? '#111' : 'transparent',
                        color: queueFilter === f ? 'white' : '#A8A29E',
                        cursor: 'pointer', fontFamily: 'inherit',
                        textTransform: 'capitalize',
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
                      top: `${depth * 5}px`,
                      left: `${depth * 3}px`,
                      right: `-${depth * 3}px`,
                      height: '62px', borderRadius: '10px',
                      backgroundColor: depth === 0 ? '#E7E5E4' : depth === 1 ? '#EDECE9' : '#F0EFED',
                      border: '1px solid #DDD9D6',
                      zIndex: depth,
                      display: 'flex', alignItems: 'center', padding: '0 14px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#A8A29E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.company.name}</div>
                        <div style={{ fontSize: '11px', color: '#C4BFB9' }}>{p.contact.name}</div>
                      </div>
                    </div>
                  )
                })}
                {/* Active card */}
                <div style={{
                  position: 'absolute',
                  top: `${stackDepth * 5}px`,
                  left: `${stackDepth * 3}px`,
                  right: `-${stackDepth * 3}px`,
                  height: '62px', borderRadius: '10px',
                  backgroundColor: '#111', zIndex: 10,
                  display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.company.name}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{current.contact.name} · {current.contact.title}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Score</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: current.company.blogScore > 70 ? '#4ADE80' : current.company.blogScore >= 40 ? '#FCD34D' : '#F87171' }}>{current.company.blogScore}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Company box ── */}
            <div style={{ backgroundColor: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Company</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#111', letterSpacing: '-0.02em', lineHeight: '1.2' }}>{current.company.name}</div>
                <span style={{ flexShrink: 0, marginTop: '3px', fontSize: '12px', fontWeight: 600, color: '#44403C', backgroundColor: '#F0EFED', borderRadius: '6px', padding: '3px 10px' }}>
                  {current.company.stage}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: badges ? '10px' : '0' }}>
                <span style={{ fontSize: '13px', color: '#78716C' }}>{formatRaised(current.company.raised)} raised</span>
                <span style={{ fontSize: '13px', color: '#78716C' }}>{current.company.employees} employees</span>
                <span style={{ fontSize: '13px', color: '#A8A29E' }}>{current.company.domain}</span>
              </div>
              {badges && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {badges.map((b) => <SourceBadge key={b.label} label={b.label} variant={b.variant} />)}
                </div>
              )}
            </div>

            {/* ── Contact box ── */}
            <div style={{ backgroundColor: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Contact</div>
              {current.contact.name ? (
                <>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#111', marginBottom: '3px' }}>{current.contact.name}</div>
                  <div style={{ fontSize: '13px', color: '#78716C', marginBottom: '10px' }}>{current.contact.title}</div>
                  {current.contact.email ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#44403C', fontFamily: 'ui-monospace, monospace', backgroundColor: 'white', border: '1px solid #E7E5E4', borderRadius: '6px', padding: '7px 10px' }}>
                        {current.contact.email}
                      </div>
                      {current.source && !current.source.emailVerified && (
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '2px 7px' }}>
                          Unverified
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#d97706', fontStyle: 'italic' }}>No email found — add manually</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '13px', color: '#d97706', fontStyle: 'italic' }}>Contact needed — add manually</div>
              )}
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <button onClick={handleArchive} style={{
                flex: 1, padding: '13px 0', fontSize: '14px', fontWeight: 600,
                color: '#78716C', backgroundColor: 'white', border: '1.5px solid #E7E5E4',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Archive
              </button>
              <button onClick={handleDrafted} style={{
                flex: 2, padding: '13px 0', fontSize: '14px', fontWeight: 600,
                color: 'white', backgroundColor: '#111', border: '1.5px solid #111',
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Mark Drafted →
              </button>
            </div>

          </div>

          {/* ── Footer ── */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #E7E5E4', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white' }}>
            <p style={{ fontSize: '11px', color: '#C4BFB9', margin: 0 }}>A — archive · D — drafted · B / E — switch tab</p>
            <VideoRecorder companyName={current.company.name} onRecorded={setVideoFilename} />
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F5F4' }}>

          <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E7E5E4', flexShrink: 0 }}>

            {/* Blog score row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px 10px', borderBottom: '1px solid #F0EFED' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  backgroundColor: scoreBg(current.company.blogScore),
                  border: `1.5px solid ${scoreColor(current.company.blogScore)}40`,
                  borderRadius: '8px', padding: '5px 12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: scoreColor(current.company.blogScore), textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blog Score</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: scoreColor(current.company.blogScore), lineHeight: 1 }}>{current.company.blogScore}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: scoreColor(current.company.blogScore), opacity: 0.7 }}>{scoreLabel(current.company.blogScore)}</span>
                </div>
                <div style={{ flex: 1, maxWidth: '320px' }}>
                  <div style={{ height: '5px', backgroundColor: '#E7E5E4', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${current.company.blogScore}%`, backgroundColor: scoreColor(current.company.blogScore), borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#78716C', fontStyle: 'italic', flex: 1 }}>{current.company.blogScoreReason}</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', padding: '0 20px' }}>
              {(['blog', 'email'] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  style={{
                    padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                    color: rightTab === tab ? '#111' : '#A8A29E',
                    backgroundColor: 'transparent', border: 'none',
                    borderBottom: rightTab === tab ? '2px solid #111' : '2px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    marginBottom: '-1px',
                    textTransform: 'capitalize',
                    transition: 'color 0.15s',
                  }}
                >
                  {tab === 'blog' ? '📄 Blog Preview' : '✉️ Email Draft'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'blog' ? (
              <BlogViewer company={current.company} hideBlogScore />
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Choose Template</div>
                  <TemplateSelector selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
                </div>
                <EmailComposer
                  prospect={current}
                  selectedTemplateId={selectedTemplateId}
                  customLine={customLine}
                  onCustomLineChange={setCustomLine}
                  copied={copied}
                  setCopied={setCopied}
                  videoFilename={videoFilename}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {showEnrich && (
        <EnrichModal
          onClose={() => setShowEnrich(false)}
          onComplete={async () => {
            const fresh = await reloadProspects()
            if (fresh.length > 0) setProspects(fresh)
          }}
        />
      )}
    </div>
  )
}
