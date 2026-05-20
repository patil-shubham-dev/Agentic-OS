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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Zap,
  Globe,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Server,
  Radio,
  Link2,
  Database,
  Eye,
  EyeOff,
  Terminal,
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
  { id: "openai", name: "OpenAI", defaultUrl: "https://api.openai.com/v1", color: "emerald", icon: "⚡" },
  { id: "anthropic", name: "Anthropic", defaultUrl: "https://api.anthropic.com/v1", color: "amber", icon: "🧠" },
  { id: "google", name: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta", color: "blue", icon: "🌀" },
  { id: "ollama", name: "Ollama (Local)", defaultUrl: "http://localhost:11434", color: "purple", icon: "🦙" },
  { id: "lm-studio", name: "LM Studio (Local)", defaultUrl: "http://localhost:1234/v1", color: "rose", icon: "💻" },
];

const PROVIDER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  openai: { bg: "from-emerald-500/10 via-emerald-400/5 to-transparent", border: "border-emerald-200/60 hover:border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", glow: "shadow-emerald-200/40" },
  anthropic: { bg: "from-amber-500/10 via-amber-400/5 to-transparent", border: "border-amber-200/60 hover:border-amber-300", text: "text-amber-700", dot: "bg-amber-500", glow: "shadow-amber-200/40" },
  google: { bg: "from-blue-500/10 via-blue-400/5 to-transparent", border: "border-blue-200/60 hover:border-blue-300", text: "text-blue-700", dot: "bg-blue-500", glow: "shadow-blue-200/40" },
  ollama: { bg: "from-purple-500/10 via-purple-400/5 to-transparent", border: "border-purple-200/60 hover:border-purple-300", text: "text-purple-700", dot: "bg-purple-500", glow: "shadow-purple-200/40" },
  "lm-studio": { bg: "from-rose-500/10 via-rose-400/5 to-transparent", border: "border-rose-200/60 hover:border-rose-300", text: "text-rose-700", dot: "bg-rose-500", glow: "shadow-rose-200/40" },
  custom: { bg: "from-slate-500/10 via-slate-400/5 to-transparent", border: "border-slate-200/60 hover:border-slate-300", text: "text-slate-700", dot: "bg-slate-500", glow: "shadow-slate-200/40" },
};

