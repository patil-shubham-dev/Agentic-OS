"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  Cpu,
  Key,
  Save,
  Shield,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Play,
  RotateCw,
  Loader2,
  Sliders,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, sendJson } from "@/lib/client-api";
import { toast } from "sonner";

interface ProviderConfig {
  id: string;
  provider: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  apiKeyLast4: string | null;
  validationStatus: string | null;
  lastValidatedAt: string | null;
  metadata: Record<string, any>;
}

interface ProviderModel {
  id: string;
  provider: string;
  model: string;
}

const PRESET_PROVIDERS = [
  { id: "openai", name: "OpenAI", defaultUrl: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", defaultUrl: "https://api.anthropic.com/v1" },
  { id: "google", name: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "ollama", name: "Ollama (Local)", defaultUrl: "http://localhost:11434" },
  { id: "lm-studio", name: "LM Studio (Local)", defaultUrl: "http://localhost:1234/v1" },
];

const DEFAULT_ROLES = ["Manager", "Coding", "Design", "Research", "Fast Inference", "Vision"];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [allModels, setAllModels] = useState<ProviderModel[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [security, setSecurity] = useState<Record<string, boolean>>({
    terminal: true,
    filesystem: true,
    approval: true,
    browser: false,
  });

  // Dialog configurations
  const [activeProvider, setActiveProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editApiKey, setEditApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  // Load Settings on Mount
  const loadData = async () => {
    try {
      // 1. Fetch Providers
      const providersData = await getJson<{ providers: Array<Record<string, any>> }>("/api/settings/providers");
      const mappedProviders = providersData.providers.map((p) => ({
        id: p.provider,
        provider: p.provider,
        label: p.label,
        baseUrl: p.base_url || "",
        defaultModel: p.default_model || "",
        enabled: Boolean(p.enabled),
        apiKeyLast4: p.api_key_last4 || null,
        validationStatus: p.validation_status || null,
        lastValidatedAt: p.last_validated_at || null,
        metadata: p.metadata || {},
      }));
      setProviders(mappedProviders);

      // 2. Fetch Models from database cache (aggregated across all enabled providers)
      const modelsList: ProviderModel[] = [];
      for (const p of mappedProviders) {
        if (p.enabled) {
          try {
            const res = await getJson<{ models: string[] }>(`/api/settings/providers/${p.id}/discover-models`);
            res.models.forEach((m) => {
              modelsList.push({ id: m, provider: p.id, model: m });
            });
          } catch {
            // fallback if discovery route fails
          }
        }
      }
      setAllModels(modelsList);

      // 3. Fetch Roles Mapping
      const rolesData = await getJson<{ roles: Record<string, string> }>("/api/settings/roles");
      setRoles(rolesData.roles);

      // 4. Fetch Security Toggles
      const secData = await getJson<{ security: Record<string, boolean> }>("/api/settings/security");
      setSecurity(secData.security);
    } catch (err) {
      toast.error("Failed to load settings data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleProvider = async (provider: ProviderConfig, enabled: boolean) => {
    try {
      await sendJson(`/api/settings/providers/${provider.id}`, "PATCH", {
        enabled,
      });
      toast.success(`${provider.label} ${enabled ? "enabled" : "disabled"}.`);
      loadData();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const handleDeleteProvider = async (provider: ProviderConfig) => {
    if (!confirm(`Are you sure you want to delete ${provider.label}?`)) return;
    try {
      await sendJson(`/api/settings/providers/${provider.id}`, "DELETE");
      toast.success(`${provider.label} provider deleted.`);
      loadData();
    } catch {
      toast.error("Failed to delete provider.");
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await sendJson<{ success: boolean; message: string }>(`/api/settings/providers/${providerId}/test`, "POST");
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
      loadData();
    } catch {
      toast.error("Connection test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const handleDiscoverModels = async (providerId: string) => {
    setDiscoveringId(providerId);
    try {
      const res = await sendJson<{ success: boolean; models: string[] }>(`/api/settings/providers/${providerId}/discover-models`, "POST");
      if (res.success) {
        toast.success(`Discovered ${res.models.length} models for this provider.`);
      }
      loadData();
    } catch {
      toast.error("Failed to discover models.");
    } finally {
      setDiscoveringId(null);
    }
  };

  // Add / Edit Dialog Launchers
  const handleAddClick = () => {
    setIsNew(true);
    setActiveProvider({
      id: "openai",
      provider: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o",
      enabled: true,
      metadata: {
        compatibilityMode: "openai-compatible",
        customModels: "",
        headers: "{}",
      },
    });
    setEditApiKey("");
  };

  const handleEditClick = (p: ProviderConfig) => {
    setIsNew(false);
    setActiveProvider({
      ...p,
      metadata: {
        compatibilityMode: p.metadata?.compatibilityMode || "openai-compatible",
        customModels: p.metadata?.customModels || "",
        headers: p.metadata?.headers || "{}",
      },
    });
    setEditApiKey("");
  };

  const handleSaveProvider = async () => {
    if (!activeProvider || !activeProvider.label) return;
    setSaving(true);
    try {
      // Validate Custom Headers JSON
      let headersObj = {};
      if (activeProvider.metadata?.headers) {
        try {
          headersObj = JSON.parse(activeProvider.metadata.headers);
        } catch {
          toast.error("Invalid Headers JSON structure.");
          setSaving(false);
          return;
        }
      }

      const payload = {
        provider: activeProvider.provider,
        label: activeProvider.label,
        baseUrl: activeProvider.baseUrl,
        defaultModel: activeProvider.defaultModel,
        enabled: activeProvider.enabled ?? true,
        apiKey: editApiKey || undefined,
        metadata: {
          compatibilityMode: activeProvider.metadata?.compatibilityMode || "openai-compatible",
          customModels: activeProvider.metadata?.customModels || "",
          headers: activeProvider.metadata?.headers || "{}",
        },
      };

      if (isNew) {
        await sendJson("/api/settings/providers", "POST", payload);
        toast.success(`New provider ${activeProvider.label} created.`);
      } else {
        await sendJson(`/api/settings/providers/${activeProvider.id}`, "PATCH", payload);
        toast.success(`${activeProvider.label} config updated successfully.`);
      }

      setActiveProvider(null);
      loadData();
    } catch {
      toast.error("Failed to save provider configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    try {
      await sendJson("/api/settings/roles", "POST", { roles });
      toast.success("Role model assignments saved.");
    } catch {
      toast.error("Failed to save role mappings.");
    }
  };

  const handleSaveSecurity = async () => {
    try {
      await sendJson("/api/settings/security", "POST", { security });
      toast.success("Security toggles saved successfully.");
    } catch {
      toast.error("Failed to save security settings.");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-amber-950 flex items-center gap-2">
            <Settings className="w-8 h-8 text-amber-600 animate-spin-slow" /> Settings
          </h1>
          <p className="text-sm text-amber-700/80 mt-1">Configure models, map execution roles, and define security rules.</p>
        </div>
        <Button onClick={handleAddClick} className="bg-amber-600 hover:bg-amber-700 text-white shadow-md rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Add Provider
        </Button>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md p-1 bg-amber-100/50 rounded-2xl border border-amber-200/50">
          <TabsTrigger value="providers" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-xl text-amber-700/80">
            <Key className="w-4 h-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-xl text-amber-700/80">
            <Cpu className="w-4 h-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-xl text-amber-700/80">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* 1. Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          {providers.length === 0 ? (
            <Card className="border-none shadow-sm bg-amber-50/20 py-12 text-center rounded-2xl">
              <CardContent className="space-y-3">
                <AlertCircle className="w-12 h-12 text-amber-600/60 mx-auto" />
                <h3 className="text-lg font-bold text-amber-950">No Providers Connected</h3>
                <p className="text-xs text-amber-700/70 max-w-sm mx-auto">Configure cloud model providers or offline local environments to power your agents.</p>
                <Button onClick={handleAddClick} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                  Connect Your First Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((p) => (
                <Card key={p.id} className="border border-amber-200/60 shadow-sm bg-white hover:shadow-md transition-shadow duration-200 rounded-2xl overflow-hidden flex flex-col justify-between">
                  <CardHeader className="pb-3 border-b border-amber-100/55 bg-amber-50/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-amber-950">{p.label}</CardTitle>
                        <CardDescription className="text-[11px] font-mono mt-0.5 text-amber-600/70">{p.baseUrl}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={p.enabled} onCheckedChange={(val) => handleToggleProvider(p, val)} />
                        <Badge className={cn("border-none px-2 py-0.5 text-[10px] font-semibold uppercase shadow-none", p.enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700/70")}>
                          {p.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-amber-800/80 font-medium">Default Model:</span>
                          <p className="font-semibold text-amber-950 mt-0.5 truncate">{p.defaultModel || "None set"}</p>
                        </div>
                        <div>
                          <span className="text-amber-800/80 font-medium">API Key Status:</span>
                          <p className="font-semibold text-amber-950 mt-0.5 font-mono">
                            {p.apiKeyLast4 ? `•••• ${p.apiKeyLast4}` : "None configured"}
                          </p>
                        </div>
                      </div>

                      {p.validationStatus && (
                        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/50 border border-amber-200/40 text-[11px]">
                          {p.validationStatus === "valid" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className="font-medium text-amber-900">
                            Status: {p.validationStatus === "valid" ? "Verified Connection" : "Connection Failure"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-amber-100">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(p.id)}
                          disabled={testingId === p.id}
                          className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl"
                        >
                          {testingId === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDiscoverModels(p.id)}
                          disabled={discoveringId === p.id}
                          className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl"
                        >
                          {discoveringId === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RotateCw className="w-3 h-3 mr-1.5" />}
                          Models
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(p)} className="h-8 text-xs border-amber-200 text-amber-900 hover:bg-amber-50 rounded-xl">
                          Configure
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProvider(p)} className="h-8 text-xs text-red-600 hover:bg-red-50 rounded-xl">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border border-amber-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-amber-50/20 border-b border-amber-100">
              <CardTitle className="text-lg font-bold text-amber-950">System Role Allocation</CardTitle>
              <CardDescription className="text-xs text-amber-700/80">Select which active LLM model routes to each key agent task role.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {DEFAULT_ROLES.map((role) => (
                <div key={role} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/30 border border-amber-100/50">
                  <div>
                    <h4 className="font-bold text-amber-950 text-sm">{role}</h4>
                    <p className="text-xs text-amber-600/70 mt-0.5">
                      {role === "Manager" && "Orchestration & Planning"}
                      {role === "Coding" && "Code generation & filesystem writes"}
                      {role === "Design" && "Aesthetic canvas and interface building"}
                      {role === "Research" && "Web searches, analysis, and data aggregation"}
                      {role === "Fast Inference" && "Quick classification and immediate feedback"}
                      {role === "Vision" && "Image understanding, screenshot analysis, OCR, and multimodal reasoning"}
                    </p>
                  </div>
                  <div className="w-full md:w-[320px]">
                    <Select
                      value={roles[role] || ""}
                      onValueChange={(val) => setRoles((prev) => ({ ...prev, [role]: val }))}
                    >
                      <SelectTrigger className="w-full bg-white border-amber-200 text-amber-950 rounded-xl">
                        <SelectValue placeholder="Select assigned model..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-amber-200">
                        {allModels.length === 0 ? (
                          <SelectItem value="none" disabled className="text-xs text-amber-600">
                            No active models (enable providers)
                          </SelectItem>
                        ) : (
                          allModels.map((m) => (
                            <SelectItem key={m.id} value={m.model} className="text-amber-950 focus:bg-amber-50 text-xs">
                              {m.model} ({m.provider})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveRoles} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm">
                  <Save className="w-4 h-4 mr-2" /> Save Role Assignments
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card className="border border-amber-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-amber-50/20 border-b border-amber-100">
              <CardTitle className="text-lg font-bold text-amber-950">Runtime Sandbox Safety</CardTitle>
              <CardDescription className="text-xs text-amber-700/80">Configure authorization boundaries and shell permissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/20 border border-amber-100/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-amber-950">Allow Terminal Execution</Label>
                    <p className="text-xs text-amber-600/70">Permits agents to run local machine shell processes.</p>
                  </div>
                  <Switch
                    checked={security.terminal ?? true}
                    onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, terminal: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/20 border border-amber-100/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-amber-950">Allow Filesystem Writes</Label>
                    <p className="text-xs text-amber-600/70">Enables file creation, editing, and deleting inside directories.</p>
                  </div>
                  <Switch
                    checked={security.filesystem ?? true}
                    onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, filesystem: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/20 border border-amber-100/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-amber-950">Require Approval for Destructive Actions</Label>
                    <p className="text-xs text-amber-600/70">Asks for user confirmation before deleting files or editing system files.</p>
                  </div>
                  <Switch
                    checked={security.approval ?? true}
                    onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, approval: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/20 border border-amber-100/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-amber-950">Enable Browser Automation</Label>
                    <p className="text-xs text-amber-600/70">Allows Playwright web crawling or browser navigation.</p>
                  </div>
                  <Switch
                    checked={security.browser ?? false}
                    onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, browser: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveSecurity} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm">
                  <Save className="w-4 h-4 mr-2" /> Save Safety Options
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 4. Configure Provider Dialog */}
      <Dialog open={!!activeProvider} onOpenChange={() => setActiveProvider(null)}>
        <DialogContent className="max-w-xl bg-white border border-amber-200 rounded-3xl shadow-xl p-6 overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-amber-950">
              {isNew ? "Add Gateway Provider" : `Configure ${activeProvider?.label}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-600/70">
              Configure endpoints, encrypted access keys, and custom headers.
            </DialogDescription>
          </DialogHeader>

          {activeProvider && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-amber-950 text-xs font-bold">Preset Gateway Type</Label>
                  {isNew ? (
                    <Select
                      value={activeProvider.provider}
                      onValueChange={(val) => {
                        const preset = PRESET_PROVIDERS.find((pr) => pr.id === val);
                        setActiveProvider((prev) => prev ? {
                          ...prev,
                          provider: val,
                          label: preset ? preset.name : "Custom",
                          baseUrl: preset ? preset.defaultUrl : "",
                          metadata: {
                            ...(prev.metadata || {}),
                            compatibilityMode: val === "anthropic" ? "anthropic-compatible" : "openai-compatible",
                          },
                        } : null);
                      }}
                    >
                      <SelectTrigger className="border-amber-200 text-amber-950 bg-white rounded-xl">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-amber-200">
                        {PRESET_PROVIDERS.map((pr) => (
                          <SelectItem key={pr.id} value={pr.id} className="text-xs text-amber-950 focus:bg-amber-50">
                            {pr.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-xs text-amber-950 focus:bg-amber-50">
                          Custom API Provider
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="bg-amber-50/50 border-amber-200 text-amber-950 font-bold rounded-xl" value={activeProvider.provider} disabled />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-amber-950 text-xs font-bold">Provider Display Name</Label>
                  <Input
                    className="border-amber-200 text-amber-950 rounded-xl"
                    value={activeProvider.label || ""}
                    onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, label: e.target.value } : null)}
                    placeholder="e.g. Together AI"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-amber-950 text-xs font-bold">Endpoint Base URL</Label>
                <Input
                  className="border-amber-200 text-amber-950 rounded-xl"
                  value={activeProvider.baseUrl || ""}
                  onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, baseUrl: e.target.value } : null)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-amber-950 text-xs font-bold">API Key / Access Token</Label>
                <Input
                  className="border-amber-200 text-amber-950 rounded-xl"
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder={activeProvider.apiKeyLast4 ? `••••••••••••${activeProvider.apiKeyLast4} (Unchanged)` : "sk-••••••••••••"}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-amber-950 text-xs font-bold">Default Model</Label>
                <Input
                  className="border-amber-200 text-amber-950 rounded-xl"
                  value={activeProvider.defaultModel || ""}
                  onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, defaultModel: e.target.value } : null)}
                  placeholder="e.g. gpt-4o or claude-3-5-sonnet-20241022"
                />
              </div>

              {/* Custom API Provider Options */}
              {activeProvider.provider === "custom" && (
                <Card className="border border-dashed border-amber-200 p-4 space-y-4 rounded-2xl bg-amber-50/10">
                  <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" /> Universal Custom Endpoint Mappings
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <Label className="text-amber-950 font-bold">Compatibility Mode</Label>
                      <Select
                        value={activeProvider.metadata?.compatibilityMode || "openai-compatible"}
                        onValueChange={(val) =>
                          setActiveProvider((prev) => prev ? {
                            ...prev,
                            metadata: { ...(prev.metadata || {}), compatibilityMode: val },
                          } : null)
                        }
                      >
                        <SelectTrigger className="bg-white border-amber-200 rounded-xl">
                          <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-amber-200">
                          <SelectItem value="openai-compatible" className="text-xs focus:bg-amber-50">OpenAI-compatible</SelectItem>
                          <SelectItem value="anthropic-compatible" className="text-xs focus:bg-amber-50">Anthropic-compatible</SelectItem>
                          <SelectItem value="custom-adapter" className="text-xs focus:bg-amber-50">Custom adapter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-amber-950 font-bold">Discovered Model Name(s) list</Label>
                      <Input
                        className="border-amber-200 rounded-xl"
                        value={activeProvider.metadata?.customModels || ""}
                        onChange={(e) =>
                          setActiveProvider((prev) => prev ? {
                            ...prev,
                            metadata: { ...(prev.metadata || {}), customModels: e.target.value },
                          } : null)
                        }
                        placeholder="gpt-4o, mixtral-8x7b, llama-3"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Custom Headers (JSON)</Label>
                    <Textarea
                      className="border-amber-200 font-mono text-xs rounded-xl bg-white min-h-[60px]"
                      value={activeProvider.metadata?.headers || "{}"}
                      onChange={(e) =>
                        setActiveProvider((prev) => prev ? {
                          ...prev,
                          metadata: { ...(prev.metadata || {}), headers: e.target.value },
                        } : null)
                      }
                      placeholder='{ "X-Custom-Header": "custom-value" }'
                    />
                  </div>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl" onClick={() => setActiveProvider(null)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700 rounded-xl shadow-sm" onClick={handleSaveProvider} disabled={saving}>
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
