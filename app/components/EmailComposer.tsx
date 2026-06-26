'use client'

import { useEffect, useState } from 'react'
import { Prospect } from '@/types'
import { templates } from '@/data/templates'

interface EmailComposerProps {
  prospect: Prospect
  selectedTemplateId: string | undefined
  customLine: string
  onCustomLineChange: (val: string) => void
  copied: boolean
  setCopied: (v: boolean) => void
  videoFilename: string | null
}

function composeEmail(
  templateId: string | undefined,
  prospect: Prospect,
  customLine: string,
  videoFilename: string | null
): { subject: string; body: string } | null {
  const template = templates.find((t) => t.id === templateId)
  if (!template) return null

  const firstName = prospect.contact.name.split(' ')[0]
  const company = prospect.company.name

  const videoLine = videoFilename
    ? `🎥 Video walkthrough: [upload ${videoFilename} and paste link here]`
    : '🎥 Video walkthrough: [record a video using the ⏺ Record button]'

  const replace = (str: string) =>
    str
      .replace(/\[Company\]/g, company)
      .replace(/\[FirstName\]/g, firstName)
      .replace(/\[Sender\]/g, 'Matt')
      .replace(/\[CUSTOM_LINE\]/g, customLine || '[Write a custom line above...]')
      .replace(/\[VIDEO\]/g, videoLine)

  return {
    subject: replace(template.subject),
    body: replace(template.body),
  }
}

export default function EmailComposer({
  prospect,
  selectedTemplateId,
  customLine,
  onCustomLineChange,
  copied,
  setCopied,
  videoFilename,
}: EmailComposerProps) {
  const derived = composeEmail(selectedTemplateId, prospect, customLine, videoFilename)

  const [editedSubject, setEditedSubject] = useState(derived?.subject ?? '')
  const [editedBody, setEditedBody] = useState(derived?.body ?? '')
  const [dirty, setDirty] = useState(false)

  // When template changes, reset to derived — lose manual edits for the new template
  useEffect(() => {
    if (derived) {
      setEditedSubject(derived.subject)
      setEditedBody(derived.body)
      setDirty(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, prospect])

  // When customLine or video changes and user hasn't manually edited, keep in sync
  useEffect(() => {
    if (!dirty && derived) {
      setEditedSubject(derived.subject)
      setEditedBody(derived.body)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLine, videoFilename])

  async function handleCopy() {
    const text = `Subject: ${editedSubject}\n\n${editedBody}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        Custom line
      </div>
      <input
        type="text"
        value={customLine}
        onChange={(e) => onCustomLineChange(e.target.value)}
        placeholder="Write one specific line about their content..."
        style={{
          width: '100%', fontSize: '15px', color: '#111',
          border: '1.5px solid #E7E5E4', borderRadius: '8px',
          padding: '10px 13px', outline: 'none', fontFamily: 'inherit',
          boxSizing: 'border-box', backgroundColor: 'white', marginBottom: '12px',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#111')}
        onBlur={(e) => (e.target.style.borderColor = '#E7E5E4')}
      />

      {derived ? (
        <>
          <div style={{
            backgroundColor: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: '8px',
            padding: '14px', marginBottom: '12px',
          }}>
            {/* Subject line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#A8A29E', flexShrink: 0, fontFamily: 'inherit' }}>Subject:</span>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => { setEditedSubject(e.target.value); setDirty(true) }}
                style={{
                  flex: 1, fontSize: '12px', fontWeight: 600, color: '#57534E',
                  border: 'none', outline: 'none', backgroundColor: 'transparent',
                  fontFamily: 'ui-monospace, monospace', padding: '0',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ borderTop: '1px solid #F0EFED', paddingTop: '10px' }}>
              <textarea
                value={editedBody}
                onChange={(e) => { setEditedBody(e.target.value); setDirty(true) }}
                style={{
                  width: '100%', fontSize: '13px', fontFamily: 'ui-monospace, monospace',
                  color: '#44403C', lineHeight: '1.7', border: 'none', outline: 'none',
                  backgroundColor: 'transparent', resize: 'none', padding: '0',
                  boxSizing: 'border-box', minHeight: '220px',
                }}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }}
              />
            </div>
          </div>

          {dirty && (
            <button
              onClick={() => {
                if (derived) {
                  setEditedSubject(derived.subject)
                  setEditedBody(derived.body)
                  setDirty(false)
                }
              }}
              style={{
                width: '100%', backgroundColor: 'transparent', color: '#A8A29E',
                fontSize: '12px', fontWeight: 500, border: '1px solid #E7E5E4',
                borderRadius: '8px', padding: '7px 0', cursor: 'pointer',
                fontFamily: 'inherit', marginBottom: '8px',
              }}
            >
              Reset to template
            </button>
          )}

          <button
            onClick={handleCopy}
            style={{
              width: '100%', backgroundColor: copied ? '#16a34a' : '#1C1917',
              color: 'white', fontSize: '14px', fontWeight: 600,
              border: 'none', borderRadius: '8px', padding: '11px 0',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.2s',
            }}
          >
            {copied ? '✓ Copied to clipboard' : 'Copy Email'}
          </button>
        </>
      ) : (
        <div style={{
          border: '1.5px dashed #E7E5E4', borderRadius: '8px',
          padding: '24px 16px', fontSize: '14px', color: '#C4BFB9', textAlign: 'center',
        }}>
          Select a template above to preview the email
        </div>
      )}
    </div>
  )
}
