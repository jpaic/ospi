'use client'

import { Component } from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-3 px-4">
          <div className="text-red-400 text-xs text-center max-w-md">
            Something went wrong
          </div>
          {this.state.error && (
            <pre className="text-[10px] text-zinc-400 max-w-md text-center truncate">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
