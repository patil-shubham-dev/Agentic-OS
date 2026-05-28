import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { SafeErrorBoundary } from '@/core/error-boundaries'
import { persistSettings } from './lib/settings-store'
import { persistLedger } from './lib/ledger'
import { useLedgerStore } from './stores/ledger-store'
import { useAppStore } from './stores/app-store'
import { useWorkspaceRuntime } from './runtime/workspace-runtime'
import { useTimelineStore } from './components/workspace/timeline/timeline-store'
import { cancelPendingRefresh } from './runtime/runtime-coordinator'
import { bootRuntime, shutdownRuntime, getKernel } from './core/kernel/startup'
import { isInSafeMode } from './core/crash-handling/safe-mode'
import { PrefetchScheduler } from './runtime/prefetch/prefetch-scheduler'
import { RuntimeCleanupManager } from './runtime/RuntimeCleanupManager'
import { tauriFetch } from '@agentic-os/providers/http-client'
import './index.css'

window.addEventListener('error', (e) => {
  console.error('[GLOBAL_ERROR]', e.error?.message || e.message, e.error?.stack || '')
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED_PROMISE]', e.reason?.message || String(e.reason), e.reason?.stack || '')
})

function useDebouncedPersist(delay = 2000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const schedule = () => {
    cancel()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      persistSettings()
    }, delay)
  }

  useEffect(() => {
    return cancel
  }, [])

  return { schedule, cancel }
}

function Root() {
  const [ready, setReady] = useState(false)
  const initGuard = useRef(false)
  const { schedule: schedulePersist, cancel: cancelPersist } = useDebouncedPersist()

  useEffect(() => {
    if (initGuard.current) return
    initGuard.current = true

    const unsubs: (() => void)[] = []
    let cancelled = false

    const init = async () => {
      // Phase 1: platform info
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const info: { first_launch: boolean } = await invoke('get_install_info')
        sessionStorage.setItem('first-launch', String(info.first_launch))
      } catch {
        sessionStorage.setItem('first-launch', 'false')
      }

      // Phase 2: kernel boot (orchestrates all services)
      const report = await bootRuntime()
      if (!report.success) {
        console.error('[Boot] Kernel boot DEGRADED — some services failed')
      }

      // Phase 3: warm providers (fire-and-forget via PrefetchScheduler)
      if (!cancelled && !isInSafeMode()) {
        const prefetchScheduler = PrefetchScheduler.getInstance()
        const providers = useAppStore.getState().providers
        for (const p of providers) {
          if (p.apiKey) {
            const warmUrl = p.isOpenAiCompatible
              ? `${p.baseUrl.replace(/\/+$/, '')}/v1/models`
              : p.baseUrl
            prefetchScheduler.enqueue({
              id: `warm-provider:${p.id}`,
              priority: "low",
              label: `Warm provider ${p.name}`,
              execute: async () => {
                await tauriFetch(warmUrl, {
                  method: 'GET',
                  headers: { Authorization: `Bearer ${p.apiKey}` },
                  signal: AbortSignal.timeout(4000),
                })
              },
            })
          }
        }
      }

      // Phase 4: attach subscriptions (only if not cancelled)
      if (!cancelled) {
        unsubs.push(
          useAppStore.subscribe(() => {
            schedulePersist()
          }),
        )
        unsubs.push(
          useLedgerStore.subscribe(() => {
            persistLedger()
          }),
        )
      }

      // Always mark ready once boot completes — the cancelled check above only
      // guards subscription setup. setReady is safe to call after cleanup (React
      // ignores state updates from unmounted components). This prevents the app
      // from staying blank forever under React 18 StrictMode.
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      for (const unsub of unsubs) unsub()
      cancelPersist()
      cancelPendingRefresh()
      // Clear volatile UI state (timeline/streams — ensures fresh chat on next launch)
      useTimelineStore.getState().clear()
      // Graceful shutdown: clean all runtime resources (streams, tasks, sessions, event listeners)
      RuntimeCleanupManager.getInstance().shutdown().catch((err) => {
        console.error('[Cleanup] Shutdown error:', err)
      })
      shutdownRuntime()
    }
  }, [])

  if (!ready) return null

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SafeErrorBoundary name="Root">
        <Root />
      </SafeErrorBoundary>
    </HashRouter>
  </StrictMode>,
)
