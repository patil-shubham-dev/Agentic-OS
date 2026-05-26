import React, { useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  Activity,
  Server,
  Shield,
  GitBranch,
  AlertTriangle,
  Zap,
  Box,
  Layers,
  Network,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react"
import { UnifiedProviderService, type UnifiedProviderSnapshot, type ProviderComparisonRow, type FallbackChain, type RoutingDecision, type RoleCapabilityGap, type CapabilityEntry, type ProviderCapabilityMatrix } from "@/runtime/observability/UnifiedProviderService"

interface ProviderUnifiedPanelProps {
  className?: string
}

const POLL_INTERVAL = 3000

// ── Color Helpers ──

const STATUS_COLORS: Record<string, string> = {
  healthy: "text-green-400",
  unhealthy: "text-red-400",
  warning: "text-amber-400",
  idle: "text-white/30",
}

const CAP_COLOR = (supported: boolean) =>
  supported ? "bg-green-500/30 text-green-300 border-green-500/40" : "bg-red-500/10 text-red-400/50 border-red-500/20"

// ── Sub-Components ──

function StatsBar({ snapshot }: { snapshot: UnifiedProviderSnapshot }) {
  const s = snapshot.summary
  return (
    <div className="grid grid-cols-4 gap-1.5 px-2 py-2">
      <div className="bg-white/[0.03] rounded-lg border border-white/8 p-2">
        <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
          <Server className="h-2.5 w-2.5" />
          Providers
        </div>
        <div className="text-sm font-semibold text-white/80">{s.totalProviders}</div>
        <div className="flex gap-2 mt-0.5">
          <span className="text-[9px] text-green-400">{s.healthyCount} healthy</span>
          {s.unhealthyCount > 0 && <span className="text-[9px] text-red-400">{s.unhealthyCount} down</span>}
        </div>
      </div>
      <div className="bg-white/[0.03] rounded-lg border border-white/8 p-2">
        <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
          <Box className="h-2.5 w-2.5" />
          Models
        </div>
        <div className="text-sm font-semibold text-white/80">{s.totalModels}</div>
        <div className="text-[9px] text-white/30">across all providers</div>
      </div>
      <div className="bg-white/[0.03] rounded-lg border border-white/8 p-2">
        <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
          <Shield className="h-2.5 w-2.5" />
          Roles
        </div>
        <div className="text-sm font-semibold text-white/80">{s.rolesCovered}/{s.rolesCovered + s.rolesUncovered}</div>
        <div className="flex gap-2 mt-0.5">
          <span className="text-[9px] text-green-400">{s.rolesCovered} covered</span>
          {s.rolesUncovered > 0 && <span className="text-[9px] text-amber-400">{s.rolesUncovered} gaps</span>}
        </div>
      </div>
      <div className="bg-white/[0.03] rounded-lg border border-white/8 p-2">
        <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
          <Zap className="h-2.5 w-2.5" />
          Avg Latency
        </div>
        <div className="text-sm font-semibold text-white/80">{s.avgLatencyMs}ms</div>
        <div className="text-[9px] text-white/30">{s.routingDecisions} routing decisions</div>
      </div>
    </div>
  )
}

function ProviderCard({ provider, isExpanded, onToggle }: { provider: ProviderComparisonRow; isExpanded: boolean; onToggle: () => void }) {
  const statusKey = provider.healthy ? "healthy" : "unhealthy"
  const statusDot = provider.healthy ? "bg-green-400" : "bg-red-400"

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/8 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/[0.02] transition-colors text-left"
      >
        {isExpanded ? <ChevronDown className="h-3 w-3 text-white/30 shrink-0" /> : <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />}
        <div className={cn("h-2 w-2 rounded-full shrink-0", statusDot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-white/70 truncate">{provider.name}</span>
            <span className={cn("text-[8px] px-1 py-0.5 rounded font-medium", provider.isLocal ? "bg-blue-500/10 text-blue-300" : "bg-purple-500/10 text-purple-300")}>
              {provider.isLocal ? "local" : "cloud"}
            </span>
          </div>
          <div className="text-[9px] text-white/30 truncate mt-0.5">{provider.models.length > 0 ? provider.models.join(", ") : provider.baseUrl || "No models"}</div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-white/40 shrink-0">
          <span>{provider.latencyMs}ms</span>
          <span className={cn("px-1 py-0.5 rounded", provider.healthy ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300")}>
            {provider.healthy ? "OK" : "DOWN"}
          </span>
        </div>
      </button>
      {isExpanded && (
        <div className="px-2.5 pb-2 pt-0.5 border-t border-white/5 space-y-1.5">
          {/* Capabilities */}
          {provider.capabilities && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(provider.capabilities).map(([key, val]) => {
                if (typeof val === "boolean") {
                  return (
                    <span
                      key={key}
                      className={cn(
                        "text-[8px] px-1 py-0.5 rounded border",
                        val ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-red-500/8 text-red-400/50 border-red-500/15",
                      )}
                    >
                      {key.replace(/([A-Z])/g, " $1").trim()}: {val ? "✓" : "✗"}
                    </span>
                  )
                }
                if (typeof val === "number") {
                  return (
                    <span key={key} className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
                      {key.replace(/([A-Z])/g, " $1").trim()}: {val.toLocaleString()}
                    </span>
                  )
                }
                return null
              })}
            </div>
          )}
          {/* Health details */}
          {provider.health && (
            <div className="grid grid-cols-3 gap-1">
              <div className="text-[8px] text-white/30">
                <span className="text-white/50">Samples:</span> {provider.samples}
              </div>
              <div className="text-[8px] text-white/30">
                <span className="text-white/50">Failures:</span> {provider.failures}
              </div>
              <div className="text-[8px] text-white/30">
                <span className="text-white/50">Checked:</span> {provider.lastChecked ? new Date(provider.lastChecked).toLocaleTimeString() : "—"}
              </div>
            </div>
          )}
          {provider.lastError && (
            <div className="text-[8px] text-red-400/70 bg-red-500/5 rounded px-1.5 py-0.5 truncate">
              Error: {provider.lastError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ComparisonMatrix({ matrix }: { matrix: ProviderCapabilityMatrix[] }) {
  if (matrix.length === 0 || !matrix[0]?.providers.length) {
    return <div className="text-[10px] text-white/25 text-center py-6">No capability data available</div>
  }

  const providerNames = matrix[0].providers.map((p) => p.id)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="text-left text-white/40 font-medium px-2 py-1 border-b border-white/8 sticky left-0 bg-[#0a0a0b]">Capability</th>
            {providerNames.map((id) => (
              <th key={id} className="text-center text-white/40 font-medium px-1.5 py-1 border-b border-white/8 whitespace-nowrap">
                {id.length > 12 ? id.slice(0, 12) + "…" : id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.label} className="hover:bg-white/[0.01]">
              <td className="text-white/70 px-2 py-1.5 border-b border-white/5 sticky left-0 bg-[#0a0a0b] whitespace-nowrap">{row.label}</td>
              {row.providers.map((cell) => (
                <td key={cell.id} className="text-center border-b border-white/5 py-1.5">
                  <span className={cn(
                    "inline-flex items-center justify-center w-4 h-4 rounded text-[7px] font-bold",
                    cell.supported ? "bg-green-500/20 text-green-300" : "bg-red-500/10 text-red-400/40",
                  )}>
                    {cell.supported ? "✓" : "✗"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
          <tr className="hover:bg-white/[0.01]">
            <td className="text-white/70 px-2 py-1.5 border-b border-white/5 sticky left-0 bg-[#0a0a0b]">Context</td>
            {providerNames.map((id) => {
              const cell = matrix[0].providers.find((p) => p.id === id)
              const ctx = cell?.value ?? "—"
              return (
                <td key={id} className="text-center text-white/40 border-b border-white/5 py-1.5 text-[8px]">
                  {ctx}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function FallbackChainView({ chains }: { chains: FallbackChain[] }) {
  const [expandedChain, setExpandedChain] = useState<string | null>(null)

  if (chains.length === 0) {
    return <div className="text-[10px] text-white/25 text-center py-6">No fallback chains configured</div>
  }

  return (
    <div className="space-y-1.5 px-2">
      {chains.map((chain) => (
        <div key={chain.id} className="bg-white/[0.02] rounded-lg border border-white/8 overflow-hidden">
          <button
            onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/[0.02] text-left"
          >
            {expandedChain === chain.id ? <ChevronDown className="h-3 w-3 text-white/30 shrink-0" /> : <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />}
            <GitBranch className="h-3 w-3 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-white/70">{chain.name}</div>
              <div className="text-[8px] text-white/30 truncate">{chain.description}</div>
            </div>
            <span className="text-[8px] text-white/30 bg-white/5 px-1 py-0.5 rounded shrink-0">{chain.providerIds.length} providers</span>
          </button>
          {expandedChain === chain.id && (
            <div className="px-2.5 pb-2 pt-1 border-t border-white/5">
              <div className="flex items-center flex-wrap gap-1">
                {chain.providerIds.map((pid, idx) => (
                  <React.Fragment key={pid}>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/8 truncate max-w-[120px]">
                      {pid.length > 20 ? pid.slice(0, 20) + "…" : pid}
                    </span>
                    {idx < chain.providerIds.length - 1 && (
                      <ArrowRight className="h-2.5 w-2.5 text-white/20 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RoleAssignmentView({ roleGaps }: { roleGaps: RoleCapabilityGap[] }) {
  return (
    <div className="space-y-1 px-2">
      {roleGaps.length === 0 ? (
        <div className="text-[10px] text-white/25 text-center py-6">No role assignments found</div>
      ) : (
        roleGaps.map((gap) => (
          <div
            key={gap.role}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border",
              gap.isCompatible
                ? "bg-green-500/5 border-green-500/15"
                : "bg-red-500/5 border-red-500/15",
            )}
          >
            <div className={cn(
              "h-2 w-2 rounded-full shrink-0",
              gap.isCompatible ? "bg-green-400" : "bg-red-400",
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-white/70 capitalize">{gap.role}</span>
                <span className="text-[8px] text-white/30">{gap.provider}</span>
              </div>
              <div className="text-[8px] text-white/30 truncate">{gap.model}</div>
            </div>
            <div className="text-[8px] text-right shrink-0 max-w-[100px]">
              {gap.gaps.map((g, i) => (
                <div key={i} className={cn(gap.isCompatible ? "text-green-400/60" : "text-red-400/60")}>
                  {g}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function RoutingDecisionsView({ decisions }: { decisions: RoutingDecision[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? decisions : decisions.slice(-20)

  if (decisions.length === 0) {
    return <div className="text-[10px] text-white/25 text-center py-6">No routing decisions recorded</div>
  }

  return (
    <div className="space-y-0.5 px-2">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-[9px] text-white/30">{decisions.length} total decisions</span>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[8px] text-blue-400 hover:text-blue-300"
        >
          {showAll ? "Show recent 20" : "Show all"}
        </button>
      </div>
      {displayed.map((d) => (
        <div
          key={d.id}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded border",
            d.successful
              ? "bg-green-500/5 border-green-500/10"
              : "bg-red-500/5 border-red-500/10",
          )}
        >
          <div className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            d.successful ? "bg-green-400" : "bg-red-400",
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium text-white/60 capitalize">{d.source}</span>
              <span className="text-[8px] text-white/30">→ {d.role}</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] text-white/30">
              <span>{d.selectedProvider}</span>
              <span className="text-white/15">/</span>
              <span>{d.selectedModel}</span>
            </div>
          </div>
          <div className="text-[8px] text-white/30 shrink-0 text-right max-w-[80px]">
            {d.previousProvider && (
              <div className="truncate">{d.previousProvider} →</div>
            )}
            <div className="text-white/20">{new Date(d.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HealthTimeline({ providers }: { providers: ProviderComparisonRow[] }) {
  const sorted = [...providers].sort((a, b) => a.latencyMs - b.latencyMs)
  const maxLatency = Math.max(...sorted.map((p) => p.latencyMs), 1)

  return (
    <div className="space-y-1 px-2">
      {sorted.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full shrink-0",
            p.healthy ? "bg-green-400" : "bg-red-400",
          )} />
          <div className="w-16 text-[8px] text-white/50 truncate shrink-0">{p.name}</div>
          <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                p.healthy ? "bg-blue-500/40" : "bg-red-500/30",
              )}
              style={{ width: `${(p.latencyMs / maxLatency) * 100}%` }}
            />
          </div>
          <div className="w-10 text-right text-[8px] text-white/40 shrink-0">{p.latencyMs}ms</div>
        </div>
      ))}
    </div>
  )
}

function ProviderFilterBar({
  searchQuery,
  onSearchChange,
  filterHealthy,
  onFilterHealthyChange,
  filterLocal,
  onFilterLocalChange,
}: {
  searchQuery: string
  onSearchChange: (v: string) => void
  filterHealthy: boolean | null
  onFilterHealthyChange: (v: boolean | null) => void
  filterLocal: boolean | null
  onFilterLocalChange: (v: boolean | null) => void
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/5">
      <div className="flex items-center gap-1 flex-1 bg-white/5 rounded px-1.5 py-1 border border-white/8">
        <Search className="h-2.5 w-2.5 text-white/30 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter providers..."
          className="bg-transparent border-none outline-none text-[9px] text-white/60 placeholder:text-white/20 w-full"
        />
      </div>
      <button
        onClick={() => onFilterHealthyChange(filterHealthy === true ? null : true)}
        className={cn(
          "text-[8px] px-1.5 py-1 rounded border transition-colors",
          filterHealthy === true
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-white/5 border-white/8 text-white/30 hover:text-white/50",
        )}
      >
        Healthy
      </button>
      <button
        onClick={() => onFilterLocalChange(filterLocal === true ? null : true)}
        className={cn(
          "text-[8px] px-1.5 py-1 rounded border transition-colors",
          filterLocal === true
            ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
            : "bg-white/5 border-white/8 text-white/30 hover:text-white/50",
        )}
      >
        Local
      </button>
    </div>
  )
}

// ── Section Header ──

function SectionHeader({ icon: Icon, title, count }: { icon: typeof Server; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/5 sticky top-0 bg-[#0a0a0b] z-10">
      <Icon className="h-3 w-3 text-white/40" />
      <span className="text-[10px] font-medium text-white/60">{title}</span>
      {count !== undefined && (
        <span className="text-[8px] text-white/30 bg-white/5 px-1 py-0.5 rounded ml-auto">{count}</span>
      )}
    </div>
  )
}

// ── View Tabs ──

type ViewTab = "overview" | "matrix" | "fallbacks" | "roles" | "routing" | "latency"

const VIEW_TABS: { id: ViewTab; label: string; icon: typeof Server }[] = [
  { id: "overview", label: "Overview", icon: Server },
  { id: "matrix", label: "Capabilities", icon: Layers },
  { id: "fallbacks", label: "Fallbacks", icon: GitBranch },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "routing", label: "Routing", icon: Network },
  { id: "latency", label: "Latency", icon: Activity },
]

// ── Main Panel ──

export function ProviderUnifiedPanel({ className }: ProviderUnifiedPanelProps) {
  const [snapshot, setSnapshot] = useState<UnifiedProviderSnapshot | null>(null)
  const [activeView, setActiveView] = useState<ViewTab>("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterHealthy, setFilterHealthy] = useState<boolean | null>(null)
  const [filterLocal, setFilterLocal] = useState<boolean | null>(null)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const service = UnifiedProviderService.getInstance()
    const load = () => setSnapshot(service.getSnapshot())
    load()
    const interval = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    const service = UnifiedProviderService.getInstance()
    setSnapshot(service.getSnapshot())
    setTimeout(() => setIsRefreshing(false), 400)
  }

  const filteredProviders = useMemo(() => {
    if (!snapshot) return []
    let providers = snapshot.providers
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      providers = providers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.models.some((m) => m.toLowerCase().includes(q)),
      )
    }
    if (filterHealthy !== null) {
      providers = providers.filter((p) => p.healthy === filterHealthy)
    }
    if (filterLocal !== null) {
      providers = providers.filter((p) => p.isLocal === filterLocal)
    }
    return providers
  }, [snapshot, searchQuery, filterHealthy, filterLocal])

  const toggleProvider = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!snapshot) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", className)}>
        <div className="text-center px-4">
          <RefreshCw className="h-4 w-4 text-white/20 mx-auto mb-2 animate-spin" />
          <div className="text-[10px] text-white/25">Loading provider data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* View tabs */}
      <div className="flex items-center border-b border-white/8 shrink-0 overflow-x-auto">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-medium transition-all border-b-[1.5px] shrink-0",
                activeView === tab.id
                  ? "text-white/70 border-blue-400 bg-blue-500/5"
                  : "text-white/25 border-transparent hover:text-white/40 hover:bg-white/[0.02]",
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {tab.label}
            </button>
          )
        })}
        <button
          onClick={handleRefresh}
          className="ml-auto mr-1 p-1 text-white/20 hover:text-white/50 transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeView === "overview" && (
          <div className="space-y-3 pb-4">
            <StatsBar snapshot={snapshot} />

            {/* Filter bar */}
            <ProviderFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterHealthy={filterHealthy}
              onFilterHealthyChange={setFilterHealthy}
              filterLocal={filterLocal}
              onFilterLocalChange={setFilterLocal}
            />

            {/* Provider list */}
            <div className="space-y-1 px-2">
              {filteredProviders.length === 0 ? (
                <div className="text-[10px] text-white/25 text-center py-6">
                  {snapshot.providers.length === 0 ? "No providers registered" : "No providers match filters"}
                </div>
              ) : (
                filteredProviders.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    isExpanded={expandedProviders.has(p.id)}
                    onToggle={() => toggleProvider(p.id)}
                  />
                ))
              )}
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-1.5 px-2 pt-1">
              {snapshot.summary.unhealthyCount > 0 && (
                <div className="flex items-center gap-1 text-[8px] text-red-400/60 bg-red-500/5 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {snapshot.summary.unhealthyCount} provider{snapshot.summary.unhealthyCount > 1 ? "s" : ""} unhealthy
                </div>
              )}
              {snapshot.summary.rolesUncovered > 0 && (
                <div className="flex items-center gap-1 text-[8px] text-amber-400/60 bg-amber-500/5 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {snapshot.summary.rolesUncovered} role{snapshot.summary.rolesUncovered > 1 ? "s" : ""} uncovered
                </div>
              )}
              <div className="flex items-center gap-1 text-[8px] text-blue-400/60 bg-blue-500/5 px-1.5 py-0.5 rounded">
                <RefreshCw className="h-2.5 w-2.5" />
                Polling every {POLL_INTERVAL / 1000}s
              </div>
            </div>
          </div>
        )}

        {activeView === "matrix" && (
          <div className="pb-4">
            <SectionHeader icon={Layers} title="Provider Capability Matrix" count={snapshot.providers.length} />
            <div className="px-1 pt-1">
              <ComparisonMatrix matrix={snapshot.capabilityMatrix} />
            </div>
            {snapshot.providers.length === 0 && (
              <div className="text-[10px] text-white/25 text-center py-6">No providers to compare</div>
            )}
          </div>
        )}

        {activeView === "fallbacks" && (
          <div className="pb-4">
            <SectionHeader icon={GitBranch} title="Fallback Chains" count={snapshot.fallbackChains.length} />
            <div className="pt-1">
              <FallbackChainView chains={snapshot.fallbackChains} />
            </div>
          </div>
        )}

        {activeView === "roles" && (
          <div className="pb-4">
            <SectionHeader icon={Shield} title="Role Assignments" count={snapshot.roleGaps.length} />
            <div className="pt-1">
              <RoleAssignmentView roleGaps={snapshot.roleGaps} />
            </div>
          </div>
        )}

        {activeView === "routing" && (
          <div className="pb-4">
            <SectionHeader icon={Network} title="Routing Decisions" count={snapshot.routingDecisions.length} />
            <div className="pt-1">
              <RoutingDecisionsView decisions={snapshot.routingDecisions} />
            </div>
          </div>
        )}

        {activeView === "latency" && (
          <div className="pb-4">
            <SectionHeader icon={Activity} title="Latency Comparison" count={snapshot.providers.length} />
            <div className="pt-2">
              <HealthTimeline providers={snapshot.providers} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
