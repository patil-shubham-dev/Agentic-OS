import React, { useState } from "react"
import { cn } from "@/lib/utils"
import {
  List,
  Wrench,
  Brain,
  Terminal,
  Activity,
  Wifi,
  Network,
  X,
  Layers,
  AlertTriangle,
  Gauge,
  Lightbulb,
  Database,
  GitBranch,
  Users,
  Server,
  History,
  Radio,
} from "lucide-react"
import { RuntimeTimeline } from "./RuntimeTimeline"
import { StreamingReasoningPanel } from "./StreamingReasoningPanel"
import { RuntimeTerminal } from "./RuntimeTerminal"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { ToolExecutionCard } from "./ToolExecutionCard"
import { StreamingDeltaInspector } from "./StreamingDeltaInspector"
import { TimelineWaterfall } from "./TimelineWaterfall"
import { AgentOrchestrationGraph } from "./AgentOrchestrationGraph"
import { AgentCognitionInspector } from "./AgentCognitionInspector"
import { ContextForensicsPanel } from "./ContextForensicsPanel"
import { FailureForensicsPanel } from "./FailureForensicsPanel"
import { TelemetryDashboard } from "./TelemetryDashboard"
import { MemoryPropagationPanel } from "./MemoryPropagationPanel"
import { CausalityGraphPanel } from "./CausalityGraphPanel"
import { ActorRuntimePanel } from "./ActorRuntimePanel"
import { ProviderUnifiedPanel } from "./ProviderUnifiedPanel"
import { AgentMeshPanel } from "./AgentMeshPanel"
import { ReplayPanel } from "./ReplayPanel"

type TabId = "timeline" | "tools" | "reasoning" | "terminal" | "waterfall" | "stream-inspector" | "agent-graph" | "cognition" | "context" | "failures" | "telemetry" | "memory" | "causality" | "actors" | "providers" | "replay" | "mesh"

interface TabDef {
  id: TabId
  label: string
  icon: typeof List
}

const TABS: TabDef[] = [
  { id: "timeline", label: "Timeline", icon: List },
  { id: "waterfall", label: "Spans", icon: Activity },
  { id: "stream-inspector", label: "Stream", icon: Wifi },
  { id: "agent-graph", label: "Agents", icon: Network },
  { id: "cognition", label: "Cognition", icon: Lightbulb },
  { id: "context", label: "Context", icon: Layers },
  { id: "failures", label: "Failures", icon: AlertTriangle },
  { id: "telemetry", label: "Telemetry", icon: Gauge },
  { id: "memory", label: "Memory", icon: Database },
  { id: "causality", label: "Causality", icon: GitBranch },
  { id: "actors", label: "Actors", icon: Users },
  { id: "replay", label: "Replay", icon: History },
  { id: "mesh", label: "Mesh", icon: Radio },
  { id: "providers", label: "Providers", icon: Server },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "reasoning", label: "Reasoning", icon: Brain },
  { id: "terminal", label: "Terminal", icon: Terminal },
]

interface RightPanelProps {
  className?: string
  onClose?: () => void
}

function TimelineTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <RuntimeTimeline className="h-full" />
    </div>
  )
}

function ToolsTab() {
  const activeTools = useRuntimeProjectionStore((s) => s.activeTools)
  const tools = Array.from(activeTools.values())

  if (tools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <Wrench className="h-4 w-4 text-white/20 mx-auto mb-2" />
          <div className="text-[10px] text-white/25">No active tool executions</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
      {tools.map((tool) => (
        <ToolExecutionCard key={tool.toolId} tool={tool} />
      ))}
    </div>
  )
}

function ReasoningTab() {
  return (
    <div className="flex-1 overflow-hidden px-2 py-2">
      <StreamingReasoningPanel className="h-full" />
    </div>
  )
}

function TerminalTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <RuntimeTerminal />
    </div>
  )
}

function WaterfallTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <TimelineWaterfall className="h-full" />
    </div>
  )
}

function StreamInspectorTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <StreamingDeltaInspector className="h-full" />
    </div>
  )
}

function AgentGraphTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <AgentOrchestrationGraph className="h-full" />
    </div>
  )
}

function CognitionTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <AgentCognitionInspector className="h-full" />
    </div>
  )
}

function ContextTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <ContextForensicsPanel className="h-full" />
    </div>
  )
}

function FailuresTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <FailureForensicsPanel className="h-full" />
    </div>
  )
}

function TelemetryTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <TelemetryDashboard className="h-full" />
    </div>
  )
}

function MemoryTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <MemoryPropagationPanel className="h-full" />
    </div>
  )
}

function CausalityTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <CausalityGraphPanel className="h-full" />
    </div>
  )
}

function ActorsTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <ActorRuntimePanel className="h-full" />
    </div>
  )
}

function ReplayTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <ReplayPanel className="h-full" />
    </div>
  )
}

function MeshTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <AgentMeshPanel className="h-full" />
    </div>
  )
}

function ProvidersTab() {
  return (
    <div className="flex-1 overflow-hidden">
      <ProviderUnifiedPanel className="h-full" />
    </div>
  )
}

const TAB_CONTENT: Record<TabId, () => React.JSX.Element> = {
  timeline: TimelineTab,
  waterfall: WaterfallTab,
  "stream-inspector": StreamInspectorTab,
  "agent-graph": AgentGraphTab,
  cognition: CognitionTab,
  context: ContextTab,
  failures: FailuresTab,
  telemetry: TelemetryTab,
  memory: MemoryTab,
  causality: CausalityTab,
  actors: ActorsTab,
  providers: ProvidersTab,
  replay: ReplayTab,
  mesh: MeshTab,
  tools: ToolsTab,
  reasoning: ReasoningTab,
  terminal: TerminalTab,
}

export function RightPanel({ className, onClose }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline")

  const Content = TAB_CONTENT[activeTab]

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b] border-l border-white/8", className)}>
      {/* Tabs header */}
      <div className="flex items-center border-b border-white/8 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-2 text-[9px] font-medium transition-all border-b-[1.5px]",
                activeTab === tab.id
                  ? "text-white/70 border-blue-400 bg-blue-500/5"
                  : "text-white/25 border-transparent hover:text-white/40 hover:bg-white/[0.02]",
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {tab.label}
            </button>
          )
        })}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto mr-1 p-1 text-white/20 hover:text-white/50 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tab content */}
      <Content />
    </div>
  )
}
