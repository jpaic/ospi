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

export type DataSource = 'mock' | 'un'

interface DataSourceCtx {
  source:    DataSource
  toggle:    () => void
  isMock:    boolean
  isUn:      boolean
  /** True when signals are unavailable (i.e. UN source with no model run yet) */
  noSignals: boolean
}

const Ctx = createContext<DataSourceCtx | null>(null)

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<DataSource>('mock')

  const toggle = useCallback(() => {
    setSource(s => s === 'mock' ? 'un' : 'mock')
  }, [])

  const isMock    = source === 'mock'
  const isUn      = source === 'un'
  const noSignals = isUn   // extend this check later when your model populates signals

  return (
    <Ctx.Provider value={{ source, toggle, isMock, isUn, noSignals }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDataSource(): DataSourceCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDataSource must be used inside <DataSourceProvider>')
  return ctx
}