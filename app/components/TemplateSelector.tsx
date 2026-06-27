'use client'

import { templates } from '@/data/templates'

interface TemplateSelectorProps {
  selectedId: string | undefined
  onSelect: (id: string) => void
}

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', flexWrap: 'wrap' }}>
      {templates.map((t) => {
        const selected = t.id === selectedId
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: '6px 12px', fontSize: '10px', fontWeight: 600,
              border: `1px solid ${selected ? '#201E1F' : '#EDE9DC'}`,
              borderRadius: '999px', cursor: 'pointer',
              backgroundColor: selected ? '#201E1F' : 'transparent',
              color: selected ? '#FFFFF8' : 'rgba(32,30,31,0.45)',
              fontFamily: 'var(--font-sans)', transition: 'all 0.12s ease',
              userSelect: 'none', whiteSpace: 'nowrap',
            }}
          >
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
