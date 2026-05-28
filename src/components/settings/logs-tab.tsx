import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge, Button } from "@agentic-os/ui"
import type { LogEntry, UsageStats } from "@/types"
import {
  BarChart3, Search, Download, Layers,
  Activity, AlertTriangle, Info, CheckCircle2,
  XCircle, Calendar, Gauge, Zap, RefreshCw,
} from "lucide-react"

const MOCK_LOGS: LogEntry[] = [
  { id: "l1", timestamp: new Date(Date.now() - 5000).toISOString(), type: "success", category: "provider", message: "OpenAI connection established", agent: "Manager Agent", tokens: 150, duration: 245 },
  { id: "l2", timestamp: new Date(Date.now() - 15000).toISOString(), type: "info", category: "agent", message: "Coding Agent started task: Implement user auth", agent: "Coding Agent", tokens: 0, duration: 0 },
  { id: "l3", timestamp: new Date(Date.now() - 30000).toISOString(), type: "warning", category: "memory", message: "Context window at 85% capacity", agent: "Memory Manager", tokens: 28000, duration: 12 },
  { id: "l4", timestamp: new Date(Date.now() - 60000).toISOString(), type: "error", category: "tool", message: "Git push failed: authentication required", agent: "Coding Agent", tokens: 0, duration: 1500 },
  { id: "l5", timestamp: new Date(Date.now() - 120000).toISOString(), type: "success", category: "provider", message: "Anthropic API response received", agent: "Design Agent", tokens: 4500, duration: 890 },
  { id: "l6", timestamp: new Date(Date.now() - 300000).toISOString(), type: "info", category: "runtime", message: "Sandbox initialized", agent: "Runtime Agent", tokens: 0, duration: 320 },
  { id: "l7", timestamp: new Date(Date.now() - 600000).toISOString(), type: "success", category: "agent", message: "Task completed: Generate dashboard UI", agent: "Design Agent", tokens: 12000, duration: 45000 },
  { id: "l8", timestamp: new Date(Date.now() - 900000).toISOString(), type: "warning", category: "provider", message: "Rate limit approaching for OpenAI", agent: "Manager Agent", tokens: 45000, duration: 2340 },
]

const MOCK_USAGE: UsageStats = {
  totalTokens: 89500,
  totalRequests: 234,
  avgLatency: 423,
  activeModels: 4,
  topProvider: "OpenAI",
  dailyUsage: [
    { date: "Mon", tokens: 12000 },
    { date: "Tue", tokens: 18500 },
    { date: "Wed", tokens: 22000 },
    { date: "Thu", tokens: 15000 },
    { date: "Fri", tokens: 14000 },
    { date: "Sat", tokens: 4500 },
    { date: "Sun", tokens: 3500 },
  ],
}

export function LogsTab() {
  const [logs] = useState<LogEntry[]>(MOCK_LOGS)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [usage] = useState<UsageStats>(MOCK_USAGE)

  const categories = [...new Set(logs.map((l) => l.category))]

  const filtered = logs.filter((l) => {
    if (typeFilter !== "all" && l.type !== typeFilter) return false
    if (categoryFilter !== "all" && l.category !== categoryFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return l.message.toLowerCase().includes(q) || (l.agent || "").toLowerCase().includes(q)
  })

  const maxDailyTokens = Math.max(...usage.dailyUsage.map((d) => d.tokens))

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Logs & Usage</h2>
        <p className="text-sm text-white/40">Monitor audit logs, track API usage, and analyze execution patterns</p>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tokens", value: `${(usage.totalTokens / 1000).toFixed(1)}K`, icon: Activity, color: "text-blue-400" },
          { label: "Active Models", value: `${usage.activeModels}`, icon: Layers, color: "text-amber-400" },
          { label: "Avg Latency", value: `${usage.avgLatency}ms`, icon: Gauge, color: "text-amber-400" },
          { label: "Requests", value: usage.totalRequests.toString(), icon: Zap, color: "text-purple-400" },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{stat.value}</span>
                <Icon className={cn("h-5 w-5 opacity-60", stat.color)} />
              </div>
              <p className="text-xs text-white/40 mt-1">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Daily Usage Chart */}
      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white/80">Daily Token Usage</h3>
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <Calendar className="h-3 w-3" />
            Last 7 days
          </div>
        </div>
        <div className="flex items-end gap-2 h-32">
          {usage.dailyUsage.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] font-mono text-white/30">{day.tokens >= 1000 ? `${(day.tokens / 1000).toFixed(0)}K` : day.tokens}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(day.tokens / maxDailyTokens) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-t-md bg-gradient-to-t from-blue-500/40 to-purple-500/20 hover:from-blue-500/60 transition-all cursor-pointer"
                style={{ maxHeight: "100px" }}
              />
              <span className="text-[9px] text-white/30">{day.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="w-full h-10 rounded-xl border border-white/5 bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/10" />
        </div>
        <div className="flex gap-1">
          {["all", "success", "info", "warning", "error"].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all capitalize", typeFilter === t ? "bg-white/10 text-white border border-white/10" : "text-white/30 hover:text-white/50 border border-transparent")}>{t}</button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-9 border-white/10 text-white/50 hover:text-white">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" variant="outline" className="h-9 border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setCategoryFilter("all")} className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-all", categoryFilter === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50")}>All Categories</button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-all capitalize", categoryFilter === cat ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50")}>{cat}</button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Message</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Agent</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Tokens</th>

                <th className="text-right px-4 py-3 text-[10px] font-medium text-white/30 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((log) => (
                  <motion.tr
                    key={log.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      {log.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> :
                       log.type === "error" ? <XCircle className="h-3.5 w-3.5 text-red-400" /> :
                       log.type === "warning" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> :
                       <Info className="h-3.5 w-3.5 text-blue-400" />}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-white/40 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        log.category === "provider" ? "info" :
                        log.category === "agent" ? "success" :
                        log.category === "memory" ? "purple" :
                        log.category === "tool" ? "warning" :
                        "default"
                      } size="sm">{log.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70 max-w-xs truncate">{log.message}</td>
                    <td className="px-4 py-3 text-xs text-white/40 font-mono">{log.agent || "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/40 font-mono text-right">{log.tokens ? `${(log.tokens / 1000).toFixed(1)}K` : "—"}</td>

                    <td className="px-4 py-3 text-xs text-white/40 font-mono text-right">{log.duration ? `${log.duration}ms` : "—"}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No logs match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}


