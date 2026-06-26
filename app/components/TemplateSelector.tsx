'use client'

import { templates } from '@/data/templates'

interface TemplateSelectorProps {
  selectedId: string | undefined
  onSelect: (id: string) => void
}

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {templates.map((t) => {
        const selected = t.id === selectedId
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: '8px 14px',
              fontSize: '13px', fontWeight: 600,
              border: `1.5px solid ${selected ? '#111' : '#E7E5E4'}`,
              borderRadius: '8px', cursor: 'pointer',
              backgroundColor: selected ? '#111' : 'white',
              color: selected ? 'white' : '#111',
              fontFamily: 'inherit',
              transition: 'all 0.12s ease',
              userSelect: 'none',
            }}
          >
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
