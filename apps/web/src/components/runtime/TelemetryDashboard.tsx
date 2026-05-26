import { useState, useEffect, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { RuntimeTelemetryEngine } from "@/runtime/observability/RuntimeTelemetryEngine"
import type { RuntimeMetrics, PerformanceSnapshot } from "@/runtime/observability/ObservabilityTypes"
import {
  Activity,
  Zap,
  Timer,
  Thermometer,
  Gauge,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  BarChart3,
  LineChart,
  PieChart,
  ChevronDown,
  ChevronRight,
  Cpu,
  Wifi,
  Database,
} from "lucide-react"

interface TelemetryDashboardProps {
  className?: string
}

// ── Metric Card ──

interface MetricDef {
  label: string
  value: string
  unit: string
  icon: typeof Activity
  status: "good" | "warning" | "critical"
  detail?: string
}

function MetricCard({ metric, onClick }: { metric: MetricDef; onClick?: () => void }) {
  const Icon = metric.icon
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1.5 transition-all cursor-pointer",
        metric.status === "good" ? "border-green-500/20 bg-green-500/[0.02] hover:bg-green-500/[0.04]" :
        metric.status === "warning" ? "border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.04]" :
        "border-red-500/20 bg-red-500/[0.02] hover:bg-red-500/[0.04]",
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        <Icon className={cn(
          "h-2.5 w-2.5",
          metric.status === "good" ? "text-green-400" :
          metric.status === "warning" ? "text-amber-400" : "text-red-400",
        )} />
        <span className="text-[7px] text-white/25 uppercase tracking-wider">{metric.label}</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[13px] font-semibold font-mono text-white/80 tabular-nums">{metric.value}</span>
        <span className="text-[8px] text-white/30 font-mono">{metric.unit}</span>
      </div>
      {metric.detail && (
        <div className="mt-0.5 text-[7px] text-white/25">{metric.detail}</div>
      )}
    </div>
  )
}

// ── Latency Gauge ──

