'use client'
import Link from 'next/link'
import { showNavOverlay } from '@/lib/navigation'

interface Props { active: 'dashboard' | 'model'; onMenuClick?: () => void }

const linkBase = 'text-xs px-3 py-1.5 rounded-md transition-colors'
const linkActive = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium'
const linkInactive = 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'

export default function NavHeader({ active, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-[45] flex items-center gap-2 sm:gap-4 px-2 sm:px-4 h-11 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
      {active === 'dashboard' && onMenuClick && (
        <button onClick={onMenuClick} className="xl:hidden p-1.5 -ml-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-500">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <span className="text-xs font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300 shrink-0">
        OSPI
      </span>
      <nav className="flex items-center gap-1 mx-auto">
        <Link href="/dashboard" onClick={() => active !== 'dashboard' && showNavOverlay('Dashboard', 'Loading country data…')} className={`${linkBase} ${active === 'dashboard' ? linkActive : linkInactive}`}>
          Dashboard
        </Link>
        <Link href="/model" onClick={() => active !== 'model' && showNavOverlay('Model', 'Loading model diagnostics…')} className={`${linkBase} ${active === 'model' ? linkActive : linkInactive}`}>
          Model
        </Link>
      </nav>
      <a href="https://github.com/jpaic/ospi" target="_blank" rel="noopener noreferrer"
        className="text-[10px] text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0">
        Github
      </a>
    </header>
  )
}
