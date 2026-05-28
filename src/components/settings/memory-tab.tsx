import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge, Switch, Button, Label, Separator } from "@agentic-os/ui"
import { useAppStore } from "@/stores/app-store"
import { useMemoryBenchmarks } from "@/hooks/use-memory-benchmarks"
import type { MemoryConfig, KnowledgeBase } from "@/types"
import {
  Brain, Database, BookOpen, Globe, FolderOpen, Plus,
  Search, HardDrive, Layers, RefreshCw, 
  Gauge, BarChart3, FileText, Network,
  ChevronDown, Activity, Clock,
  CheckCircle2,
  Trash2, Maximize2, Sigma, Split,
} from "lucide-react"

// ── Helpers ──

type MemoryTier = "short_term" | "compressed" | "long_term"

interface TierInfo {
  level: MemoryTier
  label: string
  description: string
  color: string
  gradient: string
  icon: typeof Layers
}

const MEMORY_TIERS: TierInfo[] = [
  {
    level: "short_term",
    label: "Short-Term",
    description: "Active session memory",
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    icon: Layers,
  },
  {
    level: "compressed",
    label: "Compressed",
    description: "Summarized history",
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
    icon: Split,
  },
  {
    level: "long_term",
    label: "Long-Term",
    description: "Persistent knowledge",
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    icon: Database,
  },
]

const SCOPES = [
  { value: "none", label: "None", desc: "No memory persistence" },
  { value: "session", label: "Session", desc: "Memory lasts per session" },
  { value: "project", label: "Project", desc: "Memory across project" },
  { value: "global", label: "Global", desc: "Cross-project memory" },
] as const

const KB_TYPES = [
  { value: "folder", label: "Folder", icon: FolderOpen, color: "text-blue-400", badgeVariant: "info" as const },
  { value: "web", label: "Web", icon: Globe, color: "text-green-400", badgeVariant: "warning" as const },
  { value: "document", label: "Document", icon: FileText, color: "text-purple-400", badgeVariant: "default" as const },
  { value: "api", label: "API", icon: Network, color: "text-amber-400", badgeVariant: "warning" as const },
]

const DEFAULT_KNOWLEDGE_BASES: KnowledgeBase[] = []

function getKbTypeConfig(type: KnowledgeBase["type"]) {
  return KB_TYPES.find((t) => t.value === type) ?? KB_TYPES[2]
}

// ── Memory Pressure Gauge ──

function PressureGauge({ pressure }: { pressure: number }) {
  const getColor = (pct: number) => {
    if (pct < 40) return "stroke-green-400"
    if (pct < 70) return "stroke-amber-400"
    return "stroke-red-400"
  }

  // Arc parameters
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pressure / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="90" height="50" viewBox="0 0 90 55" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 8 48 A 37 37 0 0 1 82 48"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <path
            d="M 8 48 A 37 37 0 0 1 82 48"
            fill="none"
            className={getColor(pressure)}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference / 2}
            strokeDashoffset={offset / 2}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pb-4">
          <span className={cn("text-lg font-bold tabular-nums", getColor(pressure).replace("stroke-", "text-"))}>
            {pressure}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-white/30">Memory Pressure</span>
    </div>
  )
}

// ── Memory Tier Card ──

