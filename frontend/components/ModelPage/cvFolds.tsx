import type { CvResult } from './types'

function r2Color(r2: number | null): string {
  if (r2 == null) return '#71717a'
  if (r2 >= 0.85) return '#1D9E75'
  if (r2 >= 0.75) return '#EF9F27'
  return '#E24B4A'
}

export function CvFolds({ cv }: { cv: CvResult }) {
  return (
    <div className="space-y-2">
      {cv.r2_by_fold.map((r2, i) => {
        const rmse = cv.rmse_by_fold[i]
        return (
          <div key={i} className="flex items-center gap-3 py-1 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
            <span className="text-[10px] text-zinc-400 w-14 shrink-0">Fold {i + 1}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${Math.max(r2 * 100, 2)}%`,
                  background: r2Color(r2),
                }} />
              </div>
            </div>
            <span className="text-[10px] font-mono w-16 text-right" style={{ color: r2Color(r2) }}>
              R²={r2.toFixed(3)}
            </span>
            <span className="text-[10px] font-mono w-20 text-right text-zinc-400">
              RMSE={rmse.toFixed(3)}
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-[10px] text-zinc-500 w-14 shrink-0 font-medium">Mean</span>
        <div className="flex-1" />
        <span className="text-[10px] font-mono w-16 text-right" style={{ color: r2Color(cv.cv_r2_mean) }}>
          Ø R²={cv.cv_r2_mean.toFixed(3)}
        </span>
        <span className="text-[10px] font-mono w-20 text-right text-zinc-500">
          Ø RMSE={cv.cv_rmse_mean.toFixed(3)}
        </span>
      </div>
    </div>
  )
}
