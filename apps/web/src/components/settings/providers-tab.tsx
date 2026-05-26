import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/app-store"
import type { GatewayProvider } from "@/types"
import { Button } from "@/components/ui/button"
import { ProviderCard } from "./providers/provider-card"
import { ProviderDrawer } from "./providers/provider-drawer"
import { useIntegrity } from "@/lib/use-integrity"
import { testConnection } from "@/lib/provider-gateway"
import {
  Plus, Search, Wifi, Box, Cpu, AlertTriangle, RefreshCw,
  X, ListCollapse, Layers, Activity,
} from "lucide-react"
import { WiringIndicator } from "./wiring-indicator"

export interface ConnectionTest {
  status: "pending" | "testing" | "success" | "error"
  statusCode?: number
  error?: string
  raw?: string
}

function parseTestResult(raw: string): { statusCode: number; error?: string } {
  const statusMatch = raw.match(/Status:\s*(\d{3})/)
  const code = statusMatch ? parseInt(statusMatch[1], 10) : 0
  const is200 = code >= 200 && code < 300
  if (is200) return { statusCode: code }
  const lines = raw.split("\n")
  const bodyStart = lines.findIndex((l) => l.startsWith("Body preview:"))
  const body = bodyStart >= 0 ? lines.slice(bodyStart + 1).join("\n").trim() : raw.slice(0, 200)
  return { statusCode: code, error: body }
}

// ── Health aggregation ──

function aggregateHealth(providers: GatewayProvider[], tests: Record<string, ConnectionTest>) {
  let healthy = 0
  let unhealthy = 0
  let pendingOrTesting = 0

  for (const p of providers) {
    const test = tests[p.id]
    if (!test || test.status === "pending" || test.status === "testing") {
      pendingOrTesting++
      continue
    }
    if (test.status === "success") {
      healthy++
    } else {
      unhealthy++
    }
  }

  const totalChecked = healthy + unhealthy
  return {
    healthy,
    unhealthy,
    pendingOrTesting,
    uptimePercent: totalChecked > 0 ? Math.round((healthy / totalChecked) * 100) : 0,
  }
}

