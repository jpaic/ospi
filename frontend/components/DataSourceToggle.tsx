'use client'

import { useDataSource } from '@/lib/dataSource'

export default function DataSourceToggle() {
  const { source, toggle, noSignals } = useDataSource()
  const isUn = source === 'un'

  return (
    <div className="flex items-center gap-2">
      {/* Label */}
      <span className="text-[9px] uppercase tracking-wider text-zinc-400">
        Source
      </span>

      {/* Pill toggle */}
      <button
        onClick={toggle}
        className="relative flex items-center h-5 rounded-full px-0.5 transition-colors duration-200 focus:outline-none"
        style={{
          width: 72,
          background: isUn ? '#1D9E75' : 'rgba(113,113,122,0.25)',
        }}
        title={isUn ? 'Switch to mock data' : 'Switch to UN WPP data'}
      >
        {/* Track labels */}
        <span
          className="absolute left-1.5 text-[8px] font-semibold uppercase tracking-wider transition-opacity duration-150"
          style={{ color: '#fff', opacity: isUn ? 0 : 0.7 }}
        >
          Mock
        </span>
        <span
          className="absolute right-1.5 text-[8px] font-semibold uppercase tracking-wider transition-opacity duration-150"
          style={{ color: '#fff', opacity: isUn ? 0.9 : 0 }}
        >
          UN
        </span>

        {/* Thumb */}
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: isUn ? 'translateX(52px)' : 'translateX(0px)' }}
        />
      </button>

      {/* Warning pill when signals are absent */}
      {noSignals && (
        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
          no signals
        </span>
      )}
    </div>
  )
}