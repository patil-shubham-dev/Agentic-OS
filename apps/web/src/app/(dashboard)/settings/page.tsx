"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Cpu,
  Save,
  Shield,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Settings,
  Zap,
  Globe,
  WifiOff,
  Server,
  Eye,
  EyeOff,
  Terminal,
  BrainCircuit,
  FileCode,
  Layers,
  BookOpen,
  Zap as ZapIcon,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, sendJson } from "@/lib/client-api";
import { toast } from "sonner";
import { useProviderStore } from "@/stores/provider-store";
import { useModelRegistry } from "@/stores/model-registry";
import { useRoleStore } from "@/stores/role-store";
import { detectLocalProviders } from "@/lib/runtime/provider-detection";
import type { NormalizedModel, UniversalProviderConfig, RoleCapability } from "@/lib/runtime/types";
import { DEFAULT_ROLES } from "@/lib/runtime/types";

const GATEWAY_TYPES = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com" },
  { id: "google", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434/v1" },
  { id: "lmstudio", name: "LM Studio (Local)", baseUrl: "http://localhost:1234/v1" },
];

const ROLE_ICONS: Record<string, React.ReactNode> = {
  Manager: <BrainCircuit className="w-4 h-4" />,
  Coding: <FileCode className="w-4 h-4" />,
  Design: <Layers className="w-4 h-4" />,
  Research: <BookOpen className="w-4 h-4" />,
  "Fast Inference": <ZapIcon className="w-4 h-4" />,
  Vision: <Eye className="w-4 h-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  Manager: "bg-purple-100 text-purple-700 border-purple-200",
  Coding: "bg-blue-100 text-blue-700 border-blue-200",
  Design: "bg-pink-100 text-pink-700 border-pink-200",
  Research: "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Fast Inference": "bg-amber-100 text-amber-700 border-amber-200",
  Vision: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function RoleCapabilityBadges({ role }: { role: RoleCapability }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {role.requires.map((cap) => (
        <Badge key={cap} variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200 px-1.5 py-0">
          {cap}
        </Badge>
      ))}
      {role.preferred.map((cap) => (
        <Badge key={cap} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0">
          {cap}*
        </Badge>
      ))}
    </div>
  );
}

