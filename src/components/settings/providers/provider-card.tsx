import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { GatewayProvider, ProviderModel } from "@/types"
import type { ValidationResult } from "@/types"
import {
  Globe, Eye, EyeOff, MoreHorizontal, Activity,
  Trash2, Clock, Box, Loader2, Zap,
  AlertTriangle, RefreshCw, Check, ChevronDown, ChevronRight,
  Shield, Server, Terminal, Radio, BarChart3,
  CircleDot, Copy, ExternalLink, Wifi, WifiOff,
  Cpu, BookOpen, Layers, Gauge, Bug, List,
} from "lucide-react"
import { safeValidateProvider } from "@agentic-os/providers"
import { useAppStore } from "@/stores/app-store"
import { PROVIDER_HEALTH_META, type ProviderHealthState } from "@agentic-os/providers"
import { getHealthInfo, getProviderDiagnostics } from "@agentic-os/providers"

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key
  const visible = key.slice(-4)
  const dashIndex = key.slice(0, -4).lastIndexOf("-")
  const prefixLen = dashIndex >= 0 ? dashIndex + 1 : Math.min(4, key.length - 4)
  const prefix = key.slice(0, prefixLen)
  const dots = Math.max(3, key.length - prefixLen - 4)
  return `${prefix}${"•".repeat(dots)}${visible}`
}

function HealthDot({ state, pulse = false }: { state: ProviderHealthState; pulse?: boolean }) {
  const meta = PROVIDER_HEALTH_META[state] ?? PROVIDER_HEALTH_META.unknown
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        meta.dot,
        pulse && (state === "validating" || state === "reconnecting") && "animate-pulse",
      )}
    />
  )
}

function ModelChip({ model }: { model: ProviderModel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/5 px-2 py-1 text-[10px] font-mono text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all">
      <CircleDot className="h-2 w-2 text-white/20 shrink-0" />
      <span className="truncate max-w-[120px]">{model.name}</span>
      {model.supportsTools && <span className="text-[8px] text-green-400/40">t</span>}
      {model.supportsVision && <span className="text-[8px] text-purple-400/40">v</span>}
    </span>
  )
}

function StatCell({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/5 px-2.5 py-2 text-xs transition-all hover:bg-white/[0.03]">
      <Icon className={cn("h-3 w-3 shrink-0", color)} />
      <div className="min-w-0">
        <span className={cn("block font-mono font-medium leading-tight", color)}>{value}</span>
        <span className="block text-[9px] text-white/20 leading-tight">{label}</span>
      </div>
    </div>
  )
}

