import { useEffect, useState, useCallback, useRef } from "react";
import { useProviderStore } from "@/stores/provider-store";
import { useModelRegistry } from "@/stores/model-registry";
import { useRoleStore } from "@/stores/role-store";
import { modelCache } from "@/lib/runtime/model-cache";
import type { NormalizedModel, UniversalProviderConfig } from "@/lib/runtime/types";
import { sendJson, testProviderConnection, isElectron } from "@/lib/client-api";
import { toast } from "sonner";

interface UseSettingsState {
  dbConnected: boolean | null;
  activeProvider: Partial<UniversalProviderConfig> | null;
  isNew: boolean;
  editApiKey: string;
  showApiKey: boolean;
  saving: boolean;
  searchQuery: string;
  localDetecting: boolean;
  testingProvider: string | null;
  testingDialog: boolean;
  dialogTestResult: { success: boolean; message: string } | null;
  modelPickerOpen: boolean;
  discoveredModels: NormalizedModel[];
  discoveringModels: boolean;
  discoveryError: string | null;
  discoveryStatus: "idle" | "loading" | "success" | "error";
  modelsSource: "cache" | "fresh" | null;
  modelsFetchedAt: number | null;
}

interface UseSettingsActions {
  setActiveProvider: (p: Partial<UniversalProviderConfig> | null | ((prev: Partial<UniversalProviderConfig> | null) => Partial<UniversalProviderConfig> | null)) => void;
  setIsNew: (v: boolean) => void;
  setEditApiKey: (v: string) => void;
  setShowApiKey: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  setLocalDetecting: (v: boolean) => void;
  setTestingProvider: (v: string | null) => void;
  setTestingDialog: (v: boolean) => void;
  setDialogTestResult: (v: { success: boolean; message: string } | null) => void;
  setModelPickerOpen: (v: boolean) => void;
  setDiscoveredModels: (m: NormalizedModel[]) => void;
  setDiscoveringModels: (v: boolean) => void;
  setDiscoveryError: (e: string | null) => void;
  setDiscoveryStatus: (s: "idle" | "loading" | "success" | "error") => void;
  setModelsSource: (s: "cache" | "fresh" | null) => void;
  setModelsFetchedAt: (t: number | null) => void;
  handleAddClick: () => void;
  handleEditClick: (p: UniversalProviderConfig) => void;
  handleSaveProvider: () => Promise<void>;
  handleDeleteProvider: (p: UniversalProviderConfig) => Promise<void>;
  handleToggleProvider: (p: UniversalProviderConfig, enabled: boolean) => Promise<void>;
  handleTestConnection: (providerId: string) => Promise<void>;
  handleDialogTestConnection: () => Promise<void>;
  handleDiscoverModels: () => Promise<void>;
  handleDetectLocal: () => Promise<void>;
  handleSaveRole: (role: string, modelId: string) => Promise<void>;
  handleAutoRoute: (role: string, autoRoute: boolean) => void;
  triggerModelDiscovery: (providerId: string, baseUrl: string, apiKey: string) => Promise<void>;
  resetDialog: () => void;
}

