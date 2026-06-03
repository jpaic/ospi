export function StatCard({ label, value, color, sub }: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-base font-semibold font-mono mt-0.5" style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-zinc-300 dark:text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">{title}</h2>
      {subtitle && (
        <p className="text-[9px] text-zinc-300 dark:text-zinc-700 mt-0.5 tracking-wider">
          {subtitle}
        </p>
      )}
    </div>
  )
}
