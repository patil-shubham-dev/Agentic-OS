import { useState, useRef, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { ProviderModel } from "@/types"
import { Search, X, CheckCircle2, RefreshCw, Loader2, Box, AlertTriangle } from "lucide-react"

interface ModelSelectorProps {
  models: ProviderModel[]
  selected: string[]
  onChange: (ids: string[]) => void
  loading: boolean
  onRefresh: () => void
  error?: string | null
}

function ModelSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-3.5 w-3.5 rounded border border-white/5 bg-white/[0.03] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-2 w-20 rounded bg-white/[0.02] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ModelSelector({ models, selected, onChange, loading, onRefresh, error }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return models
    const q = query.toLowerCase()
    return models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  }, [models, query])

  const grouped = useMemo(() => {
    const groups: Record<string, ProviderModel[]> = {}
    for (const m of filtered) {
      const prefix = m.id.includes("/") ? m.id.split("/")[0] : "other"
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(m)
    }
    return groups
  }, [filtered])

  const hasSelectedAll = models.length > 0 && selected.length === models.length

  function toggleSelectAll() {
    if (hasSelectedAll) {
      onChange([])
    } else {
      onChange(models.map((m) => m.id))
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all text-xs",
          open ? "border-blue-500/40 ring-1 ring-blue-500/20" : "border-white/10 bg-white/[0.03] hover:border-white/20",
        )}
      >
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
          {selected.length === 0 && (
            <span className="text-white/20">
              {loading ? "Fetching models..." : error ? "Discovery failed" : "Select models..."}
            </span>
          )}
          {selected.length > 0 && (
            <span className="text-white/60">
              {selected.length} model{selected.length !== 1 ? "s" : ""} selected
            </span>
          )}
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30 shrink-0" />
        ) : models.length > 0 ? (
          <RefreshCw
            onClick={(e) => { e.stopPropagation(); onRefresh() }}
            className="h-3.5 w-3.5 text-white/30 hover:text-white transition-colors shrink-0"
          />
        ) : null}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 z-50"
          >
            <div className="rounded-xl border border-white/10 bg-black/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center border-b border-white/5 px-3">
                <Search className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models..."
                  className="flex-1 h-9 bg-transparent px-2 text-xs text-white outline-none placeholder:text-white/20"
                  onClick={(e) => e.stopPropagation()}
                />
                {models.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRefresh() }}
                    className="p-1 text-white/30 hover:text-white transition-colors"
                    title="Refresh models"
                  >
                    <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                  </button>
                )}
              </div>

              {models.length > 0 && !loading && (
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasSelectedAll}
                      onChange={toggleSelectAll}
                      className="rounded border-white/20 bg-white/[0.03] text-blue-500 focus:ring-0 h-3 w-3"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[10px] text-white/40">Select all</span>
                  </label>
                  <span className="text-[9px] text-white/20">{models.length} models</span>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto">
                {loading && <ModelSkeleton />}

                {!loading && error && (
                  <div className="flex flex-col items-center py-8 px-4 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-400/60 mb-2" />
                    <p className="text-xs text-white/30 mb-1">Failed to load models</p>
                    <p className="text-[10px] text-white/20 mb-3">{error}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRefresh() }}
                      className="text-[10px] text-blue-400/60 hover:text-blue-400 underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                  <div className="py-8 text-center">
                    <Box className="h-5 w-5 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-white/30">
                      {query ? "No models match your search" : "No models available"}
                    </p>
                    {!query && (
                      <p className="text-[10px] text-white/20 mt-1">
                        Connect to a provider to discover models
                      </p>
                    )}
                  </div>
                )}

                {!loading && !error && Object.entries(grouped).map(([group, groupModels]) => (
                  <div key={group}>
                    {group !== "other" && (
                      <div className="px-3 py-1.5 text-[9px] text-white/30 font-medium uppercase tracking-wider">
                        {group}
                      </div>
                    )}
                    {groupModels.map((model) => {
                      const isSelected = selected.includes(model.id)
                      return (
                        <div
                          key={model.id}
                          onClick={() => onChange(isSelected ? selected.filter((s) => s !== model.id) : [...selected, model.id])}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 cursor-pointer transition-all",
                            isSelected ? "bg-blue-500/10" : "hover:bg-white/[0.03]",
                          )}
                        >
                          <div className={cn(
                            "h-3.5 w-3.5 rounded border flex items-center justify-center transition-all shrink-0",
                            isSelected ? "bg-blue-500 border-blue-500" : "border-white/20",
                          )}>
                            {isSelected && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-xs truncate",
                                isSelected ? "text-blue-300 font-medium" : "text-white/60",
                              )}>
                                {model.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {model.supportsTools && <span className="text-[9px] text-green-400/50">tools</span>}
                              {model.supportsVision && <span className="text-[9px] text-purple-400/50">vision</span>}
                              {model.contextWindow && (
                                <span className="text-[9px] text-white/20">
                                  {(model.contextWindow / 1000).toFixed(0)}K ctx
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.slice(0, 5).map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-mono text-blue-300">
              {models.find((m) => m.id === id)?.name || id}
              <button
                onClick={() => onChange(selected.filter((s) => s !== id))}
                className="hover:text-white transition-colors"
              >
                <X className="h-2 w-2" />
              </button>
            </span>
          ))}
          {selected.length > 5 && (
            <span className="text-[9px] text-white/30 px-1">+{selected.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  )
}
