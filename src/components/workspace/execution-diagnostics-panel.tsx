import { useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { useTimelineStore } from "./timeline/timeline-store"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { X, Bug, Cpu, Network, Route, Clock, Hash, Layers, Activity } from "lucide-react"

interface ExecutionDiagnosticsPanelProps {
  onClose: () => void
  open: boolean
}

export function ExecutionDiagnosticsPanel({ onClose, open }: ExecutionDiagnosticsPanelProps) {
  const events = useTimelineStore((s) => s.events)
  const agentSessions = useTimelineStore((s) => s.agentSessions)
  const streamingMetrics = useTimelineStore((s) => s.streamingMetrics)
  const sessionOrder = useTimelineStore((s) => s.sessionOrder)
  const activeRole = useAgentStore((s) => s.activeRole)
  const executionMode = useAgentStore((s) => s.executionMode)
  const agentAssignments = useAgentStore((s) => s.agentAssignments)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)

  const executionsByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
    }
    return counts
  }, [events])

  const agentDetails = useMemo(() => {
    return Array.from(agentSessions.entries()).map(([stepId, session]) => ({
      stepId,
      roleId: session.roleId,
      roleName: session.roleName,
      status: session.status,
      streamState: session.streamState,
      modelName: session.modelName ?? "—",
      providerName: session.providerName ?? "—",
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      toolCount: session.toolCalls.length,
      editCount: session.fileEdits.length,
      terminalCount: session.terminalOutputs.length,
      currentPhase: session.currentPhase,
      error: session.error,
    }))
  }, [agentSessions])

  const wiredDetails = useMemo(() => {
    return wiredAgents.map((a) => ({
      runtimeRole: a.runtimeRole,
      model: a.model,
      providerId: a.providerId,
      temperature: a.temperature,
      fallbackModel: (a as any).fallbackModel,
    }))
  }, [wiredAgents])

  const executionGraph = useMemo(() => {
    const nodes: { stepId: string; role: string; status: string }[] = []
    const edges: { from: string; to: string }[] = []
    let prevStepId: string | null = null
    for (const stepId of sessionOrder) {
      const session = agentSessions.get(stepId)
      if (session) {
        nodes.push({ stepId, role: session.roleName, status: session.status })
        if (prevStepId) {
          edges.push({ from: prevStepId, to: stepId })
        }
        prevStepId = stepId
      }
    }
    return { nodes, edges }
  }, [sessionOrder, agentSessions])

  if (!open) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="border-t border-white/[0.04] bg-black/40 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Bug className="h-3 w-3 text-amber-400/60" />
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
            Execution Diagnostics
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.03]">
        <div className="grid grid-cols-3 gap-px bg-white/[0.03]">
          <Section title="Runtime" icon={<Cpu className="h-2.5 w-2.5" />}>
            <Row label="Active Role" value={activeRole} />
            <Row label="Mode" value={executionMode} />
            <Row label="Wired Agents" value={String(wiredAgents.length)} />
            <Row label="Event Count" value={String(events.length)} />
          </Section>

          <Section title="Streaming" icon={<Activity className="h-2.5 w-2.5" />}>
            <Row label="Tokens rcvd" value={String(streamingMetrics.tokensReceived)} />
            <Row label="Tokens/s" value={String(streamingMetrics.tokensPerSecond.toFixed(1))} />
            <Row label="FTL" value={streamingMetrics.firstTokenLatency > 0 ? `${streamingMetrics.firstTokenLatency.toFixed(0)}ms` : "—"} />
            <Row label="Total latency" value={streamingMetrics.totalLatency > 0 ? `${streamingMetrics.totalLatency.toFixed(0)}ms` : "—"} />
          </Section>

          <Section title="Events" icon={<Hash className="h-2.5 w-2.5" />}>
            {Object.entries(executionsByType).slice(0, 8).map(([type, count]) => (
              <Row key={type} label={type} value={String(count)} mono />
            ))}
          </Section>
        </div>

        <div className="border-t border-white/[0.04]">
          <SectionBar title="Agent Sessions" icon={<Layers className="h-3 w-3" />} />
          {agentDetails.length === 0 ? (
            <Empty text="No active sessions" />
          ) : (
            agentDetails.map((ad) => (
              <div key={ad.stepId} className="px-3 py-1.5 border-b border-white/[0.02] last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    ad.status === "running" ? "bg-blue-400 animate-pulse" :
                    ad.status === "complete" ? "bg-emerald-400" : "bg-red-400"
                  }`} />
                  <span className="text-[10px] font-medium text-white/70">{ad.roleName}</span>
                  <span className="text-[8px] text-white/30 font-mono">{ad.stepId}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[9px] text-white/40">
                  <span>{ad.providerName} · {ad.modelName}</span>
                  {ad.startedAt && <span>Started {new Date(ad.startedAt).toLocaleTimeString()}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[8px] text-white/25">
                  <span>{ad.toolCount} tools</span>
                  <span>{ad.editCount} edits</span>
                  <span>{ad.terminalCount} terminals</span>
                  <span className="capitalize">{ad.streamState}</span>
                  {ad.currentPhase && <span>· {ad.currentPhase}</span>}
                </div>
                {ad.error && (
                  <div className="mt-0.5 text-[8px] text-red-400/60 font-mono truncate">{ad.error}</div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.04]">
          <SectionBar title="Wired Agents" icon={<Network className="h-3 w-3" />} />
          {wiredDetails.length === 0 ? (
            <Empty text="No wired agents" />
          ) : (
            wiredDetails.map((wd, i) => (
              <div key={i} className="px-3 py-1.5 border-b border-white/[0.02] text-[9px] text-white/50">
                <span className="font-medium text-white/70">{wd.runtimeRole}</span>
                <span className="ml-2">{wd.providerId}/{wd.model}</span>
                {wd.temperature != null && <span className="ml-2">temp={wd.temperature}</span>}
                {wd.fallbackModel && <span className="ml-2 text-amber-400/50">fallback={wd.fallbackModel}</span>}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.04]">
          <SectionBar title="Execution Graph" icon={<Route className="h-3 w-3" />} />
          {executionGraph.nodes.length === 0 ? (
            <Empty text="No executions" />
          ) : (
            <div className="px-3 py-2">
              {executionGraph.nodes.map((node, i) => (
                <div key={node.stepId} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-3 h-2 border-l border-b border-white/[0.08] ml-1" />}
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    node.status === "running" ? "bg-blue-400" :
                    node.status === "complete" ? "bg-emerald-400" : "bg-red-400"
                  }`} />
                  <span className="text-[9px] text-white/60">{node.role}</span>
                  <span className="text-[7px] text-white/20 font-mono">({node.stepId})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-black/20">
      <div className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-medium text-white/30 uppercase tracking-wider border-b border-white/[0.03]">
        {icon}
        {title}
      </div>
      <div className="px-2.5 py-1 space-y-0.5">{children}</div>
    </div>
  )
}

function SectionBar({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 text-[9px] font-medium text-white/30 uppercase tracking-wider bg-black/20">
      {icon}
      {title}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[9px]">
      <span className="text-white/30">{label}</span>
      <span className={`text-white/60 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-2 text-[9px] text-white/20 italic">{text}</div>
}