export function ProviderCard({
  provider,
  onRetest,
  onEdit,
  onDelete,
  expanded: controlledExpanded,
  onOpenDiagnostics,
}: {
  provider: GatewayProvider
  onRetest?: () => void
  onEdit: () => void
  onDelete: () => void
  expanded?: boolean
  onOpenDiagnostics?: () => void
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

  const prevControlled = useRef(controlledExpanded)
  useEffect(() => {
    if (controlledExpanded !== undefined && controlledExpanded !== prevControlled.current) {
      prevControlled.current = controlledExpanded
      setInternalExpanded(controlledExpanded)
    }
  }, [controlledExpanded])

  const [showKey, setShowKey] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ValidationResult | null>(null)
  const mountedRef = useRef(true)

  const updateProvider = useAppStore((s) => s.updateProvider)

  const healthInfo = getHealthInfo(provider.baseUrl, provider.id)
  const diagnostics = getProviderDiagnostics(provider.baseUrl)
  const healthMeta = PROVIDER_HEALTH_META[healthInfo.state] ?? PROVIDER_HEALTH_META.unknown

  const hasApiKey = provider.apiKey.length > 0
  const modelCount = provider.models.length
  const firstModels = provider.models.slice(0, 4)

  const isConnected = healthInfo.state === "connected"
  const streamingOk = diagnostics?.lastValidationRun?.steps?.find(s => s.step === "streaming")?.passed ?? false
  const toolSupport = provider.models.some((m) => m.supportsTools)
  const visionSupport = provider.models.some((m) => m.supportsVision)
  const maxCtx = Math.max(...provider.models.map((m) => m.contextWindow ?? 0), 0)

  const isAnthropic = provider.baseUrl.includes("anthropic.com")
  const isGemini = provider.baseUrl.includes("googleapis.com") || provider.baseUrl.includes("generativelanguage")
  const isOllama = provider.baseUrl.includes("11434")
  const isNvidia = provider.baseUrl.includes("nvidia.com")

  const providerIcon = isAnthropic ? "A" : isGemini ? "G" : isOllama ? "O" : isNvidia ? "N" : provider.name[0]

  async function runHealthCheck() {
    setTesting(true)
    const t0 = performance.now()
    try {
      const result = await safeValidateProvider(provider.baseUrl, provider.apiKey)
      if (!mountedRef.current) return
      setTestResult(result)
      if (result.success) {
        updateProvider(provider.id, { runtime: result.runtime })
      }
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : "Health check failed"
      setTestResult({ success: false, runtime: null, latencyMs: Math.round(performance.now() - t0), error: msg })
    } finally {
      if (mountedRef.current) setTesting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-200",
        expanded
          ? cn(healthMeta.border, "bg-gradient-to-br from-white/[0.05] to-white/[0.02]")
          : "border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] hover:border-white/10 hover:-translate-y-0.5",
      )}
    >
      {/* Health gradient bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r transition-opacity duration-500",
        isConnected ? "from-green-500/50 to-green-500/10" :
        healthInfo.state === "invalid_auth" ? "from-red-500/50 to-red-500/10" :
        healthInfo.state === "offline" || healthInfo.state === "timeout" ? "from-orange-500/50 to-orange-500/10" :
        "from-white/10 to-transparent",
      )} />

      {/* ── Header ── */}
      <button
        onClick={() => setInternalExpanded(!expanded)}
        className="relative w-full p-4 text-left focus:outline-none"
      >
        <div className="flex items-start gap-3">
          {/* Provider avatar */}
          <div className={cn(
            "relative flex items-center justify-center h-10 w-10 rounded-xl border transition-all shrink-0 overflow-hidden",
            isConnected ? "border-green-500/20 bg-gradient-to-br from-green-500/20 to-emerald-500/10" :
            healthInfo.state === "invalid_auth" ? "border-red-500/20 bg-gradient-to-br from-red-500/20 to-rose-500/10" :
            healthInfo.state === "offline" || healthInfo.state === "timeout" ? "border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-500/10" :
            "border-white/10 bg-gradient-to-br from-blue-500/20 to-purple-500/10",
          )}>
            <span className="text-lg font-bold text-white/80">{providerIcon}</span>
            <span className={cn(
              "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0a0a14]",
              healthMeta.dot,
              (healthInfo.state === "validating" || healthInfo.state === "reconnecting") && "animate-pulse",
            )} />
          </div>

          {/* Name + type + health row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white truncate">{provider.name}</h3>
              {provider.runtime && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium",
                  provider.isLocal ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                )}>
                  <Server className="h-2.5 w-2.5" />
                  {provider.runtime}
                </span>
              )}
              {provider.isLocal && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <WifiOff className="h-2.5 w-2.5" />
                  Local
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/30 font-mono truncate">
                {provider.isOpenAiCompatible ? "OpenAI-compatible" : provider.runtime || "Unknown"}
              </span>
              {/* Health label */}
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                healthMeta.bg, healthMeta.color,
              )}>
                <HealthDot state={healthInfo.state} />
                {healthMeta.label}
              </span>
              {/* Latency */}
              {healthInfo.latencyMs > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] text-white/30 font-mono">
                  <Zap className="h-2 w-2" />
                  {healthInfo.latencyMs}ms
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Status indicator */}
            <div className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-mono border transition-all",
              healthMeta.bg, healthMeta.border, healthMeta.color,
            )}>
              {testing ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : isConnected ? (
                <Wifi className="h-2.5 w-2.5" />
              ) : (
                <Activity className="h-2.5 w-2.5" />
              )}
              {healthInfo.latencyMs > 0 ? `${healthInfo.latencyMs}ms` : "—"}
            </div>

            {/* Diagnostics */}
            {onOpenDiagnostics && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenDiagnostics() }}
                className="rounded-lg p-1.5 text-white/30 hover:text-cyan-400 hover:bg-white/5 transition-all"
                title="Diagnostics console"
              >
                <Terminal className="h-4 w-4" />
              </button>
            )}

            {/* Menu */}
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/10 bg-black/90 backdrop-blur-2xl p-1 shadow-2xl z-20"
                  >
                    <button onClick={() => { onEdit(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <Activity className="h-3.5 w-3.5" /> Edit Provider
                    </button>
                    <button onClick={() => { onRetest?.(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh Models
                    </button>
                    <button onClick={() => { runHealthCheck(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <Zap className="h-3.5 w-3.5" /> Validate Connection
                    </button>
                    {onOpenDiagnostics && (
                      <button onClick={() => { onOpenDiagnostics(); setMenuOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                        <Bug className="h-3.5 w-3.5" /> View Diagnostics
                      </button>
                    )}
                    <div className="my-1 border-t border-white/5" />
                    <button onClick={() => { onDelete(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" /> Remove Provider
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setInternalExpanded(!expanded) }}
              className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/5 transition-all"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Metrics bar (always visible) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <StatCell label="Latency" value={healthInfo.latencyMs > 0 ? `${healthInfo.latencyMs}ms` : "—"} icon={Zap} color="text-white/70" />
          <StatCell label="Models" value={String(modelCount)} icon={Box} color="text-white/70" />
          <StatCell label="Streaming" value={streamingOk ? "✓" : "—"} icon={Radio} color={streamingOk ? "text-green-400" : "text-white/30"} />
          <StatCell label="Runtime" value={provider.runtime ?? "—"} icon={Cpu} color="text-white/70" />
        </div>

        {/* Model chips (collapsed) */}
        {modelCount > 0 && !expanded && (
          <div className="flex flex-wrap gap-1 mt-2">
            {firstModels.slice(0, 3).map((m) => (
              <ModelChip key={m.id} model={m} />
            ))}
            {modelCount > 3 && (
              <span className="inline-flex items-center text-[9px] text-white/20 px-1">
                +{modelCount - 3} more
              </span>
            )}
          </div>
        )}
      </button>

      {/* ── Expanded Content ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 pt-3 space-y-4">
              {/* Info rows */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-xs text-white/30 font-mono bg-white/[0.02] rounded-xl px-3 py-2.5 border border-white/5 col-span-2">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-white/20" />
                  <span className="truncate flex-1">{provider.baseUrl}</span>
                  {provider.runtime && (
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                      provider.isLocal ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400",
                    )}>
                      <Server className="h-2.5 w-2.5" />{provider.runtime}
                    </span>
                  )}
                </div>
              </div>

              {/* API key */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5 hover:bg-white/[0.03] transition-all">
                  <Shield className="h-3.5 w-3.5 text-white/20 shrink-0" />
                  {hasApiKey ? (
                    <code className="text-xs text-white/40 font-mono select-all flex-1 truncate">
                      {showKey ? provider.apiKey : maskApiKey(provider.apiKey)}
                    </code>
                  ) : (
                    <span className="text-xs text-amber-400/60">No API key set</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowKey(!showKey) }}
                    className="rounded p-0.5 text-white/20 hover:text-white hover:bg-white/5 transition-all shrink-0"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  {hasApiKey && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(provider.apiKey) }}
                      className="rounded p-0.5 text-white/20 hover:text-white hover:bg-white/5 transition-all shrink-0"
                      title="Copy API key"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Health metrics */}
              <div className="grid grid-cols-4 gap-2">
                <StatCell label="Status" value={healthMeta.label} icon={Activity} color={healthMeta.color} />
                <StatCell label="Avg Latency" value={diagnostics?.avgLatencyMs ? `${diagnostics.avgLatencyMs}ms` : "—"} icon={Gauge} color="text-white/70" />
                <StatCell label="Uptime" value={diagnostics ? `${diagnostics.uptimePercent}%` : "—"} icon={BarChart3} color={(diagnostics?.uptimePercent ?? 0) >= 80 ? "text-green-400" : (diagnostics?.uptimePercent ?? 0) >= 50 ? "text-amber-400" : "text-white/30"} />
                <StatCell label="Failures" value={diagnostics ? String(diagnostics.failureCount) : "—"} icon={AlertTriangle} color={diagnostics?.failureCount ? "text-red-400" : "text-white/30"} />
              </div>

              {/* P50/P95 */}
              {diagnostics && (diagnostics.p50LatencyMs > 0 || diagnostics.p95LatencyMs > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Clock className="h-3 w-3 text-blue-400" />
                    </div>
                    <div>
                      <span className="block text-xs text-white/70 font-mono">P50: {diagnostics.p50LatencyMs}ms</span>
                      <span className="block text-[9px] text-white/20">Median latency</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
                    <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Activity className="h-3 w-3 text-amber-400" />
                    </div>
                    <div>
                      <span className="block text-xs text-white/70 font-mono">P95: {diagnostics.p95LatencyMs}ms</span>
                      <span className="block text-[9px] text-white/20">95th percentile</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Capability badges */}
              <div className="flex flex-wrap gap-1">
                {streamingOk && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Radio className="h-2.5 w-2.5" />Streaming</span>}
                {toolSupport && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-green-500/10 text-green-400 border border-green-500/20"><Zap className="h-2.5 w-2.5" />Tools</span>}
                {visionSupport && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"><Eye className="h-2.5 w-2.5" />Vision</span>}
                {maxCtx > 100000 && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><BookOpen className="h-2.5 w-2.5" />{(maxCtx / 1000).toFixed(0)}K ctx</span>}
              </div>

              {/* Validation steps */}
              {diagnostics?.lastValidationRun?.steps && diagnostics.lastValidationRun.steps.length > 0 && (
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1.5">
                  <p className="text-[9px] text-white/30 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Last Validation — {diagnostics.lastValidationRun.overall}
                  </p>
                  <div className="space-y-1">
                    {diagnostics.lastValidationRun.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", step.passed ? "bg-green-500" : "bg-red-500")} />
                        <span className="text-white/40 w-20 uppercase text-[9px] font-medium">{step.step}</span>
                        <span className={cn("font-mono", step.passed ? "text-green-400/60" : "text-red-400/60")}>
                          {step.passed ? "✓ " : "✗ "}{step.latencyMs}ms
                        </span>
                        {step.statusCode && <span className="text-[9px] text-white/30">HTTP {step.statusCode}</span>}
                        {!step.passed && step.error && (
                          <span className="text-red-400/50 truncate max-w-[150px] text-[9px]" title={step.error}>{step.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-white/20 pt-1 border-t border-white/5 mt-1.5">
                    Total: {diagnostics.lastValidationRun.totalLatencyMs}ms · {diagnostics.lastValidationRun.overall}
                  </div>
                </div>
              )}

              {/* Models list */}
              {modelCount > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Box className="h-2.5 w-2.5 text-white/20" />
                    <span className="text-[9px] text-white/30 font-medium uppercase tracking-wider">Models ({modelCount})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {provider.models.map((m) => (
                      <ModelChip key={m.id} model={m} />
                    ))}
                  </div>
                </div>
              )}

              {/* Error banner */}
              {healthInfo.lastError && healthInfo.state !== "connected" && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/5 border border-red-500/10 px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-red-400/80 font-medium">Error</p>
                    <p className="text-[9px] text-red-400/50 truncate">{healthInfo.lastError}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); runHealthCheck() }}
                    className="shrink-0 rounded px-2 py-1 text-[9px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); runHealthCheck() }}
                  disabled={testing}
                  className={cn(
                    "flex-1 min-w-[80px] h-8 text-[10px] rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-40",
                    testing ? "border-blue-500/20 text-blue-400" :
                    testResult?.success ? "border-green-500/20 text-green-400 hover:bg-green-500/5" :
                    "border-white/10 text-white/50 hover:text-white hover:bg-white/5",
                  )}
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  {testing ? "Testing..." : testResult?.success ? `Online (${testResult.latencyMs}ms)` : "Validate"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="flex-1 min-w-[80px] h-8 text-[10px] rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <Activity className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="flex-1 min-w-[80px] h-8 text-[10px] rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
