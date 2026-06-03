import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OSPI - Open Signal Population Index",
  description: "A visualization of the Open Signal Population Index (OSPI) across different countries, showing the divergence between mobile signal coverage and population distribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          #ospi-boot-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0;
            background: rgba(255,255,255,0.72);
            backdrop-filter: blur(18px) saturate(1.6);
            -webkit-backdrop-filter: blur(18px) saturate(1.6);

          }
          @media (prefers-color-scheme: dark) {
            #ospi-boot-overlay { background: rgba(9,9,11,0.78); }
          }
          #ospi-boot-overlay.ospi-hidden {
            opacity: 0;
            pointer-events: none;
          }
          .ospi-boot-bar {
            width: 3px;
            border-radius: 99px;
            transform-origin: bottom center;
            animation: ospi-boot-pulse 1.1s ease-in-out infinite;
          }
          @keyframes ospi-boot-pulse {
            0%,100% { opacity: 0.15; transform: scaleY(0.4); }
            50%      { opacity: 1;   transform: scaleY(1);   }
          }
          .ospi-boot-wordmark {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: rgb(24,24,27);
            margin-top: 20px;
          }
          @media (prefers-color-scheme: dark) {
            .ospi-boot-wordmark { color: rgb(244,244,245); }
          }
          .ospi-boot-sub {
            margin: 6px 0 28px;
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: rgb(113,113,122);
          }
          .ospi-boot-track {
            width: 120px;
            height: 1.5px;
            border-radius: 99px;
            background: rgba(113,113,122,0.18);
            overflow: hidden;
            position: relative;
          }
          .ospi-boot-shimmer {
            position: absolute;
            top: 0;
            left: -40%;
            width: 40%;
            height: 100%;
            border-radius: 99px;
            background: #1D9E75;
            animation: ospi-boot-shimmer 1.4s ease-in-out infinite;
          }
          @keyframes ospi-boot-shimmer {
            0%   { left: -40%; }
            100% { left: 110%; }
          }
          .ospi-boot-label {
            margin: 14px 0 0;
            font-size: 10px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgb(161,161,170);
          }
        ` }} />
      </head>
      <body className="min-h-full flex flex-col">

        {/* Boot overlay — visible from first paint, dismissed by LoadingOverlay.tsx */}
        <div id="ospi-boot-overlay" aria-label="Loading" role="status">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '28px' }}>
            {([
              { h: 8,  delay: '0s',    col: '#1D9E75' },
              { h: 14, delay: '0.15s', col: '#1D9E75' },
              { h: 20, delay: '0.3s',  col: '#1D9E75' },
              { h: 26, delay: '0.45s', col: '#1D9E75' },
              { h: 28, delay: '0.6s',  col: '#d1d5db' },
            ] as const).map((b, i) => (
              <div
                key={i}
                className="ospi-boot-bar"
                style={{ height: b.h, background: b.col, animationDelay: b.delay }}
              />
            ))}
          </div>
          <p className="ospi-boot-wordmark">OSPI</p>
          <p id="ospi-overlay-title" className="ospi-boot-sub">Open Signal Population Index</p>
          <div className="ospi-boot-track">
            <div className="ospi-boot-shimmer" />
          </div>
          <p id="ospi-overlay-subtitle" className="ospi-boot-label">Fetching population signals…</p>
        </div>

        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}