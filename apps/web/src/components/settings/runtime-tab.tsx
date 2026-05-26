import { useState } from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RuntimeConfig } from "@/types"
import {
  FolderOpen, Shield, Zap, AlertTriangle, Clock,
  Activity, Lock, Unlock,
  Plus, X,
} from "lucide-react"

export function RuntimeTab() {
  const [config, setConfig] = useState<RuntimeConfig>({
    sandboxEnabled: true,
    workspacePath: "./workspace",
    executionTimeout: 300,
    maxConcurrency: 3,
    autoApprovePatterns: ["*.test.ts", "*.spec.ts", "*.css", "*.md"],
    blockPatterns: ["rm -rf /", "sudo*", "chmod 777*"],
  })
  const [newAuto, setNewAuto] = useState("")
  const [newBlock, setNewBlock] = useState("")

  function addAutoPattern() {
    if (newAuto && !config.autoApprovePatterns.includes(newAuto)) {
      setConfig({ ...config, autoApprovePatterns: [...config.autoApprovePatterns, newAuto] })
      setNewAuto("")
    }
  }

  function addBlockPattern() {
    if (newBlock && !config.blockPatterns.includes(newBlock)) {
      setConfig({ ...config, blockPatterns: [...config.blockPatterns, newBlock] })
      setNewBlock("")
    }
  }

  function removeAutoPattern(p: string) {
    setConfig({ ...config, autoApprovePatterns: config.autoApprovePatterns.filter((x) => x !== p) })
  }

  function removeBlockPattern(p: string) {
    setConfig({ ...config, blockPatterns: config.blockPatterns.filter((x) => x !== p) })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Runtime Environment</h2>
        <p className="text-sm text-white/40">Configure execution environment, sandbox settings, and workspace behavior</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[
          { label: "Sandbox", value: config.sandboxEnabled ? "Active" : "Disabled", icon: Shield, color: config.sandboxEnabled ? "text-green-400" : "text-white/30" },
          { label: "Timeout", value: `${config.executionTimeout}s`, icon: Clock, color: "text-blue-400" },
          { label: "Max Concurrent", value: config.maxConcurrency.toString(), icon: Activity, color: "text-purple-400" },
          { label: "Auto-Approve", value: config.autoApprovePatterns.length.toString(), icon: Zap, color: "text-amber-400" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-6">
          {/* Workspace */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white/80 mb-4">Workspace</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">Workspace Path</Label>
                <div className="flex gap-2">
                  <Input value={config.workspacePath} onChange={(e) => setConfig({ ...config, workspacePath: e.target.value })} className="flex-1 h-10 border-white/10 bg-white/[0.03] text-white font-mono text-xs" />
                  <Button variant="outline" size="sm" className="h-10 border-white/10 text-white/50 hover:text-white">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sandbox */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white/80 mb-4">Sandbox</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {config.sandboxEnabled ? <Lock className="h-4 w-4 text-green-400" /> : <Unlock className="h-4 w-4 text-white/30" />}
                  <span className="text-xs text-white/60">Sandbox Isolation</span>
                </div>
                <Switch checked={config.sandboxEnabled} onCheckedChange={(v) => setConfig({ ...config, sandboxEnabled: v })} size="md" />
              </div>
              <p className="text-[10px] text-white/30">When enabled, all agent code execution is isolated in a secure sandbox environment</p>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">Execution Timeout (seconds)</Label>
                <input type="range" min="30" max="3600" step="30" value={config.executionTimeout} onChange={(e) => setConfig({ ...config, executionTimeout: parseInt(e.target.value) })} className="w-full accent-blue-500 h-1" />
                <div className="flex justify-between text-[10px] text-white/20">
                  <span>30s</span>
                  <span className="font-mono text-white/40">{config.executionTimeout}s</span>
                  <span>3600s</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">Max Concurrency</Label>
                <input type="range" min="1" max="10" value={config.maxConcurrency} onChange={(e) => setConfig({ ...config, maxConcurrency: parseInt(e.target.value) })} className="w-full accent-blue-500 h-1" />
                <div className="flex justify-between text-[10px] text-white/20">
                  <span>1</span>
                  <span className="font-mono text-white/40">{config.maxConcurrency}</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          {/* Auto-Approve */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white/80 mb-4">
              <Zap className="h-3.5 w-3.5 inline mr-1.5 text-amber-400" />
              Auto-Approve Patterns
            </h3>
            <p className="text-[10px] text-white/30 mb-3">File patterns that agents can modify without approval</p>
            <div className="flex gap-2 mb-3">
              <Input value={newAuto} onChange={(e) => setNewAuto(e.target.value)} placeholder="*.test.ts" className="flex-1 h-9 border-white/10 bg-white/[0.03] text-xs text-white font-mono" onKeyDown={(e) => e.key === "Enter" && addAutoPattern()} />
              <Button size="sm" variant="outline" className="h-9 border-white/10 text-white/50 hover:text-white" onClick={addAutoPattern}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.autoApprovePatterns.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1 text-[10px] font-mono text-green-400">
                  {p}
                  <button onClick={() => removeAutoPattern(p)} className="hover:text-red-400 transition-colors"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Block Patterns */}
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 backdrop-blur-xl">
            <h3 className="text-sm font-medium text-white/80 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 text-red-400" />
              Blocked Patterns
            </h3>
            <p className="text-[10px] text-white/30 mb-3">Commands and patterns that are never allowed</p>
            <div className="flex gap-2 mb-3">
              <Input value={newBlock} onChange={(e) => setNewBlock(e.target.value)} placeholder="rm -rf /" className="flex-1 h-9 border-white/10 bg-white/[0.03] text-xs text-white font-mono" onKeyDown={(e) => e.key === "Enter" && addBlockPattern()} />
              <Button size="sm" variant="outline" className="h-9 border-white/10 text-white/50 hover:text-white" onClick={addBlockPattern}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.blockPatterns.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-mono text-red-400">
                  {p}
                  <button onClick={() => removeBlockPattern(p)} className="hover:text-red-400 transition-colors"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
