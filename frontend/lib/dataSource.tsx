'use client'

/**
 * lib/dataSource.tsx
 *
 * Provides a React context that tracks whether the app is using
 * mock data or real UN WPP data. Wrap your root layout or page with
 * <DataSourceProvider> and consume with useDataSource() anywhere.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

interface DataSourceCtx {
  /** True when signals are unavailable (i.e. UN source with no model run yet) */
  noSignals: boolean
  setSignalsAvailable: (available: boolean) => void
}

const Ctx = createContext<DataSourceCtx | null>(null)

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [signalsAvailable, setSignalsAvailable] = useState(false)

  const noSignals = !signalsAvailable

  return (
    <Ctx.Provider value={{ noSignals, setSignalsAvailable }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDataSource(): DataSourceCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDataSource must be used inside <DataSourceProvider>')
  return ctx
}