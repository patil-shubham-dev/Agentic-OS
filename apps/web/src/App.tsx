import { Routes, Route } from 'react-router-dom'
import { AppShell, RouteContainer } from '@/core/routing'
import { SafeErrorBoundary } from '@/core/error-boundaries'
import { ControlCenterPage } from '@/pages/control-center'
import { CodeCanvasPage } from '@/pages/code-canvas'
import { SettingsPage } from '@/pages/settings'
import { MobileGatewayPage } from '@/pages/mobile-gateway'
import { InstallPanel } from '@/pages/install-panel'
import { UpdatePanel } from '@/pages/update-panel'
import { ResetPanel } from '@/pages/reset-panel'
import { OnboardingPage } from '@/pages/onboarding'
import { AgentsPage } from '@/pages/agents'
import { LogsPage } from '@/pages/logs'
import { GitPage } from '@/pages/git'
import { RuntimeHealthPanel } from '@/components/runtime/RuntimeHealthPanel'
import { StressTestPage } from '@/pages/__stress-test'
import { useLeakTracker } from '@/performance/leak-detector'
import { useRenderEngine } from '@/runtime/render-engine/use-render-engine'
import { useEffect } from 'react'

export default function App() {
  useLeakTracker("App")
  useRenderEngine()

  useEffect(() => {
    const firstLaunch = sessionStorage.getItem('first-launch') === 'true'
    if (firstLaunch) {
      sessionStorage.setItem('opencode-welcome', 'true')
      sessionStorage.setItem('first-launch', 'false')
    }
  }, [])

  return (
    <SafeErrorBoundary name="Application">
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RouteContainer><ControlCenterPage /></RouteContainer>} />
          <Route path="/control-center" element={<RouteContainer><ControlCenterPage /></RouteContainer>} />
          <Route path="/code-canvas" element={<RouteContainer><CodeCanvasPage /></RouteContainer>} />
          <Route path="/mobile-gateway" element={<RouteContainer><MobileGatewayPage /></RouteContainer>} />
          <Route path="/settings" element={<RouteContainer><SettingsPage /></RouteContainer>} />
          <Route path="/settings/install" element={<RouteContainer><InstallPanel /></RouteContainer>} />
          <Route path="/settings/update" element={<RouteContainer><UpdatePanel /></RouteContainer>} />
          <Route path="/settings/reset" element={<RouteContainer><ResetPanel /></RouteContainer>} />
          <Route path="/agents" element={<RouteContainer><AgentsPage /></RouteContainer>} />
          <Route path="/logs" element={<RouteContainer><LogsPage /></RouteContainer>} />
          <Route path="/git" element={<RouteContainer><GitPage /></RouteContainer>} />
          {import.meta.env.DEV && (
            <>
              <Route path="/__health" element={<RuntimeHealthPanel />} />
              <Route path="/__stress" element={<StressTestPage />} />
            </>
          )}
        </Route>
        <Route path="/onboarding" element={<OnboardingPage onComplete={() => window.history.back()} />} />
      </Routes>
    </SafeErrorBoundary>
  )
}