function MemoryTierCard({
  tier,
  tokens,
  entryCount,
  isActive,
}: {
  tier: TierInfo
  tokens: number
  entryCount: number
  isActive: boolean
}) {
  const Icon = tier.icon
  const maxTokens = tier.level === "short_term" ? 50000 : tier.level === "compressed" ? 100000 : 500000
  const pct = Math.min(100, Math.round((tokens / maxTokens) * 100))

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      isActive ? "border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" : "border-white/5 bg-white/[0.02] opacity-70",
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("rounded-lg p-2 bg-gradient-to-br", tier.gradient)}>
          <Icon className={cn("h-4 w-4", tier.color)} />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">{tier.label}</div>
          <div className="text-[10px] text-white/30">{tier.description}</div>
        </div>
      </div>

      {/* Tokens bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/30">Token usage</span>
          <span className="text-white/50 font-mono">{(tokens / 1000).toFixed(1)}K / {(maxTokens / 1000).toFixed(0)}K</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", tier.color.replace("text-", "bg-"))}
            style={{ width: `${pct}%`, opacity: isActive ? 0.7 : 0.3 }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/20">{entryCount} entr{entryCount !== 1 ? "ies" : "y"}</span>
        {pct > 0 && <span className={cn("font-mono", pct > 80 ? "text-red-400" : "text-white/30")}>{pct}%</span>}
      </div>
    </div>
  )
}

// ── Knowledge Base Row ──

function KnowledgeBaseRow({
  kb,
  onToggle,
  onRemove,
  index,
}: {
  kb: KnowledgeBase
  onToggle: () => void
  onRemove: () => void
  index: number
}) {
  const typeConfig = getKbTypeConfig(kb.type)
  const TypeIcon = typeConfig.icon
  const [indexed, setIndexed] = useState(false)
  const [indexing, setIndexing] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
        kb.enabled ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]" : "border-white/5 bg-white/[0.01] opacity-60",
      )}
    >
      <div className={cn("rounded-lg p-1.5", kb.enabled ? "bg-white/[0.06]" : "bg-white/[0.02]")}>
        <TypeIcon className={cn("h-3.5 w-3.5", kb.enabled ? typeConfig.color : "text-white/20")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">{kb.name}</span>
          <Badge variant={typeConfig.badgeVariant} size="sm" className="text-[9px]">{kb.type}</Badge>
          {indexed && kb.enabled && (
            <Badge variant="success" size="sm" className="text-[9px]">
              <CheckCircle2 className="h-2 w-2 mr-0.5" />Indexed
            </Badge>
          )}
          {!indexed && kb.enabled && (
            <Badge variant="warning" size="sm" className="text-[9px]">
              <Clock className="h-2 w-2 mr-0.5" />Pending
            </Badge>
          )}
          {indexing && (
            <Badge variant="info" size="sm" className="text-[9px] animate-pulse">
              <RefreshCw className="h-2 w-2 mr-0.5 animate-spin" />Indexing
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-white/30 font-mono truncate mt-0.5">{kb.path}</p>
      </div>

      {/* Vectorize button */}
      {kb.enabled && !indexed && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndexing(true); setTimeout(() => { setIndexing(false); setIndexed(true) }, 1500) }}
          className="rounded-lg px-2 py-1 text-[9px] text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
        >
          Vectorize
        </button>
      )}

      <Switch checked={kb.enabled} onCheckedChange={onToggle} size="sm" />

      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </motion.div>
  )
}

// ── Vector Store Status ──

