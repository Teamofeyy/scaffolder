import type { AxeResults, RunOptions } from "axe-core"

declare global {
  interface Window {
    axe: {
      run(context?: Element | Document, options?: RunOptions): Promise<AxeResults>
    }
  }
}

export {}