function LatencyGauge({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, (value / max) * 100)
  const status = pct > 80 ? "critical" : pct > 50 ? "warning" : "good"

  return (
    <div className="bg-white/[0.02] rounded px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] text-white/30">{label}</span>
        <span className={cn(
          "text-[10px] font-mono",
          status === "good" ? "text-green-400" :
          status === "warning" ? "text-amber-400" : "text-red-400",
        )}>
          {value.toFixed(1)} <span className="text-[7px] text-white/25">{unit}</span>
        </span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            status === "good" ? "bg-green-400" :
            status === "warning" ? "bg-amber-400" : "bg-red-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Bottleneck List ──

function BottleneckList({ bottlenecks }: { bottlenecks: string[] }) {
  if (bottlenecks.length === 0) {
    return (
      <div className="flex items-center gap-1 text-[8px] text-green-400/60">
        <CheckCircle2 className="h-2 w-2" />
        No bottlenecks detected
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {bottlenecks.map((b, i) => (
        <div key={i} className="flex items-center gap-1 text-[8px] text-amber-400/80">
          <AlertTriangle className="h-2 w-2 shrink-0" />
          <span>{b}</span>
        </div>
      ))}
    </div>
  )
}

// ── Snapshot Mini-chart ──

function SnapshotTimeline({ snapshots }: { snapshots: PerformanceSnapshot[] }) {
  if (snapshots.length < 2) return null

  const key = "firstTokenLatencyMs" as keyof RuntimeMetrics
  const values = snapshots.map((s) => s.metrics[key])
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <LineChart className="h-2 w-2" /> First Token Latency Trend
      </span>
      <div className="flex items-end gap-px h-12 bg-white/[0.02] rounded px-1 pt-1">
        {values.slice(-40).map((v, i) => {
          const height = ((v - min) / (max - min || 1)) * 100
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${Math.max(2, height)}%`,
                background: v > max * 0.8
                  ? "linear-gradient(to top, #ef4444, #dc2626)"
                  : v > max * 0.5
                    ? "linear-gradient(to top, #f59e0b, #d97706)"
                    : "linear-gradient(to top, #10b981, #059669)",
                opacity: 0.8,
              }}
              title={`${v.toFixed(1)}ms`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[7px] text-white/20">
        <span>{min.toFixed(0)}ms</span>
        <span>{max.toFixed(0)}ms</span>
      </div>
    </div>
  )
}

// ── Main Component ──

export function TelemetryDashboard({ className }: TelemetryDashboardProps) {
  const engine = RuntimeTelemetryEngine.getInstance()
  const [metrics, setMetrics] = useState<RuntimeMetrics>(engine.getMetrics())
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([])
  const [uptime, setUptime] = useState("")
  const [expandedSection, setExpandedSection] = useState<string | null>("latency")

  useEffect(() => {
    const refresh = () => {
      const m = engine.getMetrics()
      setMetrics(m)
      setSnapshots(engine.getSnapshots(50))
      setUptime(formatUptime(engine.getUptimeMs()))
    }
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [engine])

  const formatUptime = (ms: number): string => {
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m ${((ms % 60000) / 1000).toFixed(0)}s`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  const latencyMs = metrics.firstTokenLatencyMs
  const rttMs = metrics.providerRttMs
  const throughput = metrics.streamThroughputTokensPerSec
  const memPressure = metrics.memoryPressurePct
  const queueCong = metrics.queueCongestion

  const metricDefs: MetricDef[] = [
    { label: "First Token", value: latencyMs.toFixed(1), unit: "ms", icon: Zap, status: latencyMs > 5000 ? "critical" : latencyMs > 2000 ? "warning" : "good", detail: `P95: ${engine.getP95Latency().toFixed(1)}ms` },
    { label: "Provider RTT", value: rttMs.toFixed(0), unit: "ms", icon: Timer, status: rttMs > 3000 ? "critical" : rttMs > 1000 ? "warning" : "good" },
    { label: "Throughput", value: throughput.toFixed(0), unit: "tok/s", icon: TrendingUp, status: throughput < 10 ? "critical" : throughput < 50 ? "warning" : "good" },
    { label: "Memory", value: memPressure.toFixed(0), unit: "%", icon: Database, status: memPressure > 80 ? "critical" : memPressure > 50 ? "warning" : "good" },
    { label: "Queue", value: queueCong.toFixed(0), unit: "items", icon: Activity, status: queueCong > 50 ? "critical" : queueCong > 20 ? "warning" : "good" },
    { label: "Spans", value: metrics.activeSpans.toString(), unit: "active", icon: BarChart3, status: "good" as const },
    { label: "Traces", value: metrics.activeTraces.toString(), unit: "active", icon: LineChart, status: "good" as const },
    { label: "Uptime", value: uptime, unit: "", icon: Clock, status: "good" as const },
  ]

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-emerald-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Telemetry</span>
        </div>
        <button
          onClick={() => engine.takeSnapshot()}
          className="rounded p-0.5 text-white/20 hover:text-white/50 transition-all"
          title="Take snapshot"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-white/[0.04]">
        {metricDefs.slice(0, 4).map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-white/[0.04]">
        {metricDefs.slice(4).map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      {/* Bottlenecks */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-1 mb-0.5">
          <AlertTriangle className="h-2 w-2 text-amber-400" />
          <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider">Bottlenecks & Hotspots</span>
        </div>
        <BottleneckList bottlenecks={snapshots[snapshots.length - 1]?.bottlenecks ?? []} />
      </div>

      {/* Expandable sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Latency section */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === "latency" ? null : "latency")}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
          >
            {expandedSection === "latency" ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            <Timer className="h-2.5 w-2.5" />
            Latency Metrics
          </button>
          {expandedSection === "latency" && (
            <div className="px-2 py-1.5 space-y-1">
              <LatencyGauge label="Context Assembly" value={metrics.contextAssemblyLatencyMs} max={5000} unit="ms" />
              <LatencyGauge label="Retrieval" value={metrics.retrievalLatencyMs} max={3000} unit="ms" />
              <LatencyGauge label="Tool Execution" value={metrics.toolExecutionLatencyMs} max={5000} unit="ms" />
              <LatencyGauge label="First Token (Provider)" value={metrics.firstTokenLatencyMs} max={8000} unit="ms" />
              {snapshots.length > 1 && <SnapshotTimeline snapshots={snapshots} />}
            </div>
          )}
        </div>

        {/* Throughput section */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === "throughput" ? null : "throughput")}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
          >
            {expandedSection === "throughput" ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            <TrendingUp className="h-2.5 w-2.5" />
            Throughput Metrics
          </button>
          {expandedSection === "throughput" && (
            <div className="px-2 py-1.5 space-y-1">
              <div className="grid grid-cols-2 gap-1 text-[8px]">
                <div className="bg-white/[0.02] rounded px-1.5 py-1">
                  <span className="text-white/25 block text-[7px] uppercase">Stream</span>
                  <span className="text-white/60 font-mono">{metrics.streamThroughputTokensPerSec.toFixed(0)} tok/s</span>
                </div>
                <div className="bg-white/[0.02] rounded px-1.5 py-1">
                  <span className="text-white/25 block text-[7px] uppercase">Events</span>
                  <span className="text-white/60 font-mono">{metrics.eventThroughputEventsPerSec.toFixed(0)} ev/s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Snapshots section */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === "snapshots" ? null : "snapshots")}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
          >
            {expandedSection === "snapshots" ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            <RefreshCw className="h-2.5 w-2.5" />
            Snapshots ({snapshots.length})
          </button>
          {expandedSection === "snapshots" && (
            <div className="px-2 py-1.5 space-y-0.5 max-h-24 overflow-y-auto">
              {snapshots.slice(-10).reverse().map((s, i) => (
                <div key={s.timestamp} className="flex items-center justify-between text-[8px]">
                  <span className="text-white/30 font-mono">T+{((s.timestamp - (snapshots[0]?.timestamp ?? s.timestamp)) / 1000).toFixed(0)}s</span>
                  <span className={cn(
                    "font-mono",
                    s.metrics.firstTokenLatencyMs > 5000 ? "text-red-400" :
                    s.metrics.firstTokenLatencyMs > 2000 ? "text-amber-400" : "text-green-400",
                  )}>
                    {s.metrics.firstTokenLatencyMs.toFixed(0)}ms
                  </span>
                  <span className="text-white/25">{s.metrics.streamThroughputTokensPerSec.toFixed(0)} t/s</span>
                  {s.bottlenecks.length > 0 && (
                    <AlertTriangle className="h-2 w-2 text-amber-400" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
