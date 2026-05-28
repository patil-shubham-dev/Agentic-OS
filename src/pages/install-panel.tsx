import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@agentic-os/ui"
import {
  Package, FolderOpen, HardDrive, Activity, CheckCircle2,
  Loader2, ExternalLink, Server, MousePointerClick,
  Plus, Trash2,
} from "lucide-react"

interface InstallInfo {
  version: string
  install_path: string
  data_path: string
  storage_bytes: number
  runtime_status: string
  first_launch: boolean
  build_date: string
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function InstallPanel() {
  const [info, setInfo] = useState<InstallInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [contextMenuRegistered, setContextMenuRegistered] = useState<boolean | null>(null)
  const [contextMenuLoading, setContextMenuLoading] = useState(false)
  const [contextMenuAction, setContextMenuAction] = useState<"register" | "unregister" | null>(null)

  useEffect(() => {
    loadInfo()
    checkContextMenu()
  }, [])

  const checkContextMenu = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const result = await invoke<boolean>("is_context_menu_registered")
      setContextMenuRegistered(result)
    } catch {
      setContextMenuRegistered(null)
    }
  }

  const handleRegisterContextMenu = async () => {
    setContextMenuAction("register")
    setContextMenuLoading(true)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("register_context_menu")
      setContextMenuRegistered(true)
    } catch (err) {
      console.error("Failed to register context menu:", err)
    }
    setContextMenuLoading(false)
    setContextMenuAction(null)
  }

  const handleUnregisterContextMenu = async () => {
    setContextMenuAction("unregister")
    setContextMenuLoading(true)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("unregister_context_menu")
      setContextMenuRegistered(false)
    } catch (err) {
      console.error("Failed to unregister context menu:", err)
    }
    setContextMenuLoading(false)
    setContextMenuAction(null)
  }

  const loadInfo = async () => {
    setLoading(true)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const result = await invoke<InstallInfo>("get_install_info")
      setInfo(result)
    } catch {
      setInfo({
        version: "1.0.0 (web)",
        install_path: "N/A (browser)",
        data_path: "localStorage",
        storage_bytes: 0,
        runtime_status: "web",
        first_launch: false,
        build_date: new Date().toISOString().split("T")[0],
      })
    }
    setLoading(false)
  }

  const openLocation = async (path: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("open_install_location")
    } catch {
      try {
        const { open } = await import("@tauri-apps/plugin-shell")
        await open(path)
      } catch { /* open may not be available in web mode */ }
    }
  }

  if (loading || !info) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Installation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Application installation information and management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" /> Application Version
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-mono font-medium">{info.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Build Date</span>
              <span className="text-sm text-muted-foreground">{info.build_date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">First Launch</span>
              <span className="text-sm">{info.first_launch ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-500 font-medium">Installed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-500" /> Runtime Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-500 capitalize">{info.runtime_status}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Storage</span>
              <span className="text-sm font-medium">{formatBytes(info.storage_bytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data Directory</span>
              <button
                onClick={() => openLocation(info.data_path)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Open <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Install Location</span>
              <button
                onClick={() => openLocation(info.install_path)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Open <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-amber-500" /> Storage Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium">App Data</p>
                  <p className="text-xs text-muted-foreground">Settings, ledger, workspace memory</p>
                </div>
              </div>
              <span className="text-sm font-mono">{formatBytes(info.storage_bytes)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium">Install Directory</p>
                  <p className="text-xs text-muted-foreground">Application binaries and resources</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">—</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-green-500" /> Shell Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Add or remove the "Open with AgenticOS" shortcut from the right-click context menu
            in File Explorer. This makes it easy to open any folder directly in AgenticOS.
          </p>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <MousePointerClick className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm font-medium">Context Menu Entry</p>
                <p className="text-xs text-muted-foreground">
                  {contextMenuRegistered === null
                    ? "Status unknown (browser mode?)"
                    : contextMenuRegistered
                      ? "Currently registered — right-click any folder to open with AgenticOS"
                      : "Not registered"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!contextMenuRegistered ? (
                <button
                  onClick={handleRegisterContextMenu}
                  disabled={contextMenuLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
                >
                  {contextMenuLoading && contextMenuAction === "register" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </button>
              ) : (
                <button
                  onClick={handleUnregisterContextMenu}
                  disabled={contextMenuLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                >
                  {contextMenuLoading && contextMenuAction === "unregister" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Remove
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-white/5 bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">
          Application ID: <code className="text-primary font-mono">com.agenticos.studio</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data stored at: <code className="text-primary font-mono text-[10px]">{info.data_path}</code>
        </p>
      </div>
    </div>
  )
}
