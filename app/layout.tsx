import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outreach',
  description: 'B2B outreach review tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', overflow: 'hidden' }}>{children}</body>
    </html>
  )
}
