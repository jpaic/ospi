/**
 * Smart population / number formatter.
 * All `millions` inputs are in millions (e.g. 8100 = 8.1 billion).
 *
 * fmt(8100)  → "8.10B"
 * fmt(340)   → "340.00M"
 * fmt(0.42)  → "420.00K"
 * fmtPct(2.3456, true) → "+2.35%"
 */

export function fmt(millions: number): string {
  if (millions >= 1_000) {
    return (millions / 1_000).toFixed(2) + 'B'
  }
  if (millions >= 1) {
    return millions.toFixed(2) + 'M'
  }
  return (millions * 1_000).toFixed(2) + 'K'
}

export function fmtB(billions: number): string {
  return billions.toFixed(2) + 'B'
}

export function fmtGap(millions: number): string {
  return fmt(Math.abs(millions))
}

export function fmtPct(pct: number, sign = false): string {
  const s = sign && pct > 0 ? '+' : ''
  return s + pct.toFixed(2) + '%'
}

export function fmtUsd(value: number): string {
  return '$' + value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function fmtDensity(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' /km²'
}