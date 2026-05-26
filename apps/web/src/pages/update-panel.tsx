import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@agentic-os/ui"
import {
  RefreshCw, Download, RotateCcw, CheckCircle2,
  AlertTriangle, Loader2, ArrowUpCircle, Clock,
} from "lucide-react"

interface UpdateStatus {
  update_available: boolean
  current_version: string
  latest_version: string | null
  release_notes: string[] | null
  download_progress: number | null
  status: string
}

export function UpdatePanel() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [autoUpdate, setAutoUpdate] = useState(() => {
    return localStorage.getItem("auto-update") !== "false"
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkForUpdates()
  }, [])

  useEffect(() => {
    localStorage.setItem("auto-update", String(autoUpdate))
  }, [autoUpdate])

  const checkForUpdates = async () => {
    setChecking(true)
    setError(null)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const result = await invoke<UpdateStatus>("check_for_updates")
      setStatus(result)
    } catch {
      setError("Update service only available in desktop app")
      setStatus({
        update_available: false,
        current_version: "1.0.0 (web)",
        latest_version: null,
        release_notes: null,
        download_progress: null,
        status: "error",
      })
    }
    setChecking(false)
  }

  const performUpdate = async () => {
    setUpdating(true)
    setError(null)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("perform_update")
      setStatus((prev) => prev ? { ...prev, status: "installed" } : null)
    } catch (e) {
      setError(String(e))
    }
    setUpdating(false)
  }

  const getStatusBadge = () => {
    if (!status) return { label: "Unknown", color: "text-muted-foreground" }
    switch (status.status) {
      case "up_to_date":
        return { label: "Up to Date", color: "text-green-500" }
      case "update_available":
        return { label: "Update Available", color: "text-blue-500" }
      case "installed":
        return { label: "Installed - Restart Required", color: "text-amber-500" }
      case "error":
        return { label: "Check Failed", color: "text-red-500" }
      default:
        return { label: status.status, color: "text-muted-foreground" }
    }
  }

  const badge = getStatusBadge()

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Updates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage application updates and releases
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkForUpdates}
          disabled={checking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check for Updates"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-blue-500" /> Update Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Version</span>
              <span className="text-sm font-mono font-medium">
                {status?.current_version ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Latest Version</span>
              <span className="text-sm font-mono">
                {status?.latest_version ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-medium ${badge.color}`}>
                {checking ? "Checking..." : badge.label}
              </span>
            </div>
            {status?.update_available && (
              <Button
                className="w-full mt-2"
                onClick={performUpdate}
                disabled={updating}
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {updating ? "Downloading..." : "Download & Install Update"}
              </Button>
            )}
            {status?.status === "installed" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-500">
                  Restart the application to apply the update
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" /> Auto-Update
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Automatic Updates</p>
                <p className="text-xs text-muted-foreground">
                  Download and install updates automatically in the background
                </p>
              </div>
              <button
                onClick={() => setAutoUpdate(!autoUpdate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoUpdate ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoUpdate ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                When enabled, updates will be downloaded in the background and
                installed on application restart. You'll be notified before the
                update is applied.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {status?.release_notes && status.release_notes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Release Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.release_notes.map((note, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-500">Update Error</p>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