export function ProvidersTab() {
  const providers = useAppStore((s) => s.providers)
  const removeProvider = useAppStore((s) => s.removeProvider)
  const { hasIssues, hasErrors, issuesByType, runValidation, runRepair, lastRepairResult } = useIntegrity()

  const [search, setSearch] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<GatewayProvider | null>(null)
  const [connectionTests, setConnectionTests] = useState<Record<string, ConnectionTest>>({})
  const [retestAll, setRetestAll] = useState(false)
  const [allExpanded, setAllExpanded] = useState(false)

  const runConnectionTest = useCallback(async (provider: GatewayProvider) => {
    setConnectionTests((prev) => ({ ...prev, [provider.id]: { status: "testing" } }))
    const startTime = Date.now()
    try {
      const raw = await testConnection(provider.baseUrl, provider.apiKey)
      const { statusCode, error } = parseTestResult(raw)
      const latencyMs = Date.now() - startTime
      if (statusCode >= 200 && statusCode < 300) {
        setConnectionTests((prev) => ({
          ...prev,
          [provider.id]: { status: "success", statusCode, raw, latencyMs },
        }))
      } else {
        // Build a helpful error message with status code context
        const statusHint = statusCode === 401 ? "— check your API key"
          : statusCode === 403 ? "— insufficient permissions"
          : statusCode === 404 ? "— endpoint not found, check the URL"
          : statusCode === 429 ? "— rate limited, try again later"
          : statusCode === 502 || statusCode === 503 ? "— server unavailable, try again later"
          : ""
        setConnectionTests((prev) => ({
          ...prev,
          [provider.id]: { status: "error", statusCode, error: error || `HTTP ${statusCode} ${statusHint}`, raw, latencyMs },
        }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const latencyMs = Date.now() - startTime
      // Detect common errors and add suggestions
      const suggestion = msg.includes("IPC_BRIDGE_UNAVAILABLE")
        ? "Run via `tauri dev` instead of `npm run dev`"
        : msg.includes("fetch") || msg.includes("NetworkError")
          ? "Check network connectivity or CORS policy"
          : msg.includes("timeout")
            ? "Endpoint is unreachable or too slow"
            : undefined
      setConnectionTests((prev) => ({
        ...prev,
        [provider.id]: { status: "error", error: suggestion ? `${msg} — ${suggestion}` : msg, latencyMs },
      }))
    }
  }, [])

  useEffect(() => {
    for (const p of providers) {
      runConnectionTest(p)
    }
  }, [])

  useEffect(() => {
    if (!retestAll) return
    for (const p of providers) runConnectionTest(p)
    setRetestAll(false)
  }, [retestAll, providers, runConnectionTest])

  const healthAgg = useMemo(() => aggregateHealth(providers, connectionTests), [providers, connectionTests])

  const filtered = useMemo(() => {
    if (!search) return providers
    const q = search.toLowerCase()
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.baseUrl.toLowerCase().includes(q) ||
        (p.runtime && p.runtime.toLowerCase().includes(q)) ||
        p.models.some((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    )
  }, [providers, search])

  const connected = providers.filter((p) => p.apiKey.length > 0).length
  const totalModels = providers.reduce((s, p) => s + p.models.length, 0)

  function toggleAllExpanded() {
    setAllExpanded((prev) => !prev)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">AI Providers</h2>
        <p className="text-sm text-white/40">Manage AI providers — models are auto-discovered through the gateway</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[
          {
            label: "Connected",
            value: connected.toString(),
            icon: Wifi,
            color: "text-green-400",
            detail: `${providers.length} total`,
            bgGradient: "from-green-500/10 to-emerald-500/5",
            borderColor: "border-green-500/10",
          },
          {
            label: "Uptime",
            value: `${healthAgg.uptimePercent}%`,
            icon: Activity,
            color: healthAgg.uptimePercent >= 80 ? "text-green-400" : healthAgg.uptimePercent >= 50 ? "text-amber-400" : "text-red-400",
            detail: `${healthAgg.healthy} healthy, ${healthAgg.unhealthy} error`,
            bgGradient: "from-blue-500/10 to-cyan-500/5",
            borderColor: "border-blue-500/10",
          },
          {
            label: "Total Models",
            value: totalModels.toString(),
            icon: Box,
            color: "text-purple-400",
            detail: "across all providers",
            bgGradient: "from-purple-500/10 to-pink-500/5",
            borderColor: "border-purple-500/10",
          },
          {
            label: "Runtimes",
            value: new Set(providers.map((p) => p.runtime).filter(Boolean)).size.toString(),
            icon: Cpu,
            color: "text-amber-400",
            detail: "detected runtimes",
            bgGradient: "from-amber-500/10 to-orange-500/5",
            borderColor: "border-amber-500/10",
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={cn(
                "rounded-2xl border backdrop-blur-xl p-4 transition-all hover:border-white/15",
                stat.borderColor,
                `bg-gradient-to-br ${stat.bgGradient}`,
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                  <p className="text-[10px] text-white/20 mt-0.5">{stat.detail}</p>
                </div>
                <div className={cn("p-2 rounded-lg bg-white/[0.03] border border-white/5", stat.color)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </div>
              <p className="text-xs text-white/40 mt-2">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Validation issues */}
      {hasIssues && (
        <div className={cn(
          "flex items-center gap-2 rounded-2xl border px-4 py-3",
          hasErrors ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5",
        )}>
          <AlertTriangle className={cn("h-4 w-4", hasErrors ? "text-red-400" : "text-amber-400")} />
          <span className={cn("text-xs", hasErrors ? "text-red-400" : "text-amber-400")}>
            {hasErrors
              ? `${issuesByType.errors.length} provider/role error(s) — run repair to auto-fix`
              : `${issuesByType.warnings.length} warning(s)`}
            {lastRepairResult && lastRepairResult.repairsSucceeded > 0 && (
              <> — {lastRepairResult.repairsSucceeded} issue(s) fixed</>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] ml-auto"
            onClick={() => runRepair()}
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> Repair
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => runValidation()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers, models, runtimes..."
            className="w-full h-10 rounded-xl border border-white/5 bg-white/[0.03] pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/10 focus:bg-white/[0.03] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Expand/collapse all */}
        {filtered.length > 1 && (
          <button
            onClick={toggleAllExpanded}
            className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-white/5 bg-white/[0.03] text-xs text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            {allExpanded ? (
              <Layers className="h-3.5 w-3.5" />
            ) : (
              <ListCollapse className="h-3.5 w-3.5" />
            )}
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        )}

        <div className="flex-1" />

        {/* Wiring status */}
        <WiringIndicator variant="compact" className="mr-2" />

        <Button
          size="sm"
          className="h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-blue-600/20"
          onClick={() => { setEditingProvider(null); setDrawerOpen(true) }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Provider
        </Button>
      </div>

      {/* Provider cards grid */}
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              expanded={allExpanded}
              connectionTest={connectionTests[p.id]}
              onRetest={() => runConnectionTest(p)}
              onEdit={() => { setEditingProvider(p); setDrawerOpen(true) }}
              onDelete={() => removeProvider(p.id)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.02] border border-white/5 mb-4">
            <Box className="h-8 w-8 text-white/10" />
          </div>
          <p className="text-sm text-white/30 mb-1">
            {search ? `No providers match "${search}"` : "No providers configured yet"}
          </p>
          <p className="text-xs text-white/20 mb-6">
            {search
              ? "Try a different search term"
              : 'Click "Add Provider" to connect your first AI provider'
            }
          </p>
          {!search && (
            <Button
              size="sm"
              className="h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-blue-600/20"
              onClick={() => { setEditingProvider(null); setDrawerOpen(true) }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Provider
            </Button>
          )}
        </motion.div>
      )}

      <ProviderDrawer
        open={drawerOpen}
        onClose={(saved?: boolean) => { setDrawerOpen(false); setEditingProvider(null); if (saved) setRetestAll(true) }}
        editProvider={editingProvider}
      />
    </div>
  )
}