export function useSettings(): UseSettingsState & UseSettingsActions {

  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [activeProvider, setActiveProvider] = useState<Partial<UniversalProviderConfig> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editApiKey, setEditApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localDetecting, setLocalDetecting] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testingDialog, setTestingDialog] = useState(false);
  const [dialogTestResult, setDialogTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<NormalizedModel[]>([]);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [modelsSource, setModelsSource] = useState<"cache" | "fresh" | null>(null);
  const [modelsFetchedAt, setModelsFetchedAt] = useState<number | null>(null);

  const discoveryAbortRef = useRef<AbortController | null>(null);
  const discoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebouncedFetchRef = useRef(false);
  const activeNameRef = useRef(activeProvider?.name);

  useEffect(() => {
    activeNameRef.current = activeProvider?.name;
  }, [activeProvider?.name]);

  useEffect(() => {
    const init = async () => {
      await useProviderStore.getState().hydrate();
      await useModelRegistry.getState().refresh();
      await useRoleStore.getState().hydrate();
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

  async function safeFetchJson(url: string, options: RequestInit): Promise<any> {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();
    if (!contentType.includes("json")) {
      const preview = bodyText.replace(/[\r\n]+/g, " ").substring(0, 120).trim();
      throw new Error(
        `Server returned non-JSON response (Content-Type: ${contentType}, HTTP ${res.status}). ` +
        `The endpoint may be incorrect or the server returned an error page. ` +
        `Response: "${preview}"`
      );
    }
    try {
      return JSON.parse(bodyText);
    } catch (e) {
      const preview = bodyText.replace(/[\r\n]+/g, " ").substring(0, 120).trim();
      throw new Error(
        `Invalid JSON response from server: ${e instanceof Error ? e.message : "Parse error"}. ` +
        `Response: "${preview}"`
      );
    }
  }

  const triggerModelDiscovery = useCallback(async (providerId: string, baseUrl: string, apiKey: string) => {
    if (discoveryAbortRef.current) {
      discoveryAbortRef.current.abort();
    }

    if (!baseUrl.startsWith("http")) {
      setDiscoveredModels([]);
      setDiscoveryStatus("idle");
      setDiscoveryError(null);
      return;
    }

    setDiscoveringModels(true);
    setDiscoveryStatus("loading");
    setDiscoveryError(null);

    const controller = new AbortController();
    discoveryAbortRef.current = controller;

    try {
      const data = await safeFetchJson("/api/settings/providers/discover-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey || undefined,
          providerId,
        }),
      });
      if (controller.signal.aborted) return;

      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        const normalized: NormalizedModel[] = data.models.map((modelName: string) => ({
          id: modelName,
          providerId,
          providerName: activeNameRef.current || providerId,
          name: modelName,
          label: modelName.split("/").pop() || modelName,
          contextWindow: 8192,
          maxOutputTokens: 4096,
          capabilities: ["streaming"],
          speed: "balanced" as const,
          status: "available" as const,
        }));
        modelCache.set(providerId, baseUrl, apiKey, normalized);
        setDiscoveredModels(normalized);
        setDiscoveryStatus("success");
        setDiscoveryError(null);
        setModelsSource("fresh");
        setModelsFetchedAt(Date.now());
      } else {
        setDiscoveredModels([]);
        if (data.note) {
          setDiscoveryStatus("success");
          setDiscoveryError(null);
          setModelsSource(null);
          setModelsFetchedAt(null);
        } else {
          setDiscoveryStatus("error");
          setDiscoveryError(data.error || "No models returned by the endpoint.");
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setDiscoveredModels([]);
      setDiscoveryStatus("error");
      setDiscoveryError(
        err instanceof Error
          ? err.message
          : "Failed to discover models. Check the Base URL and API key."
      );
    } finally {
      if (!controller.signal.aborted) {
        setDiscoveringModels(false);
      }
      if (discoveryAbortRef.current === controller) {
        discoveryAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!activeProvider || !isNew) return;

    const pid = activeProvider.id || "";
    const burl = activeProvider.baseUrl || "";
    const akey = editApiKey || "";
    const isLocal = pid === "ollama" || pid === "lmstudio";
    const isAnthropic = pid === "anthropic";

    const hasApiKey = akey.length > 0;
    const hasValidUrl = burl.startsWith("http");
    const shouldCache = isLocal
      ? hasValidUrl
      : isAnthropic
        ? false
        : hasValidUrl && hasApiKey;

    if (!shouldCache) return;

    const cached = modelCache.get(pid, burl, akey);
    if (cached) {
      setDiscoveredModels(cached.models);
      setDiscoveryStatus("success");
      setDiscoveryError(null);
      setModelsSource("cache");
      setModelsFetchedAt(cached.fetchedAt);

      const fiveMinutes = 300_000;
      const isFresh = Date.now() - cached.fetchedAt < fiveMinutes;
      if (isFresh) {
        skipDebouncedFetchRef.current = true;
      } else {
        triggerModelDiscovery(pid, burl, akey);
      }
    }
  }, [activeProvider?.id, activeProvider?.baseUrl, editApiKey, isNew]);

  useEffect(() => {
    if (!activeProvider || !isNew) return;

    if (skipDebouncedFetchRef.current) {
      skipDebouncedFetchRef.current = false;
      return;
    }

    if (discoveryTimerRef.current) {
      clearTimeout(discoveryTimerRef.current);
    }

    const pid = activeProvider.id || "";
    const burl = activeProvider.baseUrl || "";
    const akey = editApiKey || "";

    const isLocal = pid === "ollama" || pid === "lmstudio";
    const isAnthropic = pid === "anthropic";
    const hasApiKey = akey.length > 0;
    const hasValidUrl = burl.startsWith("http");

    const shouldDiscover = isLocal
      ? hasValidUrl
      : isAnthropic
        ? false
        : hasValidUrl && hasApiKey;

    if (!shouldDiscover) {
      setDiscoveredModels([]);
      setDiscoveryStatus("idle");
      setDiscoveryError(null);
      setModelsSource(null);
      setModelsFetchedAt(null);
      return;
    }

    discoveryTimerRef.current = setTimeout(() => {
      triggerModelDiscovery(pid, burl, akey);
    }, 600);

    return () => {
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
        discoveryTimerRef.current = null;
      }
    };
  }, [activeProvider?.id, activeProvider?.baseUrl, editApiKey, isNew, triggerModelDiscovery]);

  useEffect(() => {
    if (!activeProvider) {
      if (discoveryAbortRef.current) {
        discoveryAbortRef.current.abort();
        discoveryAbortRef.current = null;
      }
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
        discoveryTimerRef.current = null;
      }
      setDiscoveredModels([]);
      setDiscoveringModels(false);
      setDiscoveryError(null);
      setDiscoveryStatus("idle");
      setModelsSource(null);
      setModelsFetchedAt(null);
    }
  }, [activeProvider]);

  const resetDialog = useCallback(() => {
    setActiveProvider(null);
    setDialogTestResult(null);
  }, []);

  const handleAddClick = useCallback(() => {
    setIsNew(true);
    setActiveProvider({
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "",
      selectedModel: "",
      enabled: true,
      type: "cloud",
      health: "unknown",
      latency: 0,
    });
    setEditApiKey("");
  }, []);

  const handleEditClick = useCallback((p: UniversalProviderConfig) => {
    setIsNew(false);
    setActiveProvider({ ...p });
    setEditApiKey("");
  }, []);

  const handleSaveProvider = useCallback(async () => {
    if (!activeProvider || !activeProvider.name) return;
    setSaving(true);
    try {
      // ARCHITECTURE: One provider card = ONE selected model.
      // selectedModel is the canonical field. Fall back to defaultModel
      // for backward compatibility, then first discovered model, then empty.
      const selectedModel = activeProvider.selectedModel
        || activeProvider.defaultModel
        || (discoveredModels.length > 0 ? discoveredModels[0].name : "");

      const payload: Record<string, unknown> = {
        provider: activeProvider.id,
        label: activeProvider.name,
        baseUrl: activeProvider.baseUrl,
        defaultModel: selectedModel,
        selected_model: selectedModel,      // server field (snake_case)
        configured_models: [selectedModel],  // legacy array (first element = selected model)
        enabled: activeProvider.enabled ?? true,
        apiKey: editApiKey || undefined,
      };

      const pid = activeProvider.id || "";
      const burl = activeProvider.baseUrl || "";
      const akey = editApiKey || "";

      if (isNew) {
        await sendJson("/api/settings/providers", "POST", payload);
        toast.success(`Provider ${activeProvider.name} created.`);
      } else {
        await sendJson(`/api/settings/providers/${pid}`, "PATCH", payload);
        toast.success(`${activeProvider.name} updated.`);
      }

      // Persist discovered models cache
      if (discoveredModels.length > 0) {
        modelCache.set(pid, burl, akey, discoveredModels);
      }

      // Trigger server-side discovery
      try {
        await fetch(`/api/settings/providers/${pid}/discover-models`, { method: "POST" });
      } catch { /* best-effort */ }

      // Set selectedModel in the local store
      if (selectedModel) {
        useProviderStore.getState().setSelectedModel(pid, selectedModel);
      }

      setDialogTestResult(null);
      setActiveProvider(null);
      await useProviderStore.getState().hydrate();
      await useModelRegistry.getState().refreshForProvider(pid);
      useModelRegistry.getState().deriveActiveModels();

      // Reconcile role assignments
      const remediated = useRoleStore.getState().reconcileAssignments();
      if (remediated.length > 0) {
        const activeProviderIds = useProviderStore.getState().providers.map(p => p.id);
        useRoleStore.getState().cleanupDanglingAssignments(activeProviderIds);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to save provider.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [activeProvider, isNew, editApiKey, discoveredModels]);

  const handleDeleteProvider = useCallback(async (p: UniversalProviderConfig) => {
    if (!window.confirm(`Delete ${p.name}? This action cannot be undone.`)) return;
    try {
      await sendJson(`/api/settings/providers/${p.id}`, "DELETE");
      toast.success(`${p.name} deleted.`);
      useProviderStore.getState().removeProvider(p.id);
      useModelRegistry.getState().deriveActiveModels();
      useRoleStore.getState().reconcileAssignments();
      const activeProviderIds = useProviderStore.getState().providers.map(p => p.id);
      useRoleStore.getState().cleanupDanglingAssignments(activeProviderIds);
    } catch {
      toast.error("Failed to delete.");
    }
  }, []);

  const handleToggleProvider = useCallback(async (p: UniversalProviderConfig, enabled: boolean) => {
    try {
      await sendJson(`/api/settings/providers/${p.id}`, "PATCH", { enabled });
      useProviderStore.getState().updateProvider(p.id, { enabled });
      toast.success(`${p.name} ${enabled ? "enabled" : "disabled"}.`);
      if (enabled) {
        await useModelRegistry.getState().refreshForProvider(p.id);
      }
      useModelRegistry.getState().deriveActiveModels();
      useRoleStore.getState().reconcileAssignments();
    } catch {
      toast.error("Failed to update.");
    }
  }, []);

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      // Route through IPC in Electron mode for reliability
      if (isElectron()) {
        const res = await testProviderConnection(providerId);
        if (res.ok) {
          toast.success(`Provider connected (${res.latency}ms)`);
          useProviderStore.getState().setProviderHealth(providerId, "healthy", res.latency || 0);
        } else {
          toast.warning(res.error || "Connection failed");
          useProviderStore.getState().setProviderHealth(providerId, "offline", 0);
        }
      } else {
        const res = await sendJson<{ success: boolean; message: string; latency?: number }>(
          `/api/settings/providers/${providerId}/test`,
          "POST"
        );
        if (res.success) {
          toast.success(res.message);
          useProviderStore.getState().setProviderHealth(providerId, "healthy", res.latency || 0);
        } else {
          toast.warning(res.message);
          useProviderStore.getState().setProviderHealth(providerId, "offline", 0);
        }
      }
      await useProviderStore.getState().hydrate();
    } catch (err: any) {
      toast.error(err?.message || "Connection test failed.");
      useProviderStore.getState().setProviderHealth(providerId, "offline", 0);
    } finally {
      setTestingProvider(null);
    }
  }, []);

  const handleDialogTestConnection = useCallback(async () => {
    if (!activeProvider?.id || !activeProvider?.baseUrl) {
      setDialogTestResult({ success: false, message: "Provider type and Base URL are required to test." });
      return;
    }
    if (!activeProvider.baseUrl.match(/^https?:\/\/.+/)) {
      setDialogTestResult({ success: false, message: "Base URL must start with http:// or https://" });
      return;
    }
    setTestingDialog(true);
    setDialogTestResult(null);
    try {
      // Route through IPC in Electron mode for reliability (only for EXISTING providers
      // with stored credentials; new providers need HTTP to pass API key in body)
      if (isElectron() && !isNew) {
        const res = await testProviderConnection(activeProvider.id);
        setDialogTestResult({
          success: res.ok,
          message: res.ok ? `Connected (${res.latency}ms)` : (res.error || "Connection failed"),
        });
        if (res.ok) toast.success(`Connected (${res.latency}ms)`);
        else toast.warning(res.error || "Connection failed");
      } else if (isNew) {
        const data = await safeFetchJson("/api/settings/providers/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: activeProvider.baseUrl,
            apiKey: editApiKey || undefined,
            providerId: activeProvider.id,
          }),
        });
        const result = { success: data.success ?? false, message: data.message ?? "Connection test completed.", diagnostics: data.diagnostics ?? null };
        setDialogTestResult(result);
        if (result.success) toast.success(result.message);
        else toast.warning(result.message);
      } else {
        const res = await sendJson<{ success: boolean; message: string; diagnostics?: any }>(
          `/api/settings/providers/${activeProvider.id}/test`,
          "POST"
        );
        setDialogTestResult({ success: res.success, message: res.message });
        if (res.success) toast.success(res.message);
        else toast.warning(res.message);
      }
    } catch (err: any) {
      const msg = err?.message || "Connection test failed.";
      setDialogTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingDialog(false);
    }
  }, [activeProvider, isNew, editApiKey]);

  const handleDiscoverModels = useCallback(async () => {
    toast.success("Refreshing model registry...");
    const enabledProviders = useProviderStore.getState().providers.filter((p) => p.enabled);
    for (const p of enabledProviders) {
      try {
        await fetch(`/api/settings/providers/${p.id}/discover-models`, { method: "POST" });
      } catch { /* best-effort per provider */ }
    }
    await useModelRegistry.getState().refresh();
    useModelRegistry.getState().deriveActiveModels();
    useRoleStore.getState().reconcileAssignments();
    const active = useModelRegistry.getState().activeModels.length;
    const avail = useModelRegistry.getState().availableModels.length;
    toast.success(`Registry updated: ${active} active models (${avail} discovered)`);
  }, []);

  const handleDetectLocal = useCallback(async () => {
    setLocalDetecting(true);
    try {
      const { detectLocalProviders } = await import("@/lib/runtime/provider-detection");
      const found = await detectLocalProviders();
      const existingProviders = useProviderStore.getState().providers;
      for (const local of found) {
        const exists = existingProviders.find((p) => p.id === local.id);
        if (!exists) {
          await sendJson("/api/settings/providers", "POST", {
            provider: local.id,
            label: local.name,
            baseUrl: local.baseUrl,
            enabled: true,
          });
          await useProviderStore.getState().hydrate();
        }
      }
      if (found.length === 0) toast.info("No local providers detected.");
      else {
        toast.success(`Detected ${found.length} local provider(s)`);
        await useModelRegistry.getState().refresh();
        useModelRegistry.getState().deriveActiveModels();
      }
    } catch {
      toast.error("Detection failed.");
    } finally {
      setLocalDetecting(false);
    }
  }, []);

  const handleSaveRole = useCallback(async (role: string, modelId: string) => {
    if (!modelId) return;
    const model = useModelRegistry.getState().getModel(modelId);
    if (!model) return;
    // modelId is already a prefixed ID (e.g. "nvidia:meta/llama-3.1-70b-instruct")
    // Store the model name (without provider prefix) paired with providerId
    const modelName = model.name;
    useRoleStore.getState().setAssignment(role, modelName, model.providerId, false);
    try {
      const currentAssignments = useRoleStore.getState().assignments;
      const rolesPayload: Record<string, string> = {};
      for (const a of currentAssignments) {
        // Reconstruct as "providerId:modelName" (modelName has no prefix after hydration)
        rolesPayload[a.role] = `${a.providerId}:${a.modelId}`;
      }
      // modelName is just the name (e.g. "meta/llama-3.1-70b-instruct") — no double prefix
      rolesPayload[role] = `${model.providerId}:${modelName}`;
      await sendJson("/api/settings/roles", "POST", { roles: rolesPayload });
      toast.success(`Role ${role} mapped to ${model.label}`);
    } catch {
      toast.error("Failed to save role assignment.");
    }
  }, []);

  const handleAutoRoute = useCallback(async (role: string, autoRoute: boolean) => {
    const current = useRoleStore.getState().getAssignment(role);
    if (current) {
      useRoleStore.getState().setAssignment(role, current.modelId, current.providerId, autoRoute);
    } else {
      useRoleStore.getState().setAssignment(role, "", "", autoRoute);
    }
    if (autoRoute) {
      try {
        const currentAssignments = useRoleStore.getState().assignments;
        const remaining = currentAssignments.filter((a) => a.role !== role);
        const rolesPayload: Record<string, string> = {};
        for (const a of remaining) {
          rolesPayload[a.role] = `${a.providerId}:${a.modelId}`;
        }
        await sendJson("/api/settings/roles", "POST", { roles: rolesPayload });
      } catch {
      }
    }
  }, []);

  return {
    dbConnected, activeProvider, isNew, editApiKey, showApiKey, saving,
    searchQuery, localDetecting, testingProvider, testingDialog, dialogTestResult,
    modelPickerOpen, discoveredModels, discoveringModels, discoveryError,
    discoveryStatus, modelsSource, modelsFetchedAt,
    setActiveProvider, setIsNew, setEditApiKey, setShowApiKey, setSaving,
    setSearchQuery, setLocalDetecting, setTestingProvider, setTestingDialog,
    setDialogTestResult, setModelPickerOpen, setDiscoveredModels,
    setDiscoveringModels, setDiscoveryError, setDiscoveryStatus, setModelsSource,
    setModelsFetchedAt,
    handleAddClick, handleEditClick, handleSaveProvider, handleDeleteProvider,
    handleToggleProvider, handleTestConnection, handleDialogTestConnection,
    handleDiscoverModels, handleDetectLocal, handleSaveRole, handleAutoRoute,
    triggerModelDiscovery, resetDialog,
  };
}