function ModelCapabilityTags({ model }: { model: NormalizedModel }) {
  const tags: string[] = [];
  if (model.capabilities.has("vision")) tags.push("Vision");
  if (model.capabilities.has("tools")) tags.push("Tools");
  if (model.capabilities.has("reasoning")) tags.push("Reasoning");
  if (model.capabilities.has("code")) tags.push("Code");
  if (model.capabilities.has("fast-inference")) tags.push("Fast");
  if (model.contextWindow >= 128000) tags.push("128K");
  else if (model.contextWindow >= 64000) tags.push("64K");
  else if (model.contextWindow >= 32000) tags.push("32K");

  return (
    <div className="flex gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-[8px] bg-zinc-100 text-zinc-600 border-zinc-200 px-1 py-0">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const providerStore = useProviderStore();
  const modelRegistry = useModelRegistry();
  const roleStore = useRoleStore();

  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [activeProvider, setActiveProvider] = useState<Partial<UniversalProviderConfig> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editApiKey, setEditApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localDetecting, setLocalDetecting] = useState(false);

  useEffect(() => {
    const init = async () => {
      await providerStore.hydrate();
      await roleStore.hydrate();
      await modelRegistry.refresh();
      try {
        const res = await fetch("/api/settings/security");
        if (res.ok) setDbConnected(true);
        else setDbConnected(false);
      } catch {
        setDbConnected(false);
      }
    };
    init();
  }, []);

  const handleAddClick = () => {
    setIsNew(true);
    setActiveProvider({
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o",
      enabled: true,
      type: "cloud",
      health: "unknown",
      latency: 0,
    });
    setEditApiKey("");
  };

  const handleEditClick = (p: UniversalProviderConfig) => {
    setIsNew(false);
    setActiveProvider({ ...p });
    setEditApiKey("");
  };

  const handleSaveProvider = async () => {
    if (!activeProvider || !activeProvider.name) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        provider: activeProvider.id,
        label: activeProvider.name,
        baseUrl: activeProvider.baseUrl,
        defaultModel: activeProvider.defaultModel,
        enabled: activeProvider.enabled ?? true,
        apiKey: editApiKey || undefined,
      };

      if (isNew) {
        await sendJson("/api/settings/providers", "POST", payload);
        toast.success(`Provider ${activeProvider.name} created.`);
      } else {
        await sendJson(`/api/settings/providers/${activeProvider.id}`, "PATCH", payload);
        toast.success(`${activeProvider.name} updated.`);
      }
      setActiveProvider(null);
      await providerStore.hydrate();
      await modelRegistry.refresh();
    } catch {
      toast.error("Failed to save provider.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (p: UniversalProviderConfig) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await sendJson(`/api/settings/providers/${p.id}`, "DELETE");
      toast.success(`${p.name} deleted.`);
      providerStore.removeProvider(p.id);
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleToggleProvider = async (p: UniversalProviderConfig, enabled: boolean) => {
    try {
      await sendJson(`/api/settings/providers/${p.id}`, "PATCH", { enabled });
      providerStore.updateProvider(p.id, { enabled });
      toast.success(`${p.name} ${enabled ? "enabled" : "disabled"}.`);
      if (enabled) {
        await modelRegistry.refresh();
      }
    } catch {
      toast.error("Failed to update.");
    }
  };

  const handleTestConnection = async (providerId: string) => {
    try {
      const res = await sendJson<{ success: boolean; message: string }>(`/api/settings/providers/${providerId}/test`, "POST");
      if (res.success) toast.success(res.message);
      else toast.warning(res.message);
      await providerStore.hydrate();
    } catch {
      toast.error("Connection test failed.");
    }
  };

  const handleDiscoverModels = async () => {
    toast.success("Refreshing model registry...");
    await modelRegistry.refresh();
    toast.success(`Registry updated: ${modelRegistry.availableModels.length} models available`);
  };

  const handleDetectLocal = async () => {
    setLocalDetecting(true);
    try {
      const found = await detectLocalProviders();
      for (const local of found) {
        const exists = providerStore.providers.find((p) => p.id === local.id);
        if (!exists) {
          await sendJson("/api/settings/providers", "POST", {
            provider: local.id,
            label: local.name,
            baseUrl: local.baseUrl,
            enabled: true,
          });
          providerStore.addProvider({
            id: local.id,
            name: local.name,
            baseUrl: local.baseUrl,
            enabled: true,
            type: "local",
            health: "healthy",
            latency: 0,
          });
        }
      }
      if (found.length === 0) toast.info("No local providers detected.");
      else {
        toast.success(`Detected ${found.length} local provider(s)`);
        await modelRegistry.refresh();
      }
    } catch {
      toast.error("Detection failed.");
    } finally {
      setLocalDetecting(false);
    }
  };

  const handleSaveRole = async (role: string, modelId: string) => {
    if (!modelId) return;
    const model = modelRegistry.getModel(modelId);
    if (!model) return;
    roleStore.setAssignment(role, modelId, model.providerId);
    try {
      const assignments = roleStore.assignments;
      const rolesPayload: Record<string, string> = {};
      for (const a of assignments) {
        rolesPayload[a.role] = a.modelId;
      }
      rolesPayload[role] = modelId;
      await sendJson("/api/settings/roles", "POST", { roles: rolesPayload });
      toast.success(`Role ${role} mapped to ${model.label}`);
    } catch {
      toast.error("Failed to save role assignment.");
    }
  };

  const handleAutoRoute = async (role: string, autoRoute: boolean) => {
    const current = roleStore.getAssignment(role);
    if (current) {
      roleStore.setAssignment(role, current.modelId, current.providerId, autoRoute);
    }
  };

  const filteredModels = modelRegistry.availableModels.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.label.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {dbConnected === false && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/80">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-950">Database offline — settings won't persist between sessions.</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <Settings className="w-7 h-7 text-amber-500" />
            Control Plane
          </h1>
          <p className="text-sm text-zinc-400 mt-1 ml-10">Configure providers, map execution roles, and define security rules.</p>
        </div>
      </motion.div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-zinc-900 border border-zinc-800 rounded-xl">
          <TabsTrigger value="providers" className="gap-2 data-[state=active]:bg-zinc-800 rounded-lg text-xs">
            <Server className="w-4 h-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-zinc-800 rounded-lg text-xs">
            <Cpu className="w-4 h-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-zinc-800 rounded-lg text-xs">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {providerStore.providers.length} provider{providerStore.providers.length !== 1 ? "s" : ""} · {modelRegistry.availableModels.length} model{modelRegistry.availableModels.length !== 1 ? "s" : ""} available
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs border-zinc-700 rounded-lg h-8" onClick={handleDetectLocal} disabled={localDetecting}>
                {localDetecting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                Detect Local
              </Button>
              <Button variant="outline" size="sm" className="text-xs border-zinc-700 rounded-lg h-8" onClick={handleDiscoverModels}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh Models
              </Button>
              <Button size="sm" className="text-xs bg-amber-600 hover:bg-amber-500 rounded-lg h-8" onClick={handleAddClick}>
                <Plus className="w-3 h-3 mr-1" /> Add Provider
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {providerStore.providers.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <WifiOff className="w-7 h-7 text-zinc-500" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-300">No Providers Connected</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1 mb-6">
                  Connect cloud model providers or local endpoints to power your agents.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-lg mx-auto">
                  {GATEWAY_TYPES.map((gt) => {
                    const isLocal = gt.id === "ollama" || gt.id === "lmstudio";
                    return (
                      <button
                        key={gt.id}
                        onClick={() => {
                          setIsNew(true);
                          setActiveProvider({
                            id: gt.id,
                            name: gt.name,
                            baseUrl: gt.baseUrl,
                            defaultModel: "",
                            enabled: true,
                            type: isLocal ? "local" : "cloud",
                            health: "unknown",
                            latency: 0,
                          });
                          setEditApiKey("");
                        }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/60 hover:bg-zinc-800 hover:border-zinc-600 transition-all text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                          {isLocal ? <Server className="w-3.5 h-3.5 text-purple-400" /> : <Globe className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-zinc-200 truncate">{gt.name}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{isLocal ? "Local endpoint" : "Cloud API"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button onClick={handleAddClick} size="sm" className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg h-8">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Custom Provider
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs border-zinc-700 rounded-lg h-8" onClick={handleDetectLocal} disabled={localDetecting}>
                    {localDetecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                    Detect Local
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div className="grid gap-4 md:grid-cols-2">
                {providerStore.providers.map((p) => {
                  const isLocal = p.type === "local";
                  return (
                    <motion.div key={p.id} layout className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                              {isLocal ? <Server className="w-4 h-4 text-purple-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                                {p.name}
                                <Badge className={cn(
                                  "text-[9px] px-1.5 py-0 font-medium border-none",
                                  p.enabled ? "bg-emerald-900/50 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                                )}>
                                  {p.enabled ? "Active" : "Disabled"}
                                </Badge>
                              </h3>
                              <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">{p.baseUrl}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            p.health === "healthy" ? "bg-emerald-500" :
                            p.health === "slow" ? "bg-amber-500" :
                            p.health === "degraded" ? "bg-orange-500" :
                            p.health === "offline" ? "bg-red-500" : "bg-zinc-600"
                          )} />
                          <span className="text-[10px] text-zinc-500">{p.health === "healthy" ? "Healthy" : p.health === "offline" ? "Offline" : p.health || "Unknown"}</span>
                          {p.latency ? <span className="text-[10px] text-zinc-600">{p.latency}ms</span> : null}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300" onClick={() => handleTestConnection(p.id)}>
                                    <Zap className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-900 border-zinc-800 text-xs">Test Connection</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Switch checked={p.enabled} onCheckedChange={(v) => handleToggleProvider(p, v)} className="data-[state=checked]:bg-emerald-600 scale-75" />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-200" onClick={() => handleEditClick(p)}>Config</Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-950" onClick={() => handleDeleteProvider(p)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800 rounded-xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-500" /> Universal Role Allocation
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Each role defines required capabilities. The system selects the best compatible model from any connected provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  className="pl-9 h-9 text-xs bg-zinc-800 border-zinc-700 rounded-lg"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {DEFAULT_ROLES.map((role, idx) => {
                const assignment = roleStore.getAssignment(role.role);
                const assignedModel = assignment ? modelRegistry.getModel(assignment.modelId) : null;
                const autoRoute = assignment?.autoRoute ?? true;

                return (
                  <motion.div
                    key={role.role}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", ROLE_COLORS[role.role]?.split(" ")[0] || "bg-zinc-700")}>
                          {ROLE_ICONS[role.role] || <Cpu className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-zinc-200">{role.label}</h4>
                          <p className="text-[11px] text-zinc-500">{role.description}</p>
                          <div className="mt-1.5">
                            <RoleCapabilityBadges role={role} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-zinc-500">Auto</span>
                          <Switch
                            checked={autoRoute}
                            onCheckedChange={(v) => handleAutoRoute(role.role, v)}
                            className="data-[state=checked]:bg-emerald-600 scale-75"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={assignedModel ? assignedModel.id : "__auto__"}
                        onValueChange={(val) => {
                          if (val === "__auto__") {
                            handleAutoRoute(role.role, true);
                          } else {
                            handleSaveRole(role.role, val);
                          }
                        }}
                      >
                        <SelectTrigger className={cn(
                          "flex-1 h-9 text-xs border rounded-lg",
                          autoRoute ? "bg-zinc-800/60 border-zinc-700 text-zinc-400" : "bg-zinc-800 border-zinc-600 text-zinc-200"
                        )}>
                          <SelectValue placeholder={
                            autoRoute ? "Auto-route (best match)" :
                            assignedModel ? `${assignedModel.providerName}/${assignedModel.label}` : "Select model..."
                          } />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[300px]">
                          <SelectItem value="__auto__" className="text-xs text-zinc-400 focus:bg-zinc-800">
                            <span className="flex items-center gap-2">
                              <Zap className="w-3 h-3 text-emerald-500" /> Auto-route (best match)
                            </span>
                          </SelectItem>
                          {filteredModels.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs text-zinc-200 focus:bg-zinc-800">
                              <span className="flex items-center gap-2">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  m.speed === "fast" ? "bg-emerald-500" : m.speed === "balanced" ? "bg-amber-500" : "bg-zinc-500"
                                )} />
                                <span className="font-medium">{m.providerName}</span>
                                <span className="text-zinc-400">/</span>
                                <span>{m.label}</span>
                                <ModelCapabilityTags model={m} />
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {assignedModel && !autoRoute && (
                        <Badge className={cn(
                          "text-[9px] px-1.5 py-0 font-mono border-none shrink-0",
                          assignedModel.speed === "fast" ? "bg-emerald-900/40 text-emerald-400" :
                          assignedModel.speed === "balanced" ? "bg-amber-900/40 text-amber-400" :
                          "bg-zinc-800 text-zinc-500"
                        )}>
                          {assignedModel.speed}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800 rounded-xl">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" /> Runtime Safety Controls
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Configure authorization boundaries and agent permissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <SecurityToggleRow icon={<Terminal className="w-4 h-4" />} label="Allow Terminal Execution" desc="Permits agents to run shell commands." defaultChecked={true} />
              <SecurityToggleRow icon={<Save className="w-4 h-4" />} label="Allow Filesystem Writes" desc="Enables file creation, editing, and deletion." defaultChecked={true} />
              <SecurityToggleRow icon={<Shield className="w-4 h-4" />} label="Require Approval for Destructive Actions" desc="Ask for confirmation before deleting files or running terminal commands." defaultChecked={true} caution />
              <SecurityToggleRow icon={<Globe className="w-4 h-4" />} label="Enable Browser Automation" desc="Allows Playwright web crawling and browser navigation." defaultChecked={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!activeProvider} onOpenChange={() => setActiveProvider(null)}>
        <DialogContent className="max-w-xl bg-zinc-900 border-zinc-700 rounded-2xl p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
                {isNew ? "Add Provider" : `Configure ${activeProvider?.name}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-1">
                Connect a model provider. API keys are encrypted at rest.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            {activeProvider && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-zinc-300">Gateway Type</Label>
                    {isNew ? (
                      <Select
                        value={activeProvider.id}
                        onValueChange={(val) => {
                          const gateway = GATEWAY_TYPES.find((g) => g.id === val);
                          const isLocal = val === "ollama" || val === "lmstudio";
                          setActiveProvider((prev) => prev ? {
                            ...prev,
                            id: val,
                            name: gateway?.name || "Custom API Provider",
                            baseUrl: gateway?.baseUrl || "",
                            type: isLocal ? "local" : val === "custom" ? "openai-compatible" : "cloud",
                          } : null);
                        }}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 rounded-lg h-10 text-xs">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          {GATEWAY_TYPES.map((g) => (
                            <SelectItem key={g.id} value={g.id} className="text-xs text-zinc-200 focus:bg-zinc-800">{g.name}</SelectItem>
                          ))}
                          <SelectItem value="custom" className="text-xs text-zinc-200 focus:bg-zinc-800">Custom API Provider</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center text-sm text-zinc-300">{activeProvider.id}</div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-zinc-300">Display Name</Label>
                    <Input
                      className="bg-zinc-800 border-zinc-700 text-zinc-200 rounded-lg h-10 text-xs"
                      value={activeProvider.name || ""}
                      onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </div>
                </div>

                {activeProvider.id === "custom" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-zinc-300">Base URL</Label>
                    <Input
                      className="bg-zinc-800 border-zinc-700 text-zinc-200 rounded-lg h-10 text-xs"
                      value={activeProvider.baseUrl || ""}
                      onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, baseUrl: e.target.value } : null)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-300">API Key</Label>
                  <div className="relative">
                    <Input
                      className="bg-zinc-800 border-zinc-700 text-zinc-200 rounded-lg h-10 text-xs pr-10"
                      type={showApiKey ? "text" : "password"}
                      value={editApiKey}
                      onChange={(e) => setEditApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-300">Default Model <span className="text-zinc-500 font-normal">(e.g. gpt-4o)</span></Label>
                  <Input
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 rounded-lg h-10 text-xs"
                    value={activeProvider.defaultModel || ""}
                    onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, defaultModel: e.target.value } : null)}
                    placeholder="gpt-4o"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-zinc-800 gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg h-10" onClick={() => setActiveProvider(null)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-500 rounded-lg h-10" onClick={handleSaveProvider} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecurityToggleRow({
  icon, label, desc, defaultChecked, caution,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  defaultChecked: boolean;
  caution?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const handleSave = async () => {
    const key = label.toLowerCase().includes("terminal") ? "terminal" :
                label.toLowerCase().includes("filesystem") ? "filesystem" :
                label.toLowerCase().includes("destructive") ? "approval" : "browser";
    try {
      await sendJson("/api/settings/security", "POST", { security: { [key]: checked } });
      toast.success(`${label} ${checked ? "enabled" : "disabled"}.`);
    } catch {
      toast.error("Failed to save.");
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/20 border border-zinc-800 hover:border-zinc-700 transition-all">
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", caution ? "bg-red-900/30 text-red-400" : "bg-zinc-800 text-zinc-400")}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-[11px] text-zinc-500">{desc}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(v) => { setChecked(v); setTimeout(handleSave, 100); }}
        className={cn("shrink-0", caution ? "data-[state=checked]:bg-amber-600" : "data-[state=checked]:bg-emerald-600")}
      />
    </div>
  );
}
