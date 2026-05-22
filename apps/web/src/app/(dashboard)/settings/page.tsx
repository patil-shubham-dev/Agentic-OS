"use client";

import { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Settings, Server, Cpu, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { useProviderStore } from "@/stores/provider-store";
import { useModelRegistry } from "@/stores/model-registry";
import { useRoleStore } from "@/stores/role-store";
import {
  ProviderSettings,
  ProviderModal,
  RoleSettings,
  SecuritySettings,
} from "@/components/settings";

const GATEWAY_TYPES = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", type: "cloud" as const },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", type: "cloud" as const },
  { id: "google", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", type: "cloud" as const },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", type: "cloud" as const },
  { id: "nvidia", name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", type: "cloud" as const },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", type: "cloud" as const },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", type: "cloud" as const },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", type: "cloud" as const },
  { id: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434/v1", type: "local" as const },
  { id: "lmstudio", name: "LM Studio (Local)", baseUrl: "http://localhost:1234/v1", type: "local" as const },
];

export default function SettingsPage() {
  const settings = useSettings();
  const providers = useProviderStore((s) => s.providers);
  const activeModels = useModelRegistry((s) => s.activeModels);
  const getModelsByProvider = useModelRegistry((s) => s.getModelsByProvider);
  const roleAssignments = useRoleStore((s) => s.assignments);

  // Derive per-provider roles from role assignments
  const providerRoles = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of roleAssignments) {
      if (a.autoRoute) continue;
      if (!map[a.providerId]) map[a.providerId] = [];
      if (!map[a.providerId].includes(a.role)) {
        map[a.providerId].push(a.role);
      }
    }
    return map;
  }, [roleAssignments]);

  // --- Destructure stable references ONCE at top level ---
  const {
    setActiveProvider, setEditApiKey, setShowApiKey,
    setDialogTestResult, setModelPickerOpen,
    handleDialogTestConnection, handleSaveProvider,
    triggerModelDiscovery, resetDialog,
  } = settings;

  const handleGatewaySelect = useCallback((gt: typeof GATEWAY_TYPES[0]) => {
    settings.setIsNew(true);
    setActiveProvider({
      id: gt.id,
      name: gt.name,
      baseUrl: gt.baseUrl,
      defaultModel: "",
      selectedModel: "",
      enabled: true,
      type: gt.type,
      health: "unknown",
      latency: 0,
    });
    setEditApiKey("");
  }, [setActiveProvider, setEditApiKey]);

  const handleProviderTypeChange = useCallback((val: string) => {
    const gateway = GATEWAY_TYPES.find((g) => g.id === val);
    const isLocal = val === "ollama" || val === "lmstudio";
    setDialogTestResult(null);
    setActiveProvider((prev) =>
      prev
        ? {
            ...prev,
            id: val,
            name: gateway?.name || "Custom API Provider",
            baseUrl: gateway?.baseUrl || "",
            type: isLocal ? "local" : val === "custom" ? "openai-compatible" : "cloud",
          }
        : null
    );
  }, [setActiveProvider, setDialogTestResult]);

  const handleBaseUrlBlur = useCallback((val: string) => {
    let normalized = val.trim();
    if (normalized && !normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
      setActiveProvider((prev) =>
        prev ? { ...prev, baseUrl: normalized } : null
      );
    }
  }, [setActiveProvider]);

  const handleModelPickerToggle = useCallback(() => {
    setModelPickerOpen(!settings.modelPickerOpen);
  }, [setModelPickerOpen, settings.modelPickerOpen]);

  const handleTriggerDiscovery = useCallback(() => {
    if (settings.activeProvider) {
      triggerModelDiscovery(
        settings.activeProvider.id || "",
        settings.activeProvider.baseUrl || "",
        settings.editApiKey || ""
      );
    }
  }, [settings.activeProvider, settings.editApiKey, triggerModelDiscovery]);

  // Stable callbacks — deps are SETTERS which never change
  const onNameChange = useCallback(
    (name: string) => setActiveProvider((prev) => prev ? { ...prev, name } : null),
    [setActiveProvider]
  );
  const onBaseUrlChange = useCallback(
    (url: string) => {
      setDialogTestResult(null);
      setActiveProvider((prev) => prev ? { ...prev, baseUrl: url } : null);
    },
    [setActiveProvider, setDialogTestResult]
  );
  const onApiKeyChange = useCallback(
    (key: string) => {
      setEditApiKey(key);
      setDialogTestResult(null);
    },
    [setEditApiKey, setDialogTestResult]
  );
  const onShowApiKeyToggle = useCallback(
    () => setShowApiKey(!settings.showApiKey),
    [setShowApiKey, settings.showApiKey]
  );
  const onDefaultModelSelect = useCallback(
    (modelId: string) => {
      setActiveProvider((prev) => prev ? { ...prev, selectedModel: modelId, defaultModel: modelId } : null);
      setModelPickerOpen(false);
    },
    [setActiveProvider, setModelPickerOpen]
  );

  const stableTestConnection = useCallback(
    () => handleDialogTestConnection(),
    [handleDialogTestConnection]
  );
  const stableSave = useCallback(
    () => handleSaveProvider(),
    [handleSaveProvider]
  );

  return (
    <div className="h-full overflow-hidden flex flex-col agentos-shell">
      {settings.dbConnected === false && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-2.5 bg-amber-950/40 border-b border-[--border-secondary]"
        >
          <AlertCircle className="w-4 h-4 text-[--accent-primary] shrink-0" />
          <p className="text-xs font-medium text-[--accent-soft]">
            Database offline — settings won&apos;t persist between sessions.
          </p>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold text-[--text-primary] flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                  <Settings className="w-4.5 h-4.5 text-[--accent-primary]" />
                </span>
                Settings
              </h1>
              <p className="text-sm text-[--text-muted] mt-1 ml-11">
                Configure provider connections, map execution roles, and manage security settings.
              </p>
            </div>
          </motion.div>

          <Tabs defaultValue="providers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-0.5">
              <TabsTrigger
                value="providers"
                className="gap-2 data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded-lg text-xs text-[--text-muted]"
              >
                <Server className="w-4 h-4" /> Providers
              </TabsTrigger>
              <TabsTrigger
                value="roles"
                className="gap-2 data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded-lg text-xs text-[--text-muted]"
              >
                <Cpu className="w-4 h-4" /> Roles
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="gap-2 data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded-lg text-xs text-[--text-muted]"
              >
                <Shield className="w-4 h-4" /> Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="providers" className="space-y-4">
              <ProviderSettings
                providers={providers}
                modelCount={activeModels.length}
                localDetecting={settings.localDetecting}
                testingProvider={settings.testingProvider}
                providerRoles={providerRoles}
                onAddClick={settings.handleAddClick}
                onEditClick={settings.handleEditClick}
                onDeleteProvider={settings.handleDeleteProvider}
                onToggleProvider={settings.handleToggleProvider}
                onTestConnection={settings.handleTestConnection}
                onDiscoverModels={settings.handleDiscoverModels}
                onDetectLocal={settings.handleDetectLocal}
                onGatewaySelect={handleGatewaySelect}
                getModelsByProvider={getModelsByProvider}
              />
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <RoleSettings
                searchQuery={settings.searchQuery}
                onSearchChange={settings.setSearchQuery}
                onSaveRole={settings.handleSaveRole}
                onAutoRoute={settings.handleAutoRoute}
              />
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <SecuritySettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProviderModal
        open={!!settings.activeProvider}
        onOpenChange={useCallback((open: boolean) => { if (!open) resetDialog(); }, [resetDialog])}
        activeProvider={settings.activeProvider}
        isNew={settings.isNew}
        editApiKey={settings.editApiKey}
        showApiKey={settings.showApiKey}
        saving={settings.saving}
        testingDialog={settings.testingDialog}
        dialogTestResult={settings.dialogTestResult}
        modelPickerOpen={settings.modelPickerOpen}
        discoveredModels={settings.discoveredModels}
        discoveringModels={settings.discoveringModels}
        discoveryError={settings.discoveryError}
        discoveryStatus={settings.discoveryStatus}
        modelsSource={settings.modelsSource}
        modelsFetchedAt={settings.modelsFetchedAt}
        onProviderTypeChange={handleProviderTypeChange}
        onNameChange={onNameChange}
        onBaseUrlChange={onBaseUrlChange}
        onBaseUrlBlur={handleBaseUrlBlur}
        onApiKeyChange={onApiKeyChange}
        onShowApiKeyToggle={onShowApiKeyToggle}
        onSelectedModelSelect={onDefaultModelSelect}
        onModelPickerToggle={handleModelPickerToggle}
        onTestConnection={stableTestConnection}
        onSave={stableSave}
        onTriggerDiscovery={handleTriggerDiscovery}
        onCloseDialogResult={useCallback(() => settings.setDialogTestResult(null), [settings.setDialogTestResult])}
      />
    </div>
  );
}