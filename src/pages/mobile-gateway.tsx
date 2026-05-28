import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@agentic-os/ui"
import { Smartphone, Globe, Cloud, Bell, Shield, ArrowRight, QrCode, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Globe,
    title: "Remote Supervision",
    description: "Monitor agent activity from any device with real-time streaming of logs, screenshots, and execution traces.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Cloud,
    title: "Cloud Orchestration",
    description: "Deploy agents to OCI compute instances for high-scale, parallel execution without local resource limits.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description: "Receive alerts when agents complete tasks, encounter errors, or require human approval to proceed.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Shield,
    title: "Approval Queue",
    description: "Review and approve or reject agent actions (file writes, command execution) from your mobile device.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: QrCode,
    title: "Quick Connect",
    description: "Scan a QR code from the desktop app to pair your mobile device instantly via WebRTC or relay server.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    icon: Radio,
    title: "Live Agent Feed",
    description: "View a live scroll of agent thoughts, tool calls, and outputs as they happen, optimized for mobile screens.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
]

export function MobileGatewayPage() {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mobile Gateway</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Remote mobile supervision — coming in Phase 2
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Phase 2
        </div>
      </div>

      {/* Status card */}
      <Card className="border-dashed border-2 bg-muted/10">
        <CardContent className="p-6 flex items-center gap-6">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/5 shrink-0">
            <Smartphone className="h-8 w-8 text-primary/40" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Mobile Gateway — Not Yet Available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This feature will enable remote supervision of your agentic-os agents from any mobile device.
              Stay tuned for Phase 2 development.
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                In development
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
                Planned for Q2 2026
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature preview cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" />
          Planned Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            const isExpanded = expanded === idx
            return (
              <Card
                key={idx}
                className={cn(
                  "cursor-pointer transition-all card-hover",
                  isExpanded && "ring-2 ring-primary/20"
                )}
                onClick={() => setExpanded(isExpanded ? null : idx)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg shrink-0", feature.bg)}>
                      <Icon className={cn("h-4.5 w-4.5", feature.color)} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{feature.title}</h3>
                      <p className={cn(
                        "text-xs text-muted-foreground transition-all",
                        isExpanded ? "mt-2" : "mt-0.5 line-clamp-1"
                      )}>
                        {feature.description}
                      </p>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground flex items-center gap-2">
                          <span className="inline-block h-1 w-1 rounded-full bg-green-500" />
                          UX mockup ready
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Architecture preview */}
      <Card className="border-dashed bg-muted/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-500/10">
                <Smartphone className="h-6 w-6 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Mobile App</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-lg">⟷</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">WebSocket / Relay</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-green-500/10">
                <Globe className="h-6 w-6 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">Relay Server</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-lg">⟷</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Tauri IPC</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/10">
                <Radio className="h-6 w-6 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground">Desktop App</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
