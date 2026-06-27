'use client'

import { useEffect, useState } from 'react'
import { Company } from '@/types'

interface BlogMeta {
  postTitle?: string
  date?: string
  error?: boolean
}

interface BlogViewerProps {
  company: Company
  hideBlogScore?: boolean
}

const CARD_HEIGHT = 56

export default function BlogViewer({ company }: BlogViewerProps) {
  const [meta, setMeta] = useState<BlogMeta | null>(null)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    setMeta(null)
    setIframeError(false)

    const controller = new AbortController()

    async function fetchMeta() {
      try {
        const res = await fetch('/api/blog-fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: company.blogUrl }),
          signal: controller.signal,
        })
        const data = await res.json() as BlogMeta
        setMeta(data)
      } catch {
        if (!controller.signal.aborted) {
          setMeta({ error: true })
        }
      }
    }

    fetchMeta()
    return () => controller.abort()
  }, [company.blogUrl])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          height: `${CARD_HEIGHT}px`,
          flexShrink: 0,
          backgroundColor: '#FFFFF8',
          borderBottom: '1px solid #EDE9DC',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(32,30,31,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>
          Latest Post
        </div>
        {meta === null ? (
          <div style={{ fontSize: '12px', color: 'rgba(32,30,31,0.25)' }}>Loading…</div>
        ) : meta.error ? (
          <div style={{ fontSize: '12px', color: 'rgba(32,30,31,0.4)' }}>Could not fetch post metadata</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#201E1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
              {meta.postTitle ?? 'Unknown title'}
            </div>
            {meta.date && (
              <div style={{ fontSize: '11px', color: 'rgba(32,30,31,0.4)', flexShrink: 0 }}>{meta.date}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {iframeError ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#F7F4ED',
            }}
          >
            <span style={{ fontSize: '13px', color: 'rgba(32,30,31,0.5)' }}>Preview unavailable</span>
            <a
              href={company.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                textDecoration: 'none',
                backgroundColor: '#201E1F',
                color: '#FFFFF8',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Open in browser ↗
            </a>
          </div>
        ) : (
          <>
            <iframe
              key={company.blogUrl}
              src={company.blogUrl}
              title={`${company.name} blog`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              onError={() => setIframeError(true)}
              onLoad={(e) => {
                // X-Frame-Options blocks produce a blank contentDocument — detect and fall back
                try {
                  const doc = (e.target as HTMLIFrameElement).contentDocument
                  if (doc && (doc.body === null || doc.body.innerHTML === '')) {
                    setIframeError(true)
                  }
                } catch {
                  // cross-origin access denied means the page DID load (no X-Frame-Options block)
                }
              }}
              sandbox="allow-same-origin allow-scripts allow-popups"
            />
            <a
              href={company.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                fontSize: '11px',
                color: 'rgba(32,30,31,0.55)',
                backgroundColor: '#FFFFF8',
                border: '1px solid #EDE9DC',
                borderRadius: '5px',
                padding: '4px 10px',
                textDecoration: 'none',
                boxShadow: '0 1px 4px rgba(32,30,31,0.08)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Open in browser ↗
            </a>
          </>
        )}
      </div>
    </div>
  )
}
