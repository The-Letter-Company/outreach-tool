'use client'

import { Company, Contact } from '@/types'

interface ProspectCardProps {
  company: Company
  contact: Contact
}

function formatRaised(amount: number): string {
  const millions = amount / 1_000_000
  return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
}

function scoreColor(score: number): string {
  if (score > 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export default function ProspectCard({ company, contact }: ProspectCardProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '20px', fontWeight: 600, color: '#111' }}>{company.name}</span>
        <span
          style={{
            fontSize: '11px',
            color: '#444',
            backgroundColor: '#F0F0F0',
            borderRadius: '20px',
            padding: '2px 8px',
            fontWeight: 500,
          }}
        >
          {company.stage}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>{formatRaised(company.raised)} raised</span>
        <span style={{ fontSize: '12px', color: '#666' }}>{company.employees} employees</span>
      </div>

      <div style={{ borderTop: '1px solid #E5E5E5', marginBottom: '14px' }} />

      <div style={{ marginBottom: '2px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#111', marginBottom: '2px' }}>
          {contact.name}
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>{contact.title}</div>
        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{contact.email}</div>
      </div>

      <div style={{ borderTop: '1px solid #E5E5E5', margin: '14px 0' }} />

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Blog Score
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111' }}>{company.blogScore}</span>
        </div>
        <div
          style={{
            height: '4px',
            width: '100%',
            backgroundColor: '#E5E5E5',
            borderRadius: '2px',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${company.blogScore}%`,
              backgroundColor: scoreColor(company.blogScore),
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', margin: 0, lineHeight: '1.5' }}>
          {company.blogScoreReason}
        </p>
      </div>
    </div>
  )
}
