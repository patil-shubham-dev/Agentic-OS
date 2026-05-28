const MODE_KEY = "agentic-os-runtime-mode"

export type RuntimeMode = "development" | "production"

export interface RuntimeModeConfig {
  mode: RuntimeMode

  assertions: boolean
  renderTracing: boolean
  leakDetection: boolean
  mutationTracing: boolean
  whyDidYouRender: boolean
  verboseLogs: boolean
  crashTelemetry: boolean
  performanceBudgets: boolean
  stressTesting: boolean
}

const DEV_CONFIG: RuntimeModeConfig = {
  mode: "development",

  assertions: true,
  renderTracing: true,
  leakDetection: true,
  mutationTracing: true,
  whyDidYouRender: true,
  verboseLogs: true,
  crashTelemetry: true,
  performanceBudgets: true,
  stressTesting: true,
}

const PROD_CONFIG: RuntimeModeConfig = {
  mode: "production",

  assertions: false,
  renderTracing: false,
  leakDetection: false,
  mutationTracing: false,
  whyDidYouRender: false,
  verboseLogs: false,
  crashTelemetry: true,
  performanceBudgets: false,
  stressTesting: false,
}

function detectMode(): RuntimeMode {
  if (import.meta.env.DEV) return "development"

  try {
    const stored = sessionStorage.getItem(MODE_KEY)
    if (stored === "development") return "development"
    if (stored === "production") return "production"
  } catch { /* sessionStorage may not be available */ }

  return "production"
}

let _config: RuntimeModeConfig | null = null

export function getRuntimeConfig(): RuntimeModeConfig {
  if (_config) return _config
  const mode = detectMode()
  _config = mode === "development" ? { ...DEV_CONFIG } : { ...PROD_CONFIG }
  return _config
}

export function overrideMode(mode: RuntimeMode): void {
  try {
    sessionStorage.setItem(MODE_KEY, mode)
  } catch { /* sessionStorage may not be available */ }
  _config = mode === "development" ? { ...DEV_CONFIG } : { ...PROD_CONFIG }
}

export function isDevRuntime(): boolean {
  return getRuntimeConfig().mode === "development"
}

export function isProdRuntime(): boolean {
  return getRuntimeConfig().mode === "production"
}

export function resetConfig(): void {
  _config = null
  try {
    sessionStorage.removeItem(MODE_KEY)
  } catch { /* sessionStorage may not be available */ }
}