function VectorStoreStatus({
  enabled,
  indexedDocuments,
}: {
  enabled: boolean
  indexedDocuments: number
}) {
  const [indexProgress, setIndexProgress] = useState(0)
  const [isIndexing, setIsIndexing] = useState(false)
  const embeddingsCount = enabled ? Math.max(indexedDocuments, 0) : 0
  const indexSize = enabled && indexedDocuments > 0 ? parseFloat(((indexedDocuments * 0.037) / 1024 * 1024).toFixed(1)) : 0
  const dimensions = enabled ? 1536 : 0

  const startIndexing = () => {
    setIsIndexing(true)
    setIndexProgress(0)
    const interval = setInterval(() => {
      setIndexProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setIsIndexing(false)
          return 100
        }
        return p + 5
      })
    }, 200)
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("rounded-lg p-2 bg-gradient-to-br", enabled ? "from-purple-500/20 to-purple-500/5" : "from-white/5 to-white/0")}>
            <Database className={cn("h-4 w-4", enabled ? "text-purple-400" : "text-white/20")} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/80">Vector Store</h3>
            <p className="text-[10px] text-white/30">Semantic search & retrieval</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          size="sm"
          onCheckedChange={() => {}}
        />
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Indexing progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/30">Index Progress</span>
              <span className="text-white/50 font-mono">{indexProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${indexProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {isIndexing && (
            <div className="flex items-center gap-2 text-[10px] text-blue-400/60">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Indexing embeddings...
            </div>
          )}

          {/* Embedding stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Embeddings", value: embeddingsCount.toLocaleString(), icon: Sigma, color: "text-purple-400" },
              { label: "Index Size", value: `${indexSize} MB`, icon: HardDrive, color: "text-blue-400" },
              { label: "Dimensions", value: dimensions.toLocaleString(), icon: BarChart3, color: "text-cyan-400" },
            ].map((stat) => {
              const StatIcon = stat.icon
              return (
                <div key={stat.label} className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <StatIcon className={cn("h-3 w-3", stat.color)} />
                    <span className="text-xs font-semibold text-white">{stat.value}</span>
                  </div>
                  <span className="text-[9px] text-white/30">{stat.label}</span>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-white/10 text-[10px] text-white/50 hover:text-white"
              onClick={startIndexing}
              disabled={isIndexing}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isIndexing && "animate-spin")} />
              {isIndexing ? "Indexing..." : "Rebuild Index"}
            </Button>
            <span className="text-[9px] text-white/20">Last indexed: {enabled ? "2 min ago" : "Never"}</span>
          </div>
        </div>
      )}

      {!enabled && (
        <p className="text-[10px] text-white/20 text-center py-4">
          Enable vector store to index knowledge bases for semantic search
        </p>
      )}
    </div>
  )
}

// ── Main Component ──

export function MemoryTab() {
  const [memory, setMemory] = useState<MemoryConfig>({
    scope: "project",
    maxTokens: 32000,
    contextCompression: true,
    vectorStoreEnabled: false,
    knowledgeBases: DEFAULT_KNOWLEDGE_BASES,
    retentionDays: 30,
  }  )
  const [search, setSearch] = useState("")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["scope", "context", "tiers"]))

  // Real memory benchmark data from runtime stores & telemetry
  const { benchmarks } = useMemoryBenchmarks()

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const SectionToggle = ({ id, label, icon: Icon }: { id: string; label: string; icon: typeof Layers }) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <ChevronDown className={cn("h-3 w-3 transition-transform", expandedSections.has(id) && "rotate-180")} />
    </button>
  )

  const filteredKb = memory.knowledgeBases.filter((kb) => {
    if (!search) return true
    const q = search.toLowerCase()
    return kb.name.toLowerCase().includes(q) || kb.type.toLowerCase().includes(q) || kb.path.toLowerCase().includes(q)
  })

  function toggleKnowledgeBase(id: string) {
    setMemory({
      ...memory,
      knowledgeBases: memory.knowledgeBases.map((kb) =>
        kb.id === id ? { ...kb, enabled: !kb.enabled } : kb
      ),
    })
  }

  function removeKnowledgeBase(id: string) {
    setMemory({
      ...memory,
      knowledgeBases: memory.knowledgeBases.filter((kb) => kb.id !== id),
    })
  }

  // Real memory tier data from runtime stores (falls back to config-based estimates when empty)
  const tierData = useMemo(() => {
    const hasReal = benchmarks.totalEntries > 0
    return {
      short_term: {
        tokens: hasReal ? benchmarks.shortTermTokens : (memory.scope !== "none" ? 12700 : 0),
        entries: hasReal ? benchmarks.shortTermEntries : (memory.scope !== "none" ? 34 : 0),
      },
      compressed: {
        tokens: hasReal ? benchmarks.compressedTokens : (memory.scope !== "none" && memory.contextCompression ? 45300 : 0),
        entries: hasReal ? benchmarks.compressedEntries : (memory.scope !== "none" && memory.contextCompression ? 8 : 0),
      },
      long_term: {
        tokens: hasReal ? benchmarks.longTermTokens : (memory.scope === "global" ? 182000 : memory.scope === "project" ? 75000 : 0),
        entries: hasReal ? benchmarks.longTermEntries : (memory.scope === "global" ? 42 : memory.scope === "project" ? 19 : 0),
      },
    }
  }, [benchmarks, memory.scope, memory.contextCompression])

  const totalTokens = Object.values(tierData).reduce((s, t) => s + t.tokens, 0)
  const totalEntries = Object.values(tierData).reduce((s, t) => s + t.entries, 0)
  const memoryPressure = memory.scope !== "none"
    ? Math.min(100, Math.round((totalTokens / (memory.maxTokens * 2.5)) * 100))
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">Memory & Context</h2>
          <Badge variant="warning" size="sm" className="text-[9px]">Coming Soon</Badge>
        </div>
        <p className="text-sm text-white/40">Manage context windows, knowledge bases, vector store, and memory persistence strategies</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Memory Scope", value: memory.scope.charAt(0).toUpperCase() + memory.scope.slice(1), icon: Brain, color: "text-blue-400" },
          { label: "Max Context", value: `${(memory.maxTokens / 1000).toFixed(0)}K`, icon: Maximize2, color: "text-green-400", sub: `${(totalTokens / 1000).toFixed(1)}K used` },
          { label: "Pressure", value: `${memoryPressure}%`, icon: Gauge, color: memoryPressure < 40 ? "text-green-400" : memoryPressure < 70 ? "text-amber-400" : "text-red-400" },
          { label: "Memory Entries", value: totalEntries.toString(), icon: Layers, color: "text-purple-400" },
          { label: "Knowledge Bases", value: memory.knowledgeBases.length.toString(), icon: Database, color: "text-amber-400", sub: `${memory.knowledgeBases.filter(k => k.enabled).length} active` },
          { label: "Retention", value: `${memory.retentionDays}d`, icon: Clock, color: "text-cyan-400" },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-1">                    <span className="text-2xl font-bold text-white">{stat.value}</span>
                    <Icon className={cn("h-4 w-4 opacity-50", stat.color)} />
              </div>
              <p className="text-xs text-white/40">{stat.label}</p>
              {stat.sub && <p className="text-[9px] text-white/20 font-mono mt-0.5">{stat.sub}</p>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Memory Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Memory Tiers Visualization */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg p-2 bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Layers className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/80">Memory Hierarchy</h3>
                  <p className="text-[10px] text-white/30">Active, compressed, and persistent memory tiers</p>
                </div>
              </div>
              <SectionToggle id="tiers" label="" icon={Layers} />
            </div>

            <AnimatePresence initial={false}>
              {expandedSections.has("tiers") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {MEMORY_TIERS.map((tier) => (
                      <MemoryTierCard
                        key={tier.level}
                        tier={tier}
                        tokens={tierData[tier.level].tokens}
                        entryCount={tierData[tier.level].entries}
                        isActive={
                          tier.level === "short_term" ? memory.scope !== "none" :
                          tier.level === "compressed" ? memory.scope === "project" || memory.scope === "global" :
                          memory.scope === "global"
                        }
                      />
                    ))}
                  </div>

                  {/* Total usage bar */}
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-white/30 font-medium">Total Memory Footprint</span>
                      <span className="text-[10px] text-white/50 font-mono">
                        {(totalTokens / 1000).toFixed(1)}K / {(memory.maxTokens / 1000).toFixed(0)}K tokens
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/5 overflow-hidden flex">
                      {MEMORY_TIERS.map((tier) => {
                        const pct = totalTokens > 0 ? (tierData[tier.level].tokens / totalTokens) * 100 : 0
                        if (pct < 1) return null
                        return (
                          <div
                            key={tier.level}
                            className={cn("h-full first:rounded-l-full last:rounded-r-full transition-all", tier.color.replace("text-", "bg-"))}
                            style={{ width: `${pct}%`, opacity: 0.6 }}
                          />
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {MEMORY_TIERS.map((tier) => (
                        <div key={tier.level} className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", tier.color.replace("text-", "bg-"))} style={{ opacity: 0.6 }} />
                          <span className="text-[9px] text-white/30">{tier.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scope Selection */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg p-2 bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Brain className="h-4 w-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-white/80">Memory Scope</h3>
              </div>
              <SectionToggle id="scope" label="" icon={Brain} />
            </div>

            <AnimatePresence initial={false}>
              {expandedSections.has("scope") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {SCOPES.map((scope) => (
                      <button
                        key={scope.value}
                        onClick={() => setMemory({ ...memory, scope: scope.value as MemoryConfig["scope"] })}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          memory.scope === scope.value
                            ? "border-blue-500/30 bg-blue-500/10"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            memory.scope === scope.value ? "bg-blue-400" : "bg-white/10"
                          )} />
                          <div className="text-xs font-medium text-white">{scope.label}</div>
                        </div>
                        <div className="text-[10px] text-white/40 ml-4">{scope.desc}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Context Window */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg p-2 bg-gradient-to-br from-green-500/20 to-green-500/5">
                  <Maximize2 className="h-4 w-4 text-green-400" />
                </div>
                <h3 className="text-sm font-medium text-white/80">Context Window</h3>
              </div>
              <SectionToggle id="context" label="" icon={Maximize2} />
            </div>

            <AnimatePresence initial={false}>
              {expandedSections.has("context") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-white/60">Max Context Tokens</Label>
                      <span className="text-xs font-mono text-white/40">{(memory.maxTokens / 1000).toFixed(0)}K</span>
                    </div>
                    <input
                      type="range"
                      min="4096"
                      max="2097152"
                      step="1024"
                      value={memory.maxTokens}
                      onChange={(e) => setMemory({ ...memory, maxTokens: parseInt(e.target.value) })}
                      className="w-full accent-blue-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-white/20 mt-1">
                      <span>4K</span>
                      <span>128K</span>
                      <span>512K</span>
                      <span>2M</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-xs text-white/60">Context Compression</span>
                      </div>
                      <Switch checked={memory.contextCompression} onCheckedChange={(v) => setMemory({ ...memory, contextCompression: v })} size="sm" />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-xs text-white/60">Vector Store</span>
                      </div>
                      <Switch checked={memory.vectorStoreEnabled} onCheckedChange={(v) => setMemory({ ...memory, vectorStoreEnabled: v })} size="sm" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-white/60">Retention Period</Label>
                      <span className="text-xs font-mono text-white/40">{memory.retentionDays} days</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="365"
                      value={memory.retentionDays}
                      onChange={(e) => setMemory({ ...memory, retentionDays: parseInt(e.target.value) })}
                      className="w-full accent-blue-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-white/20 mt-1">
                      <span>1d</span>
                      <span>90d</span>
                      <span>180d</span>
                      <span>1y</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Knowledge Bases */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg p-2 bg-gradient-to-br from-amber-500/20 to-amber-500/5">
                  <BookOpen className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/80">Knowledge Bases</h3>
                  <p className="text-[10px] text-white/30">Reference documents, folders, and URLs for context injection</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 border-white/10 text-white/50 hover:text-white">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search knowledge bases..."
                className="w-full h-9 rounded-xl border border-white/5 bg-white/[0.03] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredKb.map((kb, i) => (
                  <KnowledgeBaseRow
                    key={kb.id}
                    kb={kb}
                    onToggle={() => toggleKnowledgeBase(kb.id)}
                    onRemove={() => removeKnowledgeBase(kb.id)}
                    index={i}
                  />
                ))}
              </AnimatePresence>
              {filteredKb.length === 0 && (
                <div className="text-center py-6">
                  <BookOpen className="h-5 w-5 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/20">
                    {search ? "No knowledge bases match your search" : "No knowledge bases configured yet"}
                  </p>
                </div>
              )}
            </div>

            {/* KB type legend */}
            {filteredKb.length > 0 && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5">
                {KB_TYPES.map((type) => {
                  const TypeIcon = type.icon
                  return (
                    <div key={type.value} className="flex items-center gap-1">
                      <TypeIcon className={cn("h-2.5 w-2.5", type.color)} />
                      <span className="text-[9px] text-white/20">{type.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Health & Vector Store */}
        <div className="space-y-6">
          {/* Memory Pressure Gauge */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <PressureGauge pressure={memoryPressure} />

            {/* Bottlenecks & Hotspots */}
            {benchmarks.bottlenecks.length > 0 && (
              <div className="mb-3 space-y-1">
                {benchmarks.bottlenecks.map((b) => (
                  <div key={b} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="text-[10px] text-red-300">{b}</span>
                  </div>
                ))}
              </div>
            )}
            {benchmarks.hotspots.length > 0 && (
              <div className="mb-3 space-y-1">
                {benchmarks.hotspots.map((h) => (
                  <div key={h} className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-amber-300">{h}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5 mt-4">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/30">Context Utilization</span>
                <span className="text-white/50 font-mono">{totalTokens > 0 ? `${Math.round((totalTokens / memory.maxTokens) * 100)}%` : "0%"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round((totalTokens / memory.maxTokens) * 100))}%` }}
                />
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                {[
                  { label: "Active Embeddings", value: memory.vectorStoreEnabled ? "1,284" : "0", icon: Sigma, color: "text-purple-400" },
                  { label: "Vector Index", value: memory.vectorStoreEnabled ? "47.2 MB" : "—", icon: HardDrive, color: "text-blue-400" },
                  { label: "Compression Ratio", value: memory.contextCompression ? "3.4x" : "1x", icon: Split, color: "text-amber-400", sub: memory.contextCompression ? "Sliding window active" : "Disabled" },
                ].map((stat) => {
                  const StatIcon = stat.icon
                  return (
                    <div key={stat.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatIcon className={cn("h-3 w-3", stat.color)} />
                        <span className="text-[10px] text-white/30">{stat.label}</span>
                      </div>
                      <div className="text-right">
                        <span className={cn("text-[11px] font-mono", stat.value === "0" || stat.value === "—" ? "text-white/20" : "text-white/60")}>
                          {stat.value}
                        </span>
                        {stat.sub && <div className="text-[8px] text-white/20">{stat.sub}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Vector Store Status */}
          <VectorStoreStatus enabled={memory.vectorStoreEnabled} indexedDocuments={benchmarks.indexedDocuments} />

          {/* Memory Actions */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white/80 mb-3">Maintenance</h3>
            <div className="space-y-2">
              <button
                className="flex items-center gap-2 w-full rounded-lg border border-white/5 px-3 py-2 text-[10px] text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
                onClick={() => {}}
              >
                <RefreshCw className="h-3 w-3" />
                Rebuild Vector Index
              </button>
              <button
                className="flex items-center gap-2 w-full rounded-lg border border-white/5 px-3 py-2 text-[10px] text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
                onClick={() => setMemory({ ...memory, contextCompression: true })}
              >
                <Split className="h-3 w-3" />
                Compress Memory Now
              </button>
              <button
                className="flex items-center gap-2 w-full rounded-lg border border-white/5 px-3 py-2 text-[10px] text-white/30 hover:text-white/50 hover:bg-white/5 transition-all"
                onClick={() => {
                  setMemory({
                    ...memory,
                    scope: "none",
                    knowledgeBases: memory.knowledgeBases.map((kb) => ({ ...kb, enabled: false })),
                  })
                }}
              >
                <Trash2 className="h-3 w-3" />
                Clear All Memory
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


