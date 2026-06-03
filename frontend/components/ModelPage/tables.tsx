import { fmt, fmtPct } from '@/lib/fmt'
import type { ScatterPoint } from './types'

function r2Color(r2: number | null): string {
  if (r2 == null) return '#71717a'
  if (r2 >= 0.85) return '#1D9E75'
  if (r2 >= 0.75) return '#EF9F27'
  return '#E24B4A'
}

export function OutliersTable({ data }: { data: ScatterPoint[] }) {
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
            <th className="text-left py-1.5 pr-2 font-medium">Country</th>
            <th className="text-right px-2 font-medium">Official</th>
            <th className="text-right px-2 font-medium">OSPI</th>
            <th className="text-right px-2 font-medium">Residual</th>
            <th className="text-right pl-2 font-medium">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.iso2} className="border-b border-zinc-50 dark:border-zinc-900">
              <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{d.name}</span>
                <span className="text-zinc-300 dark:text-zinc-700 ml-1">({d.iso2})</span>
              </td>
              <td className="text-right px-2 font-mono text-zinc-500">{fmt(d.official)}</td>
              <td className="text-right px-2 font-mono text-zinc-500">{fmt(d.ospi)}</td>
              <td className="text-right px-2 font-mono" style={{ color: r2Color(1 - d.residual) }}>
                {d.residual.toFixed(4)}
              </td>
              <td className="text-right pl-2 font-mono"
                style={{ color: d.residual_pct >= 0 ? '#1D9E75' : '#E24B4A' }}>
                {fmtPct(d.residual_pct, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RegionCoefs({ coefs }: { coefs: Record<string, number> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(coefs).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">{k}</span>
          <span className="font-mono" style={{ color: v >= 0 ? '#1D9E75' : '#E24B4A' }}>
            {v >= 0 ? '+' : ''}{v.toFixed(6)}
          </span>
        </div>
      ))}
    </div>
  )
}
