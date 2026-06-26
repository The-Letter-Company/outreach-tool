'use client'

import { templates } from '@/data/templates'

interface TemplateSelectorProps {
  selectedId: string | undefined
  onSelect: (id: string) => void
}

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {templates.map((t, i) => {
        const selected = t.id === selectedId
        return (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 14px',
              border: `1.5px solid ${selected ? '#111' : '#E7E5E4'}`,
              borderRadius: '8px', cursor: 'pointer',
              backgroundColor: selected ? '#111' : 'white',
              transition: 'all 0.12s ease',
              userSelect: 'none',
            }}
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${selected ? 'rgba(255,255,255,0.5)' : '#D4D0CB'}`,
              backgroundColor: selected ? 'rgba(255,255,255,0.2)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />}
              {!selected && <span style={{ fontSize: '11px', fontWeight: 700, color: '#A8A29E' }}>{i + 1}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: selected ? 'white' : '#111', marginBottom: '2px' }}>
                {t.name}
              </div>
              <div style={{
                fontSize: '12px', color: selected ? 'rgba(255,255,255,0.6)' : '#A8A29E',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.subject}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
