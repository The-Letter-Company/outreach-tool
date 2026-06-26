'use client'

import { useEffect, useRef, useState } from 'react'

interface VideoRecorderProps {
  companyName: string
  onRecorded?: (filename: string) => void
}

function formatTime(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function VideoRecorder({ companyName, onRecorded }: VideoRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const dateStr = new Date().toISOString().slice(0, 10)
        const filename = `outreach-${companyName.toLowerCase().replace(/\s+/g, '-')}-${dateStr}.webm`
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        stream.getTracks().forEach((t) => t.stop())
        setElapsed(0)
        onRecorded?.(filename)
      }

      stream.getVideoTracks()[0].onended = () => stopRecording()

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setElapsed(0)
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch {
      // user denied or unsupported
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setRecording(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {recording ? (
        <>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              flexShrink: 0,
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
            {formatTime(elapsed)}
          </span>
          <button
            onClick={stopRecording}
            style={{
              fontSize: '11px',
              color: '#666',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              fontFamily: 'inherit',
            }}
          >
            ◼ Stop
          </button>
        </>
      ) : (
        <button
          onClick={startRecording}
          style={{
            fontSize: '11px',
            color: '#666',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            fontFamily: 'inherit',
          }}
        >
          ⏺ Record
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