const DEFAULT_ROLES = ["Manager", "Coding", "Design", "Research", "Fast Inference", "Vision"];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } },
};

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
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [providerModelsCache, setProviderModelsCache] = useState<Record<string, string[]>>({});

  const [activeProvider, setActiveProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editApiKey, setEditApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const loadData = async () => {
    try {
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

      const modelsList: ProviderModel[] = [];
      const modelsCache: Record<string, string[]> = {};
      for (const p of mappedProviders) {
        if (p.enabled) {
          try {
            const res = await getJson<{ models: string[] }>(`/api/settings/providers/${p.id}/discover-models`);
            modelsCache[p.id] = res.models || [];
            res.models.forEach((m) => {
              modelsList.push({ id: m, provider: p.id, model: m });
            });
          } catch { /* fallback */ }
        }
      }
      setAllModels(modelsList);
      setProviderModelsCache(modelsCache);

      const rolesData = await getJson<{ roles: Record<string, string> }>("/api/settings/roles");
      setRoles(rolesData.roles);

      const secData = await getJson<{ security: Record<string, boolean> }>("/api/settings/security");
      setSecurity(secData.security);
      setDbConnected(true);
    } catch {
      setDbConnected(false);
      toast.error("Database unavailable — Settings saved to memory only.");
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleProvider = async (provider: ProviderConfig, enabled: boolean) => {
    try {
      await sendJson(`/api/settings/providers/${provider.id}`, "PATCH", { enabled });
      toast.success(`${provider.label} ${enabled ? "enabled" : "disabled"}.`);
      loadData();
    } catch { toast.error("Failed to update status."); }
  };

  const handleDeleteProvider = async (provider: ProviderConfig) => {
    if (!confirm(`Are you sure you want to delete ${provider.label}?`)) return;
    try {
      await sendJson(`/api/settings/providers/${provider.id}`, "DELETE");
      toast.success(`${provider.label} provider deleted.`);
      loadData();
    } catch { toast.error("Failed to delete provider."); }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await sendJson<{ success: boolean; message: string }>(`/api/settings/providers/${providerId}/test`, "POST");
      if (res.success) toast.success(res.message);
      else toast.warning(res.message);
      loadData();
    } catch { toast.error("Connection test failed."); }
    finally { setTestingId(null); }
  };

  const handleDiscoverModels = async (providerId: string) => {
    setDiscoveringId(providerId);
    try {
      const res = await sendJson<{ success: boolean; models: string[] }>(`/api/settings/providers/${providerId}/discover-models`, "POST");
      if (res.success) toast.success(`Discovered ${res.models.length} models`);
      loadData();
    } catch { toast.error("Failed to discover models."); }
    finally { setDiscoveringId(null); }
  };

  const handleAddClick = () => {
    setIsNew(true);
    setActiveProvider({
      id: "openai", provider: "openai", label: "OpenAI",
      baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o", enabled: true,
      metadata: { compatibilityMode: "openai-compatible", customModels: "", headers: "{}", queryParameters: "{}" },
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
        queryParameters: p.metadata?.queryParameters || "{}",
      },
    });
    setEditApiKey("");
  };

  const handleSaveProvider = async () => {
    if (!activeProvider || !activeProvider.label) return;
    setSaving(true);
    try {
      if (activeProvider.metadata?.headers) {
        try { JSON.parse(activeProvider.metadata.headers); }
        catch { toast.error("Invalid Headers JSON."); setSaving(false); return; }
      }
      if (activeProvider.metadata?.queryParameters) {
        try { JSON.parse(activeProvider.metadata.queryParameters); }
        catch { toast.error("Invalid Query Parameters JSON."); setSaving(false); return; }
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
          queryParameters: activeProvider.metadata?.queryParameters || "{}",
        },
      };

      if (isNew) {
        await sendJson("/api/settings/providers", "POST", payload);
        toast.success(`Provider ${activeProvider.label} created.`);
      } else {
        await sendJson(`/api/settings/providers/${activeProvider.id}`, "PATCH", payload);
        toast.success(`${activeProvider.label} updated.`);
      }
      setActiveProvider(null);
      loadData();
    } catch { toast.error("Failed to save provider."); }
    finally { setSaving(false); }
  };

  const handleSaveRoles = async () => {
    try {
      await sendJson("/api/settings/roles", "POST", { roles });
      toast.success("Role assignments saved.");
    } catch { toast.error("Failed to save roles."); }
  };

  const handleSaveSecurity = async () => {
    try {
      await sendJson("/api/settings/security", "POST", { security });
      toast.success("Security settings saved.");
    } catch { toast.error("Failed to save security."); }
  };

  const getProviderColor = (providerId: string) => PROVIDER_COLORS[providerId] || PROVIDER_COLORS.custom;
  const getProviderMeta = (providerId: string) => PRESET_PROVIDERS.find((p) => p.id === providerId);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* DB Connection Banner */}
      {dbConnected === false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-950">Database Unavailable</p>
            <p className="text-[11px] text-amber-700/70">
              Your Supabase project is offline. Settings will not persist between sessions.
              Go to supabase.com to reactivate your project, or configure a local database.
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none text-[10px] max-w-[220px]">
                Update SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env to reconnect.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-amber-950 flex items-center gap-3">
            <span className="relative">
              <Settings className="w-8 h-8 text-amber-600" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping opacity-40" />
            </span>
            Control Plane
          </h1>
          <p className="text-sm text-amber-700/80 mt-1 ml-11">Configure providers, map execution roles, and define security rules.</p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={handleAddClick} className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md rounded-xl px-5 py-2.5 h-auto">
            <Plus className="w-4 h-4 mr-2" /> Add Provider
          </Button>
        </motion.div>
      </motion.div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md p-1.5 bg-amber-100/50 rounded-2xl border border-amber-200/50 shadow-sm">
          <TabsTrigger value="providers" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-sm rounded-xl text-amber-700/80 text-xs font-semibold transition-all">
            <Server className="w-4 h-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-sm rounded-xl text-amber-700/80 text-xs font-semibold transition-all">
            <Cpu className="w-4 h-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-sm rounded-xl text-amber-700/80 text-xs font-semibold transition-all">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ PROVIDERS TAB ═══════════════════ */}
        <TabsContent value="providers" className="space-y-4">
          <AnimatePresence mode="wait">
            {providers.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50/30 to-amber-100/20 py-16 text-center rounded-3xl">
                  <CardContent className="space-y-4">
                    <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-200/50">
                        <WifiOff className="w-8 h-8 text-white" />
                      </div>
                    </motion.div>
                    <h3 className="text-xl font-bold text-amber-950">No Providers Connected</h3>
                    <p className="text-sm text-amber-700/70 max-w-md mx-auto leading-relaxed">
                      Connect cloud model providers (OpenAI, Anthropic, Gemini) or local endpoints (Ollama, LM Studio) to power your agents.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {PRESET_PROVIDERS.map((pr) => (
                        <Badge key={pr.id} variant="outline" className="text-[10px] border-amber-200 bg-white/60 text-amber-800 px-3 py-1 shadow-sm">
                          {pr.icon} {pr.name}
                        </Badge>
                      ))}
                    </div>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button onClick={handleAddClick} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200/50 px-6 py-2.5 h-auto">
                        <Plus className="w-4 h-4 mr-2" /> Connect Your First Provider
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="grid" variants={containerVariants} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2">
                {providers.map((p) => {
                  const colors = getProviderColor(p.provider);
                  const meta = getProviderMeta(p.provider);
                  const isExpanded = expandedProvider === p.id;
                  const models = providerModelsCache[p.id] || [];

                  return (
                    <motion.div key={p.id} variants={cardVariants} layout>
                      <Card className={cn(
                        "border shadow-sm bg-white overflow-hidden rounded-2xl transition-all duration-300 group",
                        colors.border, colors.glow,
                        "hover:shadow-md"
                      )}>
                        {/* Gradient Header Strip */}
                        <div className={cn("h-1.5 w-full bg-gradient-to-r", colors.bg)} />

                        <CardHeader className="pb-3 border-b border-amber-100/55 bg-amber-50/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border",
                                `bg-${p.provider === "openai" ? "emerald" : p.provider === "anthropic" ? "amber" : "slate"}-50`
                              )}>
                                {meta?.icon || <Server className="w-5 h-5 text-slate-600" />}
                              </div>
                              <div>
                                <CardTitle className="text-base font-bold text-amber-950 flex items-center gap-2">
                                  {p.label}
                                  <Badge className={cn(
                                    "text-[9px] px-2 py-0 font-semibold uppercase tracking-wider border-none shadow-none",
                                    p.enabled
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  )}>
                                    {p.enabled ? "Active" : "Disabled"}
                                  </Badge>
                                </CardTitle>
                                <CardDescription className="text-[10px] font-mono mt-0.5 text-amber-600/80 flex items-center gap-1.5">
                                  <Link2 className="w-3 h-3 inline" />
                                  <span className="truncate max-w-[200px]">{p.baseUrl}</span>
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-4">
                          {/* Status & Info Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/60 space-y-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70 flex items-center gap-1">
                                <Database className="w-3 h-3" /> Default Model
                              </span>
                              <p className="text-sm font-bold text-amber-950 truncate">{p.defaultModel || "—"}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/60 space-y-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70 flex items-center gap-1">
                                <Key className="w-3 h-3" /> API Key
                              </span>
                              <p className="text-sm font-bold text-amber-950 font-mono flex items-center gap-1.5">
                                {p.apiKeyLast4 ? (
                                  <><span className="w-2 h-2 rounded-full bg-emerald-500" /> •••• {p.apiKeyLast4}</>
                                ) : (
                                  <span className="text-amber-500/70 text-xs font-sans">Not configured</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Validation Status */}
                          <AnimatePresence>
                            {p.validationStatus && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border",
                                  p.validationStatus === "valid"
                                    ? "bg-emerald-50/70 border-emerald-200/50 text-emerald-800"
                                    : "bg-red-50/70 border-red-200/50 text-red-800"
                                )}
                              >
                                {p.validationStatus === "valid" ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                )}
                                <span>{p.validationStatus === "valid" ? "Connection Verified" : "Connection Failed"}</span>
                                {p.lastValidatedAt && (
                                  <span className="text-[10px] opacity-60 ml-auto">{new Date(p.lastValidatedAt).toLocaleDateString()}</span>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Expandable Models Section */}
                          {models.length > 0 && (
                            <div className="border border-amber-200/50 rounded-xl overflow-hidden">
                              <button
                                onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-amber-50/30 text-xs font-semibold text-amber-800 hover:bg-amber-50/60 transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                  {models.length} Available Model{models.length > 1 ? "s" : ""}
                                </span>
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                    className="overflow-hidden border-t border-amber-200/40"
                                  >
                                    <div className="px-3 py-2 space-y-1 max-h-[160px] overflow-y-auto">
                                      {models.map((model) => (
                                        <div key={model} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50/50 text-[11px] font-mono text-amber-900 transition-colors">
                                          <Radio className="w-3 h-3 text-amber-500 shrink-0" />
                                          <span className="truncate">{model}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Actions Bar */}
                          <div className="flex items-center justify-between pt-2 border-t border-amber-100">
                            <div className="flex items-center gap-1.5">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="ghost"
                                      onClick={() => handleTestConnection(p.id)}
                                      disabled={testingId === p.id}
                                      className="h-8 w-8 p-0 text-amber-700 hover:bg-amber-50 rounded-xl"
                                    >
                                      {testingId === p.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Zap className="w-4 h-4" />
                                      }
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">Test Connection</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="ghost"
                                      onClick={() => handleDiscoverModels(p.id)}
                                      disabled={discoveringId === p.id}
                                      className="h-8 w-8 p-0 text-amber-700 hover:bg-amber-50 rounded-xl"
                                    >
                                      {discoveringId === p.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <RotateCw className="w-4 h-4" />
                                      }
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">Discover Models</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={p.enabled}
                                onCheckedChange={(val) => handleToggleProvider(p, val)}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button size="sm" variant="outline" onClick={() => handleEditClick(p)}
                                  className="h-8 text-xs border-amber-200 text-amber-900 hover:bg-amber-50 rounded-xl px-3">
                                  Configure
                                </Button>
                              </motion.div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteProvider(p)}
                                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-xl">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">Delete Provider</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ═══════════════════ ROLES TAB ═══════════════════ */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border border-amber-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-r from-amber-50/30 to-amber-100/20 border-b border-amber-100">
              <CardTitle className="text-lg font-bold text-amber-950 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-600" /> System Role Allocation
              </CardTitle>
              <CardDescription className="text-xs text-amber-700/80">Assign active models to each key agent task role.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {DEFAULT_ROLES.map((role, idx) => (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/30 border border-amber-100/50 hover:border-amber-200/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm",
                      role === "Manager" ? "bg-purple-100 text-purple-700" :
                      role === "Coding" ? "bg-blue-100 text-blue-700" :
                      role === "Design" ? "bg-pink-100 text-pink-700" :
                      role === "Research" ? "bg-cyan-100 text-cyan-700" :
                      role === "Fast Inference" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {role.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm">{role}</h4>
                      <p className="text-[11px] text-amber-600/70">
                        {role === "Manager" && "Orchestration & Planning"}
                        {role === "Coding" && "Code generation & filesystem writes"}
                        {role === "Design" && "Aesthetic canvas and interface building"}
                        {role === "Research" && "Web searches, analysis, and data aggregation"}
                        {role === "Fast Inference" && "Quick classification and immediate feedback"}
                        {role === "Vision" && "Image understanding, screenshot analysis, OCR"}
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-[300px]">
                    <Select
                      value={roles[role] || ""}
                      onValueChange={(val) => setRoles((prev) => ({ ...prev, [role]: val }))}
                    >
                      <SelectTrigger className="w-full bg-white border-amber-200 text-amber-950 rounded-xl text-xs h-10">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-amber-200 max-h-[200px]">
                        {allModels.length === 0 ? (
                          <SelectItem value="none" disabled className="text-xs text-amber-600">
                            No active models (enable providers)
                          </SelectItem>
                        ) : (
                          allModels.map((m) => (
                            <SelectItem key={m.id} value={m.model} className="text-xs text-amber-950 focus:bg-amber-50">
                              <span className="flex items-center gap-2">
                                <Radio className="w-3 h-3 text-amber-500" />
                                {m.model}
                                <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600 ml-auto">{m.provider}</Badge>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              ))}

              <div className="flex justify-end pt-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={handleSaveRoles} className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save Role Assignments
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ SECURITY TAB ═══════════════════ */}
        <TabsContent value="security" className="space-y-4">
          <Card className="border border-amber-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-r from-amber-50/30 to-amber-100/20 border-b border-amber-100">
              <CardTitle className="text-lg font-bold text-amber-950 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" /> Runtime Safety Controls
              </CardTitle>
              <CardDescription className="text-xs text-amber-700/80">Configure authorization boundaries and agent permissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {[
                { key: "terminal", label: "Allow Terminal Execution", desc: "Permits agents to run shell commands on your machine.", icon: <Terminal className="w-5 h-5" />, iconBg: "bg-amber-100", iconFg: "text-amber-700" },
                { key: "filesystem", label: "Allow Filesystem Writes", desc: "Enables file creation, editing, and deletion.", icon: <Save className="w-5 h-5" />, iconBg: "bg-amber-100", iconFg: "text-amber-700" },
                { key: "approval", label: "Require Approval for Destructive Actions", desc: "Ask for confirmation before deleting files or running terminal commands.", icon: <Shield className="w-5 h-5" />, iconBg: "bg-red-100", iconFg: "text-red-700" },
                { key: "browser", label: "Enable Browser Automation", desc: "Allows Playwright web crawling and browser navigation.", icon: <Globe className="w-5 h-5" />, iconBg: "bg-blue-100", iconFg: "text-blue-700" },
              ].map((item, idx) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/20 border border-amber-100/50 hover:border-amber-200/70 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      item.iconBg, item.iconFg
                    )}>
                      {item.icon}
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-amber-950 cursor-pointer">{item.label}</Label>
                      <p className="text-xs text-amber-600/70">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={security[item.key] ?? true}
                    onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, [item.key]: checked }))}
                    className={cn(
                      "shrink-0",
                      item.key === "approval" ? "data-[state=checked]:bg-amber-500" :
                      item.key === "terminal" ? "data-[state=checked]:bg-emerald-500" :
                      "data-[state=checked]:bg-blue-500"
                    )}
                  />
                </motion.div>
              ))}

              <div className="flex justify-end pt-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={handleSaveSecurity} className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save Security Settings
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ PROVIDER DIALOG ═══════════════════ */}
      <Dialog open={!!activeProvider} onOpenChange={() => setActiveProvider(null)}>
        <DialogContent className="max-w-xl bg-white border border-amber-200 rounded-3xl shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Dialog Gradient Header */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-6 pt-6 pb-4 border-b border-amber-100">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border bg-white",
                  activeProvider?.provider ? `border-${getProviderColor(activeProvider.provider).border.replace("border-", "")}` : "border-amber-200"
                )}>
                  {getProviderMeta(activeProvider?.provider || "")?.icon || <Server className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-amber-950">
                    {isNew ? "Add Provider" : `Configure ${activeProvider?.label}`}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-amber-600/70 mt-0.5">
                    Configure endpoint, API key, models, and custom headers.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">
            {activeProvider && (
              <>
                {/* Provider Type & Display Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Gateway Type</Label>
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
                        <SelectTrigger className="border-amber-200 text-amber-950 bg-white rounded-xl h-10">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-amber-200">
                          {PRESET_PROVIDERS.map((pr) => (
                            <SelectItem key={pr.id} value={pr.id} className="text-xs text-amber-950 focus:bg-amber-50">
                              <span className="flex items-center gap-2">{pr.icon} {pr.name}</span>
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" className="text-xs text-amber-950 focus:bg-amber-50">
                            <span className="flex items-center gap-2">🔧 Custom API Provider</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-amber-50/50 border border-amber-200 text-amber-950 font-semibold text-sm">
                        {getProviderMeta(activeProvider.provider || "")?.icon} {activeProvider.provider}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Display Name</Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-10"
                      value={activeProvider.label || ""}
                      onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, label: e.target.value } : null)}
                      placeholder="e.g. Together AI"
                    />
                  </div>
                </div>

                {/* Endpoint Base URL */}
                <div className="space-y-1.5">
                  <Label className="text-amber-950 text-xs font-bold">Base URL</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-10 pl-9"
                      value={activeProvider.baseUrl || ""}
                      onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, baseUrl: e.target.value } : null)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label className="text-amber-950 text-xs font-bold">API Key</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-10 pl-9 pr-10"
                      type={showApiKey ? "text" : "password"}
                      value={editApiKey}
                      onChange={(e) => setEditApiKey(e.target.value)}
                      placeholder={activeProvider.apiKeyLast4 ? `••••••••${activeProvider.apiKeyLast4} (unchanged)` : "sk-..."}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Default Model */}
                <div className="space-y-1.5">
                  <Label className="text-amber-950 text-xs font-bold">Default Model</Label>
                  <Input
                    className="border-amber-200 text-amber-950 rounded-xl h-10"
                    value={activeProvider.defaultModel || ""}
                    onChange={(e) => setActiveProvider((prev) => prev ? { ...prev, defaultModel: e.target.value } : null)}
                    placeholder="e.g. gpt-4o or claude-3-5-sonnet"
                  />
                </div>

                {/* Custom Provider Options */}
                {(activeProvider.provider === "custom" || activeProvider.provider === "openai" || activeProvider.provider === "anthropic") && (
                  <div className="border border-dashed border-amber-200 p-4 space-y-4 rounded-2xl bg-gradient-to-br from-amber-50/20 to-amber-100/10">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" /> Advanced Configuration
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-amber-950 text-xs font-bold">Compatibility Mode</Label>
                        <Select
                          value={activeProvider.metadata?.compatibilityMode || "openai-compatible"}
                          onValueChange={(val) =>
                            setActiveProvider((prev) => prev ? {
                              ...prev,
                              metadata: { ...(prev.metadata || {}), compatibilityMode: val },
                            } : null)
                          }
                        >
                          <SelectTrigger className="bg-white border-amber-200 rounded-xl h-10">
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
                        <Label className="text-amber-950 text-xs font-bold">Custom Models List</Label>
                        <Input
                          className="border-amber-200 text-amber-950 rounded-xl h-10"
                          value={activeProvider.metadata?.customModels || ""}
                          onChange={(e) =>
                            setActiveProvider((prev) => prev ? {
                              ...prev,
                              metadata: { ...(prev.metadata || {}), customModels: e.target.value },
                            } : null)
                          }
                          placeholder="gpt-4o, mixtral-8x7b"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-amber-950 text-xs font-bold">Custom Headers <span className="text-[9px] text-amber-500 font-normal">(JSON)</span></Label>
                        <Textarea
                          className="border-amber-200 font-mono text-xs rounded-xl bg-white min-h-[70px]"
                          value={activeProvider.metadata?.headers || "{}"}
                          onChange={(e) =>
                            setActiveProvider((prev) => prev ? {
                              ...prev,
                              metadata: { ...(prev.metadata || {}), headers: e.target.value },
                            } : null)
                          }
                          placeholder='{ "X-Custom-Header": "value" }'
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-amber-950 text-xs font-bold">Query Parameters <span className="text-[9px] text-amber-500 font-normal">(JSON)</span></Label>
                        <Textarea
                          className="border-amber-200 font-mono text-xs rounded-xl bg-white min-h-[70px]"
                          value={activeProvider.metadata?.queryParameters || "{}"}
                          onChange={(e) =>
                            setActiveProvider((prev) => prev ? {
                              ...prev,
                              metadata: { ...(prev.metadata || {}), queryParameters: e.target.value },
                            } : null)
                          }
                          placeholder='{ "ref": "agentos" }'
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-amber-100 bg-amber-50/20 gap-2">
            <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl h-10 px-5"
              onClick={() => setActiveProvider(null)}>
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl shadow-sm h-10 px-6"
                onClick={handleSaveProvider} disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
                )}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
