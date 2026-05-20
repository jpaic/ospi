'use client'

import { useDataSource } from '@/lib/dataSource'

export default function DataSourceToggle() {
  const { source, toggle, noSignals } = useDataSource()
  const isUn = source === 'un'

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wider text-zinc-400">
        Source
      </span>

      <button
        onClick={toggle}
        className="relative flex items-center h-5 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer"
        style={{
          width: 72,
          background: isUn ? '#1D9E75' : 'rgba(113,113,122,0.25)',
        }}
        title={isUn ? 'Switch to mock data' : 'Switch to UN WPP data'}
      >
        {/* Text labels */}
        <span
          className="absolute left-1.5 text-[8px] font-semibold uppercase tracking-wider transition-opacity duration-150 pointer-events-none select-none"
          style={{ 
            color: '#fff', 
            opacity: isUn ? 0 : 0.85,
            zIndex: 0
          }}
        >
          Mock
        </span>
        <span
          className="absolute right-1.5 text-[8px] font-semibold uppercase tracking-wider transition-opacity duration-150 pointer-events-none select-none"
          style={{ 
            color: '#fff', 
            opacity: isUn ? 0.85 : 0,
            zIndex: 0
          }}
        >
          UN
        </span>

        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ 
            transform: isUn ? 'translateX(0px)' : 'translateX(52px)',
            zIndex: 1
          }}
        />
      </button>

      {noSignals && (
        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
          no signals
        </span>
      )}
    </div>
  )
}