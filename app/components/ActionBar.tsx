'use client'

interface ActionBarProps {
  onArchive: () => void
  onDrafted: () => void
}

export default function ActionBar({ onArchive, onDrafted }: ActionBarProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={onArchive}
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 500,
            color: '#666',
            backgroundColor: 'white',
            border: '1px solid #E5E5E5',
            borderRadius: '4px',
            padding: '9px 0',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.borderColor = '#999')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.borderColor = '#E5E5E5')}
        >
          Archive
        </button>
        <button
          onClick={onDrafted}
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 500,
            color: 'white',
            backgroundColor: '#111',
            border: '1px solid #111',
            borderRadius: '4px',
            padding: '9px 0',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        >
          Mark Drafted
        </button>
      </div>
      <p
        style={{
          fontSize: '11px',
          color: '#999',
          textAlign: 'center',
          margin: 0,
        }}
      >
        A to archive · D to mark drafted · 1–3 for templates
      </p>
    </div>
  )
}
