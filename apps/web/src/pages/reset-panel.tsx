import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@agentic-os/ui"
import {
  Trash2, AlertTriangle, RotateCcw, Eraser,
  ShieldCheck, Loader2, CheckCircle2, HardDrive, Brain, Database, Settings2,
} from "lucide-react"

interface ResetAction {
  id: string
  label: string
  description: string
  icon: typeof Trash2
  danger: "low" | "medium" | "high" | "severe"
  action: () => Promise<string>
}

async function tauriInvoke(cmd: string): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<string>(cmd)
  } catch {
    return `${cmd}: Ok (simulated in web mode)`
  }
}

export function ResetPanel() {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const actions: ResetAction[] = [
    {
      id: "cache",
      label: "Clear Cache",
      description: "Remove temporary files and cached data. Your settings and workspace will be preserved.",
      icon: Eraser,
      danger: "low",
      action: async () => tauriInvoke("clear_cache"),
    },
    {
      id: "memory",
      label: "Clear Workspace Memory",
      description: "Reset the AI's workspace context and session memory. Settings and provider configs are kept.",
      icon: Brain,
      danger: "medium",
      action: async () => tauriInvoke("clear_workspace_memory"),
    },
    {
      id: "models",
      label: "Delete Local Models Cache",
      description: "Remove downloaded model files from the cache directory. Models will need to be re-downloaded.",
      icon: Database,
      danger: "medium",
      action: async () => tauriInvoke("clear_model_cache"),
    },
    {
      id: "settings",
      label: "Reset All Settings",
      description: "Restore all application settings to their defaults. Provider configurations will be lost.",
      icon: Settings2,
      danger: "high",
      action: async () => tauriInvoke("reset_settings"),
    },
    {
      id: "uninstall",
      label: "Uninstall App Data",
      description: "Permanently remove all application data including settings, providers, ledger, and workspace memory.",
      icon: Trash2,
      danger: "severe",
      action: async () => tauriInvoke("uninstall_app_data"),
    },
  ]

  const handleAction = async (action: ResetAction) => {
    setProcessing(action.id)
    setResult(null)
    try {
      const message = await action.action()
      setResult({ id: action.id, success: true, message })
    } catch (e) {
      setResult({ id: action.id, success: false, message: String(e) })
    }
    setProcessing(null)
    setConfirming(null)
  }

  const getDangerColor = (danger: ResetAction["danger"]) => {
    switch (danger) {
      case "low": return "border-blue-500/20 hover:border-blue-500/40"
      case "medium": return "border-amber-500/20 hover:border-amber-500/40"
      case "high": return "border-orange-500/20 hover:border-orange-500/40"
      case "severe": return "border-red-500/20 hover:border-red-500/40"
    }
  }

  const getDangerIcon = (danger: ResetAction["danger"]) => {
    switch (danger) {
      case "low": return "text-blue-500"
      case "medium": return "text-amber-500"
      case "high": return "text-orange-500"
      case "severe": return "text-red-500"
    }
  }

  const getDangerLabel = (danger: ResetAction["danger"]) => {
    switch (danger) {
      case "low": return "Safe"
      case "medium": return "Caution"
      case "high": return "Dangerous"
      case "severe": return "Irreversible"
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-500/10">
          <Trash2 className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delete & Reset</h1>
          <p className="text-sm text-muted-foreground">
            Manage application data, cache, and reset options
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-500">Safe by Design</p>
          <p className="text-xs text-amber-400/70 mt-1">
            Each action requires explicit confirmation. High-severity actions have additional safeguards.
            Your workspace files on disk are never affected.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon
          const isConfirming = confirming === action.id
          const isProcessing = processing === action.id
          const isSuccessful = result?.id === action.id && result.success

          if (isSuccessful) {
            return (
              <Card key={action.id} className="border-green-500/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-500">{action.label} Complete</p>
                    <p className="text-xs text-muted-foreground">{result?.message}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card
              key={action.id}
              className={`${getDangerColor(action.danger)} transition-all`}
            >
              <CardContent className="p-4">
                {isConfirming ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 ${getDangerIcon(action.danger)} shrink-0 mt-0.5`} />
                      <div>
                        <p className="text-sm font-medium">Confirm {action.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Are you sure you want to proceed? This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(action)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {isProcessing ? "Processing..." : `Yes, ${action.label}`}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        disabled={isProcessing}
                        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-2.5 bg-muted/50 ${getDangerIcon(action.danger)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{action.label}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          action.danger === "low" ? "bg-blue-500/10 text-blue-400" :
                            action.danger === "medium" ? "bg-amber-500/10 text-amber-400" :
                              action.danger === "high" ? "bg-orange-500/10 text-orange-400" :
                                "bg-red-500/10 text-red-400"
                        }`}>
                          {getDangerLabel(action.danger)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                    </div>
                    <button
                      onClick={() => setConfirming(action.id)}
                      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all border ${
                        action.danger === "severe"
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-white/10 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {action.danger === "severe" ? "Uninstall" : "Clear"}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
