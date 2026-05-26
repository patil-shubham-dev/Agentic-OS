import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ToolConfig, MCPConfig } from "@/types"
import {
  Wrench, Plus, Search, Plug, Server, RefreshCw,
  ChevronDown, ChevronRight,
  Link, Trash2, Key, XCircle,
} from "lucide-react"

const DEFAULT_TOOLS: ToolConfig[] = [
  { id: "t1", name: "Web Search", description: "Search the web via DuckDuckGo", type: "builtin", enabled: true, permissions: ["network"] },
  { id: "t2", name: "Web Fetch", description: "Fetch and parse web pages", type: "builtin", enabled: true, permissions: ["network"] },
  { id: "t3", name: "File System", description: "Read and write files", type: "builtin", enabled: true, permissions: ["filesystem"] },
  { id: "t4", name: "Terminal", description: "Execute shell commands", type: "builtin", enabled: false, permissions: ["system"] },
  { id: "t5", name: "Git Operations", description: "Git commit, push, pull", type: "builtin", enabled: true, permissions: ["filesystem", "network"] },
  { id: "t6", name: "Browser Automation", description: "Automated browser control via Playwright", type: "builtin", enabled: false, permissions: ["system", "network"] },
  { id: "t7", name: "Image Generation", description: "AI image generation via providers", type: "builtin", enabled: false, permissions: ["network"] },
  { id: "t8", name: "PDF Parser", description: "Extract text from PDF files", type: "builtin", enabled: true, permissions: ["filesystem"] },
]

const DEFAULT_MCP: MCPConfig[] = [
  { id: "mcp-1", name: "Filesystem MCP", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "./"], env: {}, enabled: true, status: "disconnected" },
  { id: "mcp-2", name: "GitHub MCP", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: { GITHUB_TOKEN: "" }, enabled: false, status: "disconnected" },
  { id: "mcp-3", name: "PostgreSQL MCP", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/mydb"], env: {}, enabled: false, status: "error" },
]

export function ToolsTab() {
  const [tools, setTools] = useState<ToolConfig[]>(DEFAULT_TOOLS)
  const [mcps, setMcps] = useState<MCPConfig[]>(DEFAULT_MCP)
  const [search, setSearch] = useState("")
  const [expandedMcp, setExpandedMcp] = useState<string | null>(null)
  const [view, setView] = useState<"tools" | "mcp">("tools")

  const filtered = tools.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  })

  const filteredMcp = mcps.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q)
  })

  function toggleTool(id: string) {
    setTools(tools.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  function toggleMcp(id: string) {
    setMcps(mcps.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Tools & MCP</h2>
        <p className="text-sm text-white/40">Manage tool integrations, MCP server connections, and execution permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[
          { label: "Active Tools", value: tools.filter((t) => t.enabled).length.toString(), icon: Wrench, color: "text-blue-400" },
          { label: "MCP Servers", value: mcps.length.toString(), icon: Server, color: "text-green-400" },
          { label: "Connected", value: mcps.filter((m) => m.status === "connected").length.toString(), icon: Link, color: "text-purple-400" },
          { label: "Errors", value: mcps.filter((m) => m.status === "error").length.toString(), icon: XCircle, color: "text-red-400" },
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

      {/* View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools & MCP..." className="w-full h-10 rounded-xl border border-white/5 bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/10" />
        </div>
          {/* View Toggle - Segmented Control */}
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            <button onClick={() => setView("tools")} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150", view === "tools" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>
              <Wrench className="h-3.5 w-3.5" />Tools
            </button>
            <button onClick={() => setView("mcp")} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150", view === "mcp" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>
              <Server className="h-3.5 w-3.5" />MCP Servers
            </button>
          </div>
        <div className="flex-1" />
        <Button size="sm" className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-blue-600/20">
          <Plus className="h-4 w-4 mr-1.5" /> Add {view === "tools" ? "Tool" : "MCP Server"}
        </Button>
      </div>

      {view === "tools" ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((tool) => (
              <motion.div
                key={tool.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all",
                  tool.enabled ? "border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" : "border-white/5 bg-white/[0.01] opacity-70"
                )}
              >
                <div className={cn("flex items-center justify-center h-9 w-9 rounded-xl border", tool.enabled ? "bg-blue-500/10 border-blue-500/20" : "bg-white/[0.02] border-white/5")}>
                  <Plug className={cn("h-4 w-4", tool.enabled ? "text-blue-400" : "text-white/20")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{tool.name}</span>
                    <Badge variant={tool.type === "builtin" ? "info" : tool.type === "mcp" ? "purple" : "default"} size="sm">{tool.type}</Badge>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{tool.description}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {tool.permissions.map((perm) => (
                      <Badge key={perm} variant="default" size="sm">{perm}</Badge>
                    ))}
                  </div>
                </div>
                <Switch checked={tool.enabled} onCheckedChange={() => toggleTool(tool.id)} size="md" />
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12"><Wrench className="h-8 w-8 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/30">No tools match your search</p></div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredMcp.map((mcp) => (
              <motion.div
                key={mcp.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] overflow-hidden"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => setExpandedMcp(expandedMcp === mcp.id ? null : mcp.id)} className="text-white/20 hover:text-white/40 transition-colors">
                    {expandedMcp === mcp.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className={cn("flex items-center justify-center h-9 w-9 rounded-xl border", mcp.status === "connected" ? "bg-green-500/10 border-green-500/20" : mcp.status === "error" ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.02] border-white/5")}>
                    <Server className={cn("h-4 w-4", mcp.status === "connected" ? "text-green-400" : mcp.status === "error" ? "text-red-400" : "text-white/30")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{mcp.name}</span>
                      <Badge variant={mcp.status === "connected" ? "success" : mcp.status === "error" ? "error" : "default"} size="sm">{mcp.status}</Badge>
                    </div>
                    <p className="text-xs text-white/30 font-mono mt-0.5">{mcp.command} {mcp.args.join(" ")}</p>
                  </div>
                  <Switch checked={mcp.enabled} onCheckedChange={() => toggleMcp(mcp.id)} size="md" />
                </div>

                <AnimatePresence>
                  {expandedMcp === mcp.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <Separator />
                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/60">Command</Label>
                            <Input value={mcp.command} className="h-9 border-white/10 bg-white/[0.03] text-xs text-white font-mono" readOnly />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/60">Args</Label>
                            <Input value={mcp.args.join(" ")} className="h-9 border-white/10 bg-white/[0.03] text-xs text-white font-mono" readOnly />
                          </div>
                        </div>
                        {Object.keys(mcp.env).length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-white/60">Environment Variables</Label>
                            {Object.entries(mcp.env).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                                <Key className="h-3 w-3 text-white/20" />
                                <span className="text-xs font-mono text-white/50">{key}</span>
                                <span className="text-xs font-mono text-white/20">=</span>
                                <span className="text-xs font-mono text-white/30">{val || "(not set)"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-white/50 hover:text-white"><RefreshCw className="h-3 w-3 mr-1" /> Restart</Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3 mr-1" /> Remove</Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredMcp.length === 0 && (
            <div className="text-center py-12"><Server className="h-8 w-8 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/30">No MCP servers match your search</p></div>
          )}
        </div>
      )}
    </div>
  )
}

