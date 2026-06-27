import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Letterstory Outreach',
  description: 'Letterstory B2B outreach review tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const missingKeys = [
    !process.env.APOLLO_API_KEY && 'APOLLO_API_KEY',
    !process.env.HUNTER_API_KEY && 'HUNTER_API_KEY',
  ].filter(Boolean) as string[]

  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {missingKeys.length > 0 && (
          <div
            role="alert"
            style={{
              backgroundColor: '#FEFCE8',
              borderBottom: '1px solid #FDE68A',
              padding: '8px 20px',
              fontSize: '12px',
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <span>⚠</span>
            <span>
              Add {missingKeys.join(' and ')} to <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>.env.local</code> to enable auto-sourcing.
            </span>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      </body>
    </html>
  )
}
