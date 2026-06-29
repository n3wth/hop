'use client'

// Global error boundary. This replaces the ROOT layout when the layout itself
// (or something above the page tree) throws, so it must be self-contained:
// it renders its own <html><body> and cannot rely on globals.css, fonts, or
// any component. Inline styles only, cream canvas, a terse message, a reload.
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: '#f3f1ec',
          color: '#14201f',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '34px',
            letterSpacing: '-0.02em',
            color: '#0d6e6e',
          }}
        >
          hop
        </div>

        <h1
          style={{
            marginTop: '20px',
            marginBottom: 0,
            fontSize: '26px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          Something broke.
        </h1>

        <p
          style={{
            marginTop: '12px',
            maxWidth: '44ch',
            fontSize: '16px',
            lineHeight: 1.55,
            color: '#4a5a58',
          }}
        >
          It&apos;s usually temporary — reload to try again.
        </p>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '28px',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '14px',
            background: '#0d6e6e',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 600,
            padding: '15px 28px',
          }}
        >
          Reload
        </button>

        {error.digest ? (
          <p style={{ marginTop: '24px', fontSize: '12px', color: '#5f6f6c' }}>
            Reference: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  )
}
