'use client'

import { useEffect, useRef, useState } from 'react'
import { PipelineProgress, PipelineStage } from '@/types'

interface EnrichModalProps {
  onClose: () => void
  onComplete: () => void
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  sourcing: 'Sourcing companies',
  validating: 'Validating blogs',
  contacts: 'Finding contacts',
  emails: 'Resolving emails',
  done: 'Done',
  error: 'Error',
}

const STAGE_ORDER: PipelineStage[] = ['sourcing', 'validating', 'contacts', 'emails', 'done']

function StageRow({
  stage,
  currentStage,
  message,
}: {
  stage: PipelineStage
  currentStage: PipelineStage
  message?: string
}) {
  const stageIdx = STAGE_ORDER.indexOf(stage)
  const currentIdx = STAGE_ORDER.indexOf(currentStage === 'error' ? 'sourcing' : currentStage)
  const isDone = stageIdx < currentIdx || currentStage === 'done'
  const isActive = stageIdx === currentIdx && currentStage !== 'done' && currentStage !== 'error'
  const isPending = stageIdx > currentIdx

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0' }}>
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: isDone ? '#16a34a' : isActive ? '#111' : '#F0EFED',
        border: isPending ? '1.5px solid #E7E5E4' : 'none',
      }}>
        {isDone && <span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>✓</span>}
        {isActive && (
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: 'white',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
        )}
      </div>
      <div>
        <div style={{
          fontSize: '13px', fontWeight: 600,
          color: isDone ? '#16a34a' : isActive ? '#111' : '#C4BFB9',
        }}>
          {STAGE_LABELS[stage]}
        </div>
        {(isDone || isActive) && message && (
          <div style={{ fontSize: '12px', color: '#78716C', marginTop: '1px' }}>{message}</div>
        )}
      </div>
    </div>
  )
}

export default function EnrichModal({ onClose, onComplete }: EnrichModalProps) {
  const [events, setEvents] = useState<PipelineProgress[]>([])
  const [currentStage, setCurrentStage] = useState<PipelineStage>('sourcing')
  const [latestByStage, setLatestByStage] = useState<Partial<Record<PipelineStage, PipelineProgress>>>({})
  const [running, setRunning] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    async function run() {
      try {
        const res = await fetch('/api/enrich', {
          method: 'POST',
          signal: controller.signal,
        })

        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event = JSON.parse(dataLine.slice(6)) as PipelineProgress
              setEvents((prev) => [...prev, event])
              setCurrentStage(event.stage)
              setLatestByStage((prev) => ({ ...prev, [event.stage]: event }))
              if (event.stage === 'done' || event.stage === 'error') {
                setRunning(false)
              }
            } catch {
              // malformed SSE line
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setCurrentStage('error')
          setRunning(false)
        }
      }
    }

    run()
    return () => controller.abort()
  }, [])

  const isDone = currentStage === 'done'
  const isError = currentStage === 'error'
  const finalEvent = events[events.length - 1]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '14px',
        width: '420px', padding: '28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '4px' }}>
          {isDone ? 'Pipeline complete' : isError ? 'Pipeline error' : 'Enriching prospects…'}
        </div>
        <div style={{ fontSize: '13px', color: '#78716C', marginBottom: '24px' }}>
          {isDone
            ? finalEvent?.message ?? 'Done'
            : isError
            ? finalEvent?.message ?? 'Something went wrong'
            : 'This takes 30–60 seconds. Keep this window open.'}
        </div>

        <div style={{ borderTop: '1px solid #F0EFED', borderBottom: '1px solid #F0EFED', padding: '4px 0', marginBottom: '20px' }}>
          {STAGE_ORDER.filter((s) => s !== 'done').map((stage) => (
            <StageRow
              key={stage}
              stage={stage}
              currentStage={currentStage}
              message={latestByStage[stage]?.message}
            />
          ))}
        </div>

        {(isDone || isError) ? (
          <button
            onClick={() => {
              if (isDone) onComplete()
              onClose()
            }}
            style={{
              width: '100%', backgroundColor: isDone ? '#111' : '#78716C',
              color: 'white', fontSize: '14px', fontWeight: 600,
              border: 'none', borderRadius: '8px', padding: '11px 0',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isDone ? 'View new prospects' : 'Close'}
          </button>
        ) : (
          <button
            onClick={() => {
              abortRef.current?.abort()
              onClose()
            }}
            style={{
              width: '100%', backgroundColor: 'transparent', color: '#A8A29E',
              fontSize: '13px', fontWeight: 500, border: '1px solid #E7E5E4',
              borderRadius: '8px', padding: '9px 0', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
