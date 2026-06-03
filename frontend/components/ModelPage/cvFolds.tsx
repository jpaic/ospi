import { useState } from 'react'
import type { CvResult } from './types'

function r2Color(r2: number | null): string {
  if (r2 == null) return '#71717a'
  if (r2 >= 0.85) return '#1D9E75'
  if (r2 >= 0.75) return '#EF9F27'
  return '#E24B4A'
}

function rmseColor(rmse: number, maxRmse: number): string {
  const ratio = rmse / maxRmse
  if (ratio <= 0.5) return '#1D9E75'
  if (ratio <= 0.75) return '#EF9F27'
  return '#E24B4A'
}

export function CvFolds({ cv }: { cv: CvResult }) {
  const [showRmse, setShowRmse] = useState(false)

  const maxRmse = Math.max(...cv.rmse_by_fold, 0.001)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[9px] uppercase tracking-wider text-zinc-400">Metric</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono transition-colors ${showRmse ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>R²</span>
          <button role="switch" aria-checked={showRmse} onClick={() => setShowRmse(v => !v)}
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showRmse ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform shadow-sm ${showRmse ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
          </button>
          <span className={`text-[10px] font-mono transition-colors ${showRmse ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}`}>RMSE</span>
        </div>
      </div>
      {cv.r2_by_fold.map((r2, i) => {
        const rmse = cv.rmse_by_fold[i]
        const isActive = showRmse
        const value = isActive ? rmse : r2
        const maxVal = isActive ? maxRmse : 1
        const color = isActive ? rmseColor(rmse, maxRmse) : r2Color(r2)

        return (
          <div key={i} className="flex items-center gap-3 py-1 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
            <span className="text-[10px] text-zinc-400 w-14 shrink-0">Fold {i + 1}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.max((value / maxVal) * 100, 2)}%`,
                  background: color,
                }} />
              </div>
            </div>
            <span className="text-[10px] font-mono w-20 text-right transition-colors" style={{ color }}>
              {isActive ? `RMSE=${value.toFixed(3)}` : `R²=${value.toFixed(3)}`}
            </span>
            <span className={`text-[10px] font-mono w-20 text-right transition-colors ${isActive ? 'text-zinc-400' : 'text-zinc-400'}`}>
              {isActive ? `R²=${r2.toFixed(3)}` : `RMSE=${rmse.toFixed(3)}`}
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-[10px] text-zinc-500 w-14 shrink-0 font-medium">Mean</span>
        <div className="flex-1" />
        <span className="text-[10px] font-mono w-20 text-right transition-colors" style={{ color: showRmse ? '#71717a' : r2Color(cv.cv_r2_mean) }}>
          Ø {showRmse ? 'RMSE' : 'R²'}={(showRmse ? cv.cv_rmse_mean : cv.cv_r2_mean).toFixed(3)}
        </span>
        <span className={`text-[10px] font-mono w-20 text-right transition-colors ${showRmse ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Ø {showRmse ? 'R²' : 'RMSE'}={(showRmse ? cv.cv_r2_mean : cv.cv_rmse_mean).toFixed(3)}
        </span>
      </div>
    </div>
  )
}
