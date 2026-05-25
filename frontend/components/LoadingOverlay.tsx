'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  visible: boolean
}

/**
 * Full-screen frosted-glass loading overlay.
 *
 * - Renders on top of the entire app while `visible` is true.
 * - When `visible` flips to false it plays a smooth fade-out,
 *   then removes itself from the DOM so it never blocks interaction.
 */
export default function LoadingOverlay({ visible }: Props) {
  // `mounted` keeps the DOM node alive during the fade-out animation.
  const [mounted, setMounted] = useState(true)
  // `fading` triggers the CSS transition.
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) {
      // Start fade after a tiny delay so the transition is always seen
      // even if data loads near-instantly from cache.
      timerRef.current = setTimeout(() => {
        setFading(true)
        // Unmount after the CSS transition finishes (700 ms).
        timerRef.current = setTimeout(() => setMounted(false), 700)
      }, 500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible])

  if (!mounted) return null

  return (
    <>
      <style>{`
        @keyframes ospi-pulse {
          0%, 100% { opacity: 0.15; transform: scaleY(0.4); }
          50%       { opacity: 1;    transform: scaleY(1);   }
        }
        @keyframes ospi-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes ospi-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .ospi-bar {
          width: 3px;
          border-radius: 99px;
          transform-origin: bottom center;
          animation: ospi-pulse 1.1s ease-in-out infinite;
        }
        .ospi-overlay {
          animation: ospi-fade-in 0.3s ease forwards;
          transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1),
                      backdrop-filter 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ospi-overlay.fading {
          opacity: 0 !important;
          backdrop-filter: blur(0px) !important;
        }
      `}</style>

      <div
        className={`ospi-overlay${fading ? ' fading' : ''}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          backdropFilter: 'blur(18px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
          background: 'rgba(255,255,255,0.72)',
        }}
      >
        {/* Dark-mode surface */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            .ospi-overlay { background: rgba(9,9,11,0.78) !important; }
          }
        `}</style>

        {/* ── Signal-bar icon ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 4,
            height: 28,
            marginBottom: 20,
          }}
          aria-hidden="true"
        >
          {[
            { h: 8,  delay: '0s',    color: '#1D9E75' },
            { h: 14, delay: '0.15s', color: '#1D9E75' },
            { h: 20, delay: '0.3s',  color: '#1D9E75' },
            { h: 26, delay: '0.45s', color: '#1D9E75' },
            { h: 28, delay: '0.6s',  color: '#d1d5db' },
          ].map((bar, i) => (
            <div
              key={i}
              className="ospi-bar"
              style={{
                height: bar.h,
                background: bar.color,
                animationDelay: bar.delay,
              }}
            />
          ))}
        </div>

        {/* ── Wordmark ── */}
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgb(24 24 27)',
          }}
        >
          <style>{`@media (prefers-color-scheme: dark) { .ospi-wm { color: rgb(244 244 245) !important; } }`}</style>
          <span className="ospi-wm" style={{ color: 'inherit' }}>OSPI</span>
        </p>

        {/* ── Subtitle ── */}
        <p
          style={{
            margin: '6px 0 28px',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgb(113 113 122)',
          }}
        >
          Open Signal Population Index
        </p>

        {/* ── Progress track ── */}
        <div
          style={{
            width: 120,
            height: 1.5,
            borderRadius: 99,
            background: 'rgba(113,113,122,0.18)',
            overflow: 'hidden',
            position: 'relative',
          }}
          aria-label="Loading"
          role="progressbar"
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-40%',
              width: '40%',
              height: '100%',
              borderRadius: 99,
              background: '#1D9E75',
              animation: 'ospi-shimmer 1.4s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes ospi-shimmer {
              0%   { left: -40%; }
              100% { left: 110%; }
            }
          `}</style>
        </div>

        {/* ── Status label ── */}
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgb(161 161 170)',
          }}
        >
          Fetching population signals…
        </p>
      </div>
    </>
  )
}