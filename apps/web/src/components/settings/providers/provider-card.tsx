import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { GatewayProvider } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import type { ConnectionTest } from "../providers-tab"
import {
  Globe, Eye, EyeOff, MoreHorizontal, Activity,
  Trash2, Clock, Box, Wifi, WifiOff, Loader2, Zap, AlertTriangle, RefreshCw, Check,
  ChevronDown, ChevronRight, Shield, Server, Terminal,
} from "lucide-react"
import { safeValidateProvider } from "@/lib/provider-manager"
import { chatCompletion } from "@/lib/ai-service"
import { providerStreamChatCompletion } from "@/lib/provider-gateway"
import { useAppStore } from "@/stores/app-store"
import type { ValidationResult } from "@/types"

// ── Secure API key masking ──

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key
  // Show last 4 chars, mask everything before them
  const visible = key.slice(-4)
  // Find a logical prefix boundary (last dash before the payload, or just first 4 chars)
  const dashIndex = key.slice(0, -4).lastIndexOf("-")
  const prefixLen = dashIndex >= 0 ? dashIndex + 1 : Math.min(4, key.length - 4)
  const prefix = key.slice(0, prefixLen)
  const dots = Math.max(3, key.length - prefixLen - 4)
  return `${prefix}${"•".repeat(dots)}${visible}`
}

// ── Health status helpers ──

type HealthLevel = "healthy" | "degraded" | "unhealthy" | "unknown"

function getHealthFromLatency(latencyMs: number): HealthLevel {
  if (latencyMs === 0) return "unknown"
  if (latencyMs < 500) return "healthy"
  if (latencyMs < 2000) return "degraded"
  return "unhealthy"
}

const HEALTH_META: Record<HealthLevel, { color: string; dot: string; label: string }> = {
  healthy: { color: "text-green-400", dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]", label: "Healthy" },
  degraded: { color: "text-amber-400", dot: "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]", label: "Degraded" },
  unhealthy: { color: "text-red-400", dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]", label: "Unhealthy" },
  unknown: { color: "text-white/30", dot: "bg-white/20", label: "Unknown" },
}

export function ProviderCard({
  provider,
  connectionTest,
  onRetest,
  onEdit,
  onDelete,
  expanded: controlledExpanded,
}: {
  provider: GatewayProvider
  connectionTest?: ConnectionTest
  onRetest?: () => void
  onEdit: () => void
  onDelete: () => void
  expanded?: boolean
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

  // Sync internal state when controlled prop changes
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

  const healthLevel: HealthLevel = connectionTest?.status === "success"
    ? getHealthFromLatency(testResult?.latencyMs ?? 0)
    : connectionTest?.status === "error"
    ? "unhealthy"
    : connectionTest?.status === "testing"
    ? "unknown"
    : "unknown"

  const healthMeta = HEALTH_META[healthLevel]

  async function runHealthCheck() {
    setTesting(true)
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
      setTestResult({ success: false, runtime: null, latencyMs: 0, error: msg })
    } finally {
      if (mountedRef.current) setTesting(false)
    }
  }

  const [modelTesting, setModelTesting] = useState(false)
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null)

  async function runModelTest() {
    const model = provider.models[0]?.id
    if (!model) return
    setModelTesting(true)
    setModelTestResult(null)
    try {
      const start = Date.now()
      const res = await chatCompletion(
        provider.baseUrl, provider.apiKey, provider.runtime,
        { model, messages: [{ role: "user", content: "Say 'ok' and nothing else." }] },
      )
      if (!mountedRef.current) return
      setModelTestResult({ success: true, latencyMs: Date.now() - start })
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : "Model test failed"
      setModelTestResult({ success: false, error: msg })
    } finally {
      if (mountedRef.current) setModelTesting(false)
    }
  }

  const [streamTesting, setStreamTesting] = useState(false)
  const [streamTestResult, setStreamTestResult] = useState<{ success: boolean; ttfbMs?: number; charsPerSec?: number; totalMs?: number; chars?: number; error?: string } | null>(null)

  async function runStreamTest() {
    const model = provider.models[0]?.id
    if (!model) return
    setStreamTesting(true)
    setStreamTestResult(null)
    try {
      const start = performance.now()
      let ttfb: number | null = null
      let totalChars = 0
      await providerStreamChatCompletion(
        provider.baseUrl, provider.apiKey, provider.runtime,
        { model, messages: [{ role: "user", content: "Count from 1 to 5, one number per line." }] },
        {
          onReady: () => {},
          onToken: (token) => {
            if (ttfb === null) ttfb = performance.now() - start
            totalChars += token.length
          },
          onDone: () => {
            if (!mountedRef.current) return
            const total = performance.now() - start
            const cps = total > 0 ? Math.round((totalChars / total) * 1000) : 0
            setStreamTestResult({ success: true, ttfbMs: Math.round(ttfb ?? total), charsPerSec: cps, totalMs: Math.round(total), chars: totalChars })
          },
          onError: (err) => {
            if (!mountedRef.current) return
            setStreamTestResult({ success: false, error: err.message })
          },
        },
      )
    } catch (err) {
      if (!mountedRef.current) return
      const msg = err instanceof Error ? err.message : "Stream test failed"
      setStreamTestResult({ success: false, error: msg })
    } finally {
      if (mountedRef.current) setStreamTesting(false)
    }
  }

  const hasApiKey = provider.apiKey.length > 0
  const modelCount = provider.models.length
  const firstModels = provider.models.slice(0, 3)
  const isConnected = connectionTest?.status === "success"

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
          ? "border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02]"
          : "border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.02] hover:border-white/10 hover:-translate-y-0.5",
      )}
    >
      {/* Status bar */}
      <motion.div
        animate={{ opacity: isConnected ? 1 : 0.4 }}
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r",
          isConnected ? "from-green-500/50 to-emerald-500/50" : "from-white/10 to-white/5",
        )}
      />

      {/* ── Collapsible header ── */}
      <button
        onClick={() => setInternalExpanded(!expanded)}
        className="relative w-full p-4 text-left focus:outline-none"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl border transition-all shrink-0",
            isConnected
              ? "border-green-500/20 bg-gradient-to-br from-green-500/20 to-emerald-500/10"
              : "border-white/10 bg-gradient-to-br from-blue-500/20 to-purple-500/10",
          )}>
            <span className="text-lg font-bold text-white/80">{provider.name[0]}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white truncate">{provider.name}</h3>
              {provider.runtime && (
                <Badge variant={provider.isLocal ? "success" : "info"} size="sm">
                  {provider.runtime}
                </Badge>
              )}
              {provider.isLocal && (
                <Badge variant="purple" size="sm">Local</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/30 font-mono truncate">
                {provider.isOpenAiCompatible ? "OpenAI-compatible" : provider.runtime || "Unknown"}
              </span>
              {/* Connection status badge */}
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                connectionTest?.status === "success" ? "bg-green-500/10 text-green-400" :
                connectionTest?.status === "error" ? "bg-red-500/10 text-red-400" :
                "bg-white/5 text-white/30",
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", healthMeta.dot)} />
                {connectionTest?.status === "testing" ? "Checking..." :
                 connectionTest?.status === "success" ? "Online" :
                 connectionTest?.status === "error" ? "Error" : "Unknown"}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip content={connectionTest?.status === "success" ? `${testResult?.latencyMs ?? "?"}ms latency` : "Connection status"}>
              <div className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-mono border transition-all",
                isConnected
                  ? "bg-green-500/5 border-green-500/15 text-green-400"
                  : connectionTest?.status === "error"
                  ? "bg-red-500/5 border-red-500/15 text-red-400"
                  : "bg-white/[0.02] border-white/5 text-white/30",
              )}>
                {connectionTest?.status === "testing" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Zap className="h-2.5 w-2.5" />
                )}
                {connectionTest?.status === "success" ? `${testResult?.latencyMs ?? "?"}ms` :
                 connectionTest?.status === "error" ? "ERR" : "—"}
              </div>
            </Tooltip>
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
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
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-black/90 backdrop-blur-2xl p-1 shadow-2xl z-20"
                  >
                    <button onClick={() => { onEdit(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <Activity className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={() => { runHealthCheck(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <RefreshCw className="h-3.5 w-3.5" /> Test Connection
                    </button>
                    {provider.models.length > 0 && (
                      <button onClick={() => { runModelTest(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                        <Zap className="h-3.5 w-3.5" /> Test Model
                      </button>
                    )}
                    <div className="my-1 border-t border-white/5" />
                    <button onClick={() => { onDelete(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
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

        {/* Summary metrics row (always visible) */}
        <div className="flex items-center gap-3 mt-3 text-[10px]">
          {/* API key masked */}
          <div className="flex items-center gap-1.5 text-white/30 font-mono min-w-0">
            <Shield className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {hasApiKey ? maskApiKey(provider.apiKey) : "No API key"}
            </span>
          </div>

          <span className="text-white/10">|</span>

          {/* Models count */}
          <div className="flex items-center gap-1 text-white/30">
            <Box className="h-3 w-3" />
            <span>{modelCount} model{modelCount !== 1 ? "s" : ""}</span>
          </div>

          {testResult?.latencyMs && testResult.latencyMs > 0 && (
            <>
              <span className="text-white/10">|</span>
              <div className="flex items-center gap-1 text-white/30">
                <Clock className="h-3 w-3" />
                <span>{testResult.latencyMs}ms</span>
              </div>
            </>
          )}

          {/* Endpoint URL (collapsed) */}
          <span className="hidden md:inline-flex items-center gap-1 text-white/20 ml-auto truncate max-w-[200px]">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{provider.baseUrl}</span>
          </span>
        </div>
      </button>

      {/* ── Expanded content ── */}
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
              {/* Endpoint URL (expanded) */}
              <div className="flex items-center gap-2 text-xs text-white/30 font-mono bg-white/[0.02] rounded-lg px-3 py-2 border border-white/5">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{provider.baseUrl}</span>
                {provider.runtime && (
                  <Badge variant={provider.isLocal ? "success" : "info"} size="sm" className="shrink-0 ml-auto">
                    <Server className="h-2.5 w-2.5 mr-0.5" />{provider.runtime}
                  </Badge>
                )}
              </div>

              {/* API key */}
              <div className="flex items-center gap-2">
                <Tooltip content={hasApiKey ? "API key configured" : "No API key set"}>
                  <div className="flex-1 flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2.5">
                    <Shield className="h-3.5 w-3.5 text-white/20 shrink-0" />
                    {hasApiKey ? (
                      <code className="text-xs text-white/40 font-mono select-all">
                        {showKey ? provider.apiKey : maskApiKey(provider.apiKey)}
                      </code>
                    ) : (
                      <span className="text-xs text-amber-400/60">No API key set</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowKey(!showKey) }}
                      className="ml-auto rounded p-0.5 text-white/20 hover:text-white hover:bg-white/5 transition-all"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </Tooltip>
              </div>

              {/* Health metrics grid */}
              <div className="grid grid-cols-3 gap-2">
                <Tooltip content={connectionTest?.error || "Connection status"}>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs">
                    {testing ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white/40 shrink-0" />
                    ) : testResult?.success ? (
                      <Wifi className="h-3 w-3 text-green-400 shrink-0" />
                    ) : testResult ? (
                      <WifiOff className="h-3 w-3 text-red-400 shrink-0" />
                    ) : (
                      <Activity className="h-3 w-3 text-white/30 shrink-0" />
                    )}
                    <span className={cn(
                      "truncate",
                      testing ? "text-white/40" : testResult?.success ? "text-green-400" : testResult ? "text-red-400" : "text-white/40",
                    )}>
                      {testing ? "Testing" : testResult?.success ? "Online" : testResult ? "Error" : "Unknown"}
                    </span>
                  </div>
                </Tooltip>
                <Tooltip content="Response time">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs text-white/40">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="font-mono">{testResult ? `${testResult.latencyMs}ms` : "—"}</span>
                  </div>
                </Tooltip>
                <Tooltip content="Discovered models">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs text-white/40">
                    <Box className="h-3 w-3 shrink-0" />
                    <span className="font-mono">{modelCount} model{modelCount !== 1 ? "s" : ""}</span>
                  </div>
                </Tooltip>
              </div>

              {/* Model chips */}
              {modelCount > 0 && (
                <div className="flex flex-wrap gap-1">
                  {firstModels.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/5 px-2 py-0.5 text-[9px] font-mono text-white/40">
                      {m.name}
                    </span>
                  ))}
                  {modelCount > 3 && (
                    <span className="inline-flex items-center text-[9px] text-white/20 px-1">
                      +{modelCount - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Test buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); runHealthCheck() }}
                  disabled={testing}
                  className={cn(
                    "flex-1 min-w-[120px] h-8 text-[10px] rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-40",
                    testing
                      ? "border-blue-500/20 text-blue-400"
                      : testResult?.success
                      ? "border-green-500/20 text-green-400 hover:bg-green-500/5"
                      : "border-white/10 text-white/50 hover:text-white hover:bg-white/5",
                  )}
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  {testing ? "Testing..." : testResult?.success ? `Online (${testResult.latencyMs}ms)` : "Test Connection"}
                </button>
                {provider.models.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runModelTest() }}
                    disabled={modelTesting}
                    className={cn(
                      "flex-1 min-w-[100px] h-8 text-[10px] rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-40",
                      modelTesting
                        ? "border-blue-500/20 text-blue-400"
                        : modelTestResult?.success
                        ? "border-green-500/20 text-green-400 hover:bg-green-500/5"
                        : "border-white/10 text-white/50 hover:text-white hover:bg-white/5",
                    )}
                  >
                    {modelTesting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : modelTestResult?.success ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Terminal className="h-3 w-3" />
                    )}
                    {modelTesting ? "Testing..." : modelTestResult?.success ? `${modelTestResult.latencyMs}ms` : "Test Model"}
                  </button>
                )}
                {provider.models.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runStreamTest() }}
                    disabled={streamTesting}
                    className={cn(
                      "flex-1 min-w-[120px] h-8 text-[10px] rounded-xl border transition-all flex items-center justify-center gap-1.5 disabled:opacity-40",
                      streamTesting
                        ? "border-blue-500/20 text-blue-400"
                        : streamTestResult?.success
                        ? "border-green-500/20 text-green-400 hover:bg-green-500/5"
                        : "border-white/10 text-white/50 hover:text-white hover:bg-white/5",
                    )}
                  >
                    {streamTesting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : streamTestResult?.success ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Activity className="h-3 w-3" />
                    )}
                    {streamTesting ? "Streaming..." : streamTestResult?.success ? `${streamTestResult.charsPerSec}c/s` : "Test Stream"}
                  </button>
                )}

                {/* Error indicators */}
                {testResult && !testResult.success && testResult.error && (
                  <Tooltip content={testResult.error}>
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400/60 shrink-0" />
                  </Tooltip>
                )}
                {modelTestResult && !modelTestResult.success && modelTestResult.error && (
                  <Tooltip content={modelTestResult.error}>
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400/60 shrink-0" />
                  </Tooltip>
                )}
                {streamTestResult && !streamTestResult.success && streamTestResult.error && (
                  <Tooltip content={streamTestResult.error}>
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400/60 shrink-0" />
                  </Tooltip>
                )}
              </div>

              {/* Stream test results detail */}
              {streamTestResult?.success && (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-green-500/5 border border-green-500/10 px-3 py-2 text-green-400/80">
                    TTFB: <span className="font-mono">{streamTestResult.ttfbMs}ms</span>
                  </div>
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2 text-blue-400/80">
                    Speed: <span className="font-mono">{streamTestResult.charsPerSec} c/s</span>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-white/40">
                    Total: <span className="font-mono">{streamTestResult.totalMs}ms</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
