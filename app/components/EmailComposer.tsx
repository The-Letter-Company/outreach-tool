'use client'

import { useEffect, useRef, useState } from 'react'
import { Prospect } from '@/types'
import { templates } from '@/data/templates'

interface EmailComposerProps {
  prospect: Prospect
  selectedTemplateId: string | undefined
  copied: boolean
  setCopied: (v: boolean) => void
  videoFilename: string | null
}

function buildEmail(
  templateId: string | undefined,
  prospect: Prospect,
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
      .replace(/\[VIDEO\]/g, videoLine)

  return { subject: replace(template.subject), body: replace(template.body) }
}

export default function EmailComposer({
  prospect,
  selectedTemplateId,
  copied,
  setCopied,
  videoFilename,
}: EmailComposerProps) {
  const derived = buildEmail(selectedTemplateId, prospect, videoFilename)

  const [subject, setSubject] = useState(derived?.subject ?? '')
  const [body, setBody] = useState(derived?.body ?? '')
  const [dirty, setDirty] = useState(false)
  const prevTemplateId = useRef(selectedTemplateId)
  const prevProspectId = useRef(prospect.company.id)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // When prospect changes, always reset
  useEffect(() => {
    if (prospect.company.id !== prevProspectId.current) {
      prevProspectId.current = prospect.company.id
      if (derived) {
        setSubject(derived.subject)
        setBody(derived.body)
        setDirty(false)
      }
    }
  })

  // When template changes, confirm if dirty
  useEffect(() => {
    if (selectedTemplateId === prevTemplateId.current) return
    const newDerived = buildEmail(selectedTemplateId, prospect, videoFilename)
    if (!newDerived) {
      prevTemplateId.current = selectedTemplateId
      return
    }
    if (dirty) {
      const confirmed = window.confirm('Replace with template? Your edits will be lost.')
      if (!confirmed) {
        // Can't revert selectedTemplateId from here — caller owns it.
        // Just keep current text and mark the ref so we don't re-prompt.
        prevTemplateId.current = selectedTemplateId
        return
      }
    }
    prevTemplateId.current = selectedTemplateId
    setSubject(newDerived.subject)
    setBody(newDerived.body)
    setDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  // Keep video line in sync when not dirty
  useEffect(() => {
    if (!dirty && derived) {
      setSubject(derived.subject)
      setBody(derived.body)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFilename])

  function autoResize() {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  async function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`
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

  if (!derived && !selectedTemplateId) {
    return (
      <div style={{
        border: '1.5px dashed #EDE9DC', borderRadius: '8px',
        padding: '24px 16px', fontSize: '13px', color: 'rgba(32,30,31,0.3)', textAlign: 'center',
      }}>
        Select a template above to preview the email
      </div>
    )
  }

  return (
    <div>
      <div style={{
        border: '1px solid #EDE9DC', borderRadius: '8px',
        overflow: 'hidden', marginBottom: '10px',
      }}>
        {/* Subject */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', borderBottom: '1px solid #EDE9DC',
          backgroundColor: '#FFFFFF',
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(32,30,31,0.38)', flexShrink: 0 }}>Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setDirty(true) }}
            style={{
              flex: 1, fontSize: '13px', fontWeight: 500, color: '#201E1F',
              border: 'none', outline: 'none', backgroundColor: 'transparent',
              fontFamily: 'var(--font-sans)', padding: 0,
            }}
          />
        </div>

        {/* Body */}
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); setDirty(true) }}
          onInput={autoResize}
          style={{
            display: 'block', width: '100%', minHeight: '180px',
            fontSize: '12px', fontFamily: 'ui-monospace, monospace',
            color: '#201E1F', lineHeight: '1.7',
            border: 'none', outline: 'none', backgroundColor: '#FAFAF7',
            resize: 'vertical', padding: '12px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {dirty && (
        <button
          onClick={() => {
            if (derived) {
              setSubject(derived.subject)
              setBody(derived.body)
              setDirty(false)
            }
          }}
          style={{
            width: '100%', backgroundColor: 'transparent', color: 'rgba(32,30,31,0.4)',
            fontSize: '12px', fontWeight: 500, border: '1px solid #EDE9DC',
            borderRadius: '8px', padding: '7px 0', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', marginBottom: '8px',
          }}
        >
          Reset to template
        </button>
      )}

      <button
        onClick={handleCopy}
        style={{
          width: '100%', backgroundColor: copied ? '#2D7A45' : '#EE724A',
          color: '#FFFFF8', fontSize: '14px', fontWeight: 600,
          border: 'none', borderRadius: '8px', padding: '11px 0',
          cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background-color 0.2s',
        }}
      >
        {copied ? '✓ Copied to clipboard' : 'Copy Email'}
      </button>
    </div>
  )
}
