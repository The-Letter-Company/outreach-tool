'use client'

interface TopBarProps {
  current: number
  total: number
}

export default function TopBar({ current, total }: TopBarProps) {
  return (
    <div
      style={{
        height: '48px',
        borderBottom: '1px solid #E5E5E5',
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontVariant: 'small-caps',
          fontSize: '15px',
          fontWeight: 600,
          color: '#111',
          letterSpacing: '0.05em',
        }}
      >
        Outreach
      </span>
      <span style={{ fontSize: '12px', color: '#666' }}>
        {current} / {total} prospects
      </span>
    </div>
  )
}
