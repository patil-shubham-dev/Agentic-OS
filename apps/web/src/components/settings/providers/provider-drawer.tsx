import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/app-store"
import { cancelPendingValidation, cancelPendingDiscovery, testConnection } from "@/lib/provider-gateway"
import { safeDetectRuntime, safeValidateProvider, safeDiscoverModels, resolveAdapter } from "@/lib/provider-manager"
import type { GatewayProvider, ProviderModel, RuntimeInfo } from "@/types"
import { Badge } from "@/components/ui/badge"
import { X, Eye, EyeOff, ChevronLeft, Brain, Code2, Image, Zap, RefreshCw, AlertTriangle, Globe, Search, Check, Star } from "lucide-react"
import { PresetGrid, type Preset } from "./preset-grid"
import { ValidationStatus } from "./validation-status"
import { ModelSelector } from "./model-selector"

interface ProviderDrawerProps {
  open: boolean
  onClose: (saved?: boolean) => void
  editProvider: GatewayProvider | null
}

const VALIDATION_DEBOUNCE_MS = 800
const MIN_API_KEY_LENGTH = 4

type ValidationState = "idle" | "validating" | "connected" | "failed" | "timeout"
type DiscoveryState = "idle" | "fetching" | "loaded" | "failed" | "timeout"

// ── Suggested endpoints for the inline autocomplete dropdown ──

const SUGGESTED_ENDPOINTS: { label: string; url: string; popular: boolean }[] = [
  { label: "OpenAI", url: "https://api.openai.com/v1", popular: true },
  { label: "Anthropic", url: "https://api.anthropic.com", popular: true },
  { label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta", popular: true },
  { label: "Groq", url: "https://api.groq.com/openai/v1", popular: true },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", popular: true },
  { label: "DeepSeek", url: "https://api.deepseek.com/v1", popular: false },
  { label: "Together AI", url: "https://api.together.xyz/v1", popular: false },
  { label: "Nvidia NIM", url: "https://integrate.api.nvidia.com/v1", popular: false },
  { label: "Ollama (local)", url: "http://localhost:11434/v1", popular: true },
  { label: "Azure OpenAI", url: "https://YOUR_RESOURCE.openai.azure.com", popular: false },
  { label: "vLLM (local)", url: "http://localhost:8000/v1", popular: false },
  { label: "LM Studio (local)", url: "http://localhost:1234/v1", popular: false },
  { label: "LocalAI", url: "http://localhost:8080/v1", popular: false },
  { label: "LiteLLM (local)", url: "http://localhost:4000", popular: false },
]

export function ProviderDrawer({ open, onClose, editProvider }: ProviderDrawerProps) {
  const addProvider = useAppStore((s) => s.addProvider)
  const updateProvider = useAppStore((s) => s.updateProvider)

  const [step, setStep] = useState<"choose" | "configure">("choose")
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)

  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<ProviderModel[]>([])
  const [modelError, setModelError] = useState<string | null>(null)

  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [validationResult, setValidationResult] = useState<{ success: boolean; runtime: string | null; latencyMs: number; error: string | null } | null>(null)
  const [validationState, setValidationState] = useState<ValidationState>("idle")
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle")
  const [rawTestResult, setRawTestResult] = useState<string | null>(null)
  const [rawTesting, setRawTesting] = useState(false)

  // ── Suggested endpoints dropdown state ──
  const [showSuggestions, setShowSuggestions] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)
  const validationVersion = useRef(0)

  const isEditing = !!editProvider

  // Filter suggested endpoints based on URL input
  const filteredSuggestions = useMemo(() => {
    if (!baseUrl) return SUGGESTED_ENDPOINTS
    const q = baseUrl.toLowerCase()
    return SUGGESTED_ENDPOINTS.filter(
      (s) => s.url.toLowerCase().includes(q) || s.label.toLowerCase().includes(q),
    )
  }, [baseUrl])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        urlRef.current &&
        !urlRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelPendingValidation()
      cancelPendingDiscovery()
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setStep("choose")
      setName("")
      setBaseUrl("")
      setApiKey("")
      setSelectedModels([])
      setAvailableModels([])
      setRuntimeInfo(null)
      setValidationResult(null)
      setValidationState("idle")
      setDiscoveryState("idle")
      setModelError(null)
      setShowSuggestions(false)
      cancelPendingValidation()
      cancelPendingDiscovery()
      return
    }
    if (editProvider) {
      setName(editProvider.name)
      setBaseUrl(editProvider.baseUrl)
      setApiKey(editProvider.apiKey)
      setSelectedModels(editProvider.models.map((m) => m.id))
      setAvailableModels(editProvider.models)
      setRuntimeInfo({
        runtime: editProvider.runtime,
        isOpenAiCompatible: editProvider.isOpenAiCompatible,
        isLocal: editProvider.isLocal,
      })
      setStep("configure")
    }
  }, [open, editProvider])

  useEffect(() => {
    if (!mountedRef.current || !baseUrl) {
      setRuntimeInfo(null)
      return
    }
    const version = ++validationVersion.current
    safeDetectRuntime(baseUrl).then((r) => {
      if (mountedRef.current && version === validationVersion.current) {
        setRuntimeInfo(r)
      }
    }).catch(() => {
      if (mountedRef.current && version === validationVersion.current) {
        setRuntimeInfo(null)
      }
    })
  }, [baseUrl])

  const runValidation = useCallback((url: string, key: string) => {
    cancelPendingValidation()
    cancelPendingDiscovery()

    if (!url || !key || key.length < MIN_API_KEY_LENGTH) {
      setValidationState("idle")
      setValidationResult(null)
      setDiscoveryState("idle")
      setAvailableModels([])
      setModelError(null)
      return
    }

    const version = ++validationVersion.current
    setValidationState("validating")
    setValidationResult(null)
    setDiscoveryState("idle")
    setAvailableModels([])
    setModelError(null)

    safeValidateProvider(url, key).then((result) => {
      if (!mountedRef.current || version !== validationVersion.current) return

      setValidationResult(result)
      if (result.success) {
        setValidationState("connected")
        startDiscovery(url, key, version)
      } else {
        setValidationState("failed")
        setDiscoveryState("idle")
      }
    }).catch((err) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      const isTimeout = err?.code === "CONNECTION_TIMED_OUT" || err?.message === "TIMEOUT_EXCEEDED"
      setValidationState(isTimeout ? "timeout" : "failed")
      setValidationResult({
        success: false,
        runtime: null,
        latencyMs: 0,
        error: err?.message || "Validation failed",
      })
    })
  }, [])

  function startDiscovery(url: string, key: string, version: number) {
    setDiscoveryState("fetching")
    setModelError(null)

    safeDiscoverModels(url, key).then((result) => {
      if (!mountedRef.current || version !== validationVersion.current) return

      if (result.success) {
        setAvailableModels(result.models)
        setDiscoveryState("loaded")
        setModelError(null)
      } else {
        setAvailableModels([])
        setDiscoveryState("failed")
        setModelError(result.error || "No models returned")
      }
    }).catch((err) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      const isTimeout = err?.code === "CONNECTION_TIMED_OUT" || err?.message === "TIMEOUT_EXCEEDED"
      setDiscoveryState(isTimeout ? "timeout" : "failed")
      setModelError(isTimeout ? "Model discovery timed out" : err?.message || "Discovery failed")
    })
  }

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      runValidation(baseUrl, apiKey)
    }, VALIDATION_DEBOUNCE_MS)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [baseUrl, apiKey, runValidation])

  function handlePresetSelect(preset: Preset) {
    setName(preset.name)
    setBaseUrl(preset.baseUrl)
    setApiKey("")
    setSelectedModels([])
    setAvailableModels([])
    setValidationResult(null)
    setValidationState("idle")
    setDiscoveryState("idle")
    setRuntimeInfo(null)
    setStep("configure")
  }

  function handleSuggestionSelect(suggestion: typeof SUGGESTED_ENDPOINTS[0]) {
    setBaseUrl(suggestion.url)
    // Auto-fill name if not already set
    if (!name) {
      setName(suggestion.label)
    }
    setShowSuggestions(false)
    // Focus the URL input after selection
    setTimeout(() => urlRef.current?.focus(), 50)
  }

  function handleRefreshModels() {
    if (!baseUrl || !apiKey) return
    const version = ++validationVersion.current
    setDiscoveryState("fetching")
    setModelError(null)
    safeDiscoverModels(baseUrl, apiKey).then((r) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      if (r.success) {
        setAvailableModels(r.models)
        setDiscoveryState("loaded")
      } else {
        setDiscoveryState("failed")
        setModelError(r.error || "No models returned")
      }
    }).catch((err) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      setDiscoveryState("failed")
      setModelError(err?.message || "Discovery failed")
    })
  }

  function handleRetryValidation() {
    runValidation(baseUrl, apiKey)
  }

  async function handleRawConnectionTest() {
    if (!baseUrl) return
    setRawTesting(true)
    setRawTestResult(null)
    try {
      const result = await testConnection(baseUrl, apiKey)
      setRawTestResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setRawTestResult(`Invoke failed: ${msg}`)
    } finally {
      setRawTesting(false)
    }
  }

  function handleSave() {
    const models = availableModels.filter((m) => selectedModels.includes(m.id))
    const runtime = runtimeInfo?.runtime ?? null
    const adapter = resolveAdapter(baseUrl)

    const provider: GatewayProvider = {
      id: editProvider?.id || "",
      name,
      baseUrl,
      apiKey,
      runtime,
      isLocal: runtimeInfo?.isLocal ?? adapter?.isLocal ?? false,
      isOpenAiCompatible: runtimeInfo?.isOpenAiCompatible ?? adapter?.isOpenAiCompatible ?? true,
      models,
      createdAt: editProvider?.createdAt ?? new Date().toISOString(),
    }

    if (isEditing) {
      updateProvider(editProvider!.id, provider)
    } else {
      addProvider(provider)
    }
    onClose(true)
  }

  const canSave = name.length > 0 && baseUrl.length > 0
  const hasCapabilities = availableModels.length > 0
  const isTimeout = validationState === "timeout"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => onClose()}
          />

          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg border-l border-white/10 bg-[#0a0a14] shadow-2xl flex flex-col"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5 shrink-0">
              {step === "configure" && (
                <button
                  onClick={() => setStep("choose")}
                  className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-white">
                  {isEditing ? "Edit Provider" : step === "choose" ? "Add Provider" : name || "Configure Provider"}
                </h2>
                <p className="text-[10px] text-white/30">
                  {step === "choose" ? "Select a provider template" : "Enter your provider details"}
                </p>
              </div>
              <button
                onClick={() => onClose()}
                className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {step === "choose" && (
                <PresetGrid onSelect={handlePresetSelect} selectedId={null} />
              )}

              {step === "configure" && (
                <div className="space-y-5 max-w-md">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-medium">Provider Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Provider"
                      className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 transition-all"
                    />
                  </div>

                  {/* ── Base URL with Suggested Endpoints Autocomplete ── */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[11px] text-white/50 font-medium">Base URL</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Globe className="h-3.5 w-3.5 text-white/20" />
                      </div>
                      <input
                        ref={urlRef}
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 transition-all font-mono"
                      />
                    </div>

                    {/* Runtime badges below URL */}
                    {runtimeInfo && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {runtimeInfo.runtime ? (
                          <Badge variant={runtimeInfo.isLocal ? "success" : "info"} size="sm">
                            {runtimeInfo.runtime}
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">Unknown runtime</Badge>
                        )}
                        {runtimeInfo.isOpenAiCompatible && (
                          <Badge variant="info" size="sm">OpenAI-compatible</Badge>
                        )}
                        {runtimeInfo.isLocal && (
                          <Badge variant="success" size="sm">Local</Badge>
                        )}
                      </div>
                    )}

                    {/* Suggested endpoints dropdown */}
                    <AnimatePresence>
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <motion.div
                          ref={suggestionsRef}
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full left-0 right-0 mt-1 z-50"
                        >
                          <div className="rounded-xl border border-white/10 bg-black/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
                            <div className="px-3 py-2 text-[9px] text-white/30 font-medium uppercase tracking-wider border-b border-white/5">
                              <Search className="h-3 w-3 inline mr-1 -mt-0.5" />
                              Suggested endpoints
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {filteredSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.url}
                                  onClick={() => handleSuggestionSelect(suggestion)}
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-all"
                                >
                                  <div className="flex items-center justify-center h-6 w-6 rounded-lg border border-white/5 bg-white/[0.03] shrink-0">
                                    <Globe className="h-3 w-3 text-white/30" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-white/70 font-medium truncate">
                                        {suggestion.label}
                                      </span>
                                      {suggestion.popular && (
                                        <Star className="h-2.5 w-2.5 text-amber-400/60 fill-amber-400/20 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-white/30 font-mono truncate">
                                      {suggestion.url}
                                    </p>
                                  </div>
                                  {baseUrl === suggestion.url && (
                                    <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── API Key with masking ── */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/50 font-medium">API Key</label>
                    <div className="relative">
                      <input
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        type={showKey ? "text" : "password"}
                        placeholder={runtimeInfo?.isLocal ? "Optional for local providers" : "sk-..."}
                        className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 pr-9 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 transition-all font-mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {apiKey.length > 0 && !showKey && apiKey.length > 8 && (
                      <p className="text-[9px] text-white/20 font-mono">
                        Key starts with: {apiKey.slice(0, 4)}•••••{apiKey.slice(-4)}
                      </p>
                    )}
                  </div>

                  <ValidationStatus
                    state={validationState}
                    result={validationResult}
                    onRetry={handleRetryValidation}
                  />

                  <button
                    onClick={handleRawConnectionTest}
                    disabled={rawTesting || !baseUrl}
                    className="w-full h-8 text-[10px] rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {rawTesting ? "Testing raw connection..." : "Test Raw Connection"}
                  </button>
                  {rawTestResult && (
                    <pre className="text-[9px] text-white/40 font-mono whitespace-pre-wrap bg-white/[0.02] rounded-lg border border-white/5 p-2 max-h-48 overflow-auto">
                      {rawTestResult}
                    </pre>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-white/50 font-medium">Models</label>
                      {validationState === "connected" && discoveryState === "idle" && (
                        <button
                          onClick={handleRefreshModels}
                          className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors"
                        >
                          Discover models
                        </button>
                      )}
                    </div>
                    <ModelSelector
                      models={availableModels}
                      selected={selectedModels}
                      onChange={setSelectedModels}
                      loading={discoveryState === "fetching"}
                      onRefresh={handleRefreshModels}
                      error={discoveryState === "failed" || discoveryState === "timeout" ? modelError : null}
                    />
                    {discoveryState === "loaded" && (
                      <p className="text-[9px] text-green-400/40">
                        {availableModels.length} model{availableModels.length !== 1 ? "s" : ""} discovered
                      </p>
                    )}
                  </div>

                  {hasCapabilities && (
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-2">
                      <p className="text-[9px] text-white/30 font-medium uppercase tracking-wider">Capabilities</p>
                      <div className="flex flex-wrap gap-1">
                        {availableModels.some((m) => m.supportsStreaming) && (
                          <Badge variant="info" size="sm"><Zap className="h-2.5 w-2.5 mr-0.5" />Streaming</Badge>
                        )}
                        {availableModels.some((m) => m.supportsTools) && (
                          <Badge variant="success" size="sm"><Code2 className="h-2.5 w-2.5 mr-0.5" />Tool Calling</Badge>
                        )}
                        {availableModels.some((m) => m.supportsVision) && (
                          <Badge variant="purple" size="sm"><Image className="h-2.5 w-2.5 mr-0.5" />Vision</Badge>
                        )}
                        {availableModels.some((m) => m.contextWindow && m.contextWindow > 100000) && (
                          <Badge variant="default" size="sm"><Brain className="h-2.5 w-2.5 mr-0.5" />Large Context</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {(validationState === "failed" || isTimeout) && validationResult && (
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 space-y-1.5">
                      <p className="text-[9px] text-amber-400/60 font-medium uppercase tracking-wider">Diagnostics</p>
                      <div className="space-y-0.5 text-[10px] text-amber-300/60">
                        <p>Latency: {validationResult.latencyMs}ms</p>
                        {runtimeInfo?.runtime && <p>Detected: {runtimeInfo.runtime}</p>}
                        {runtimeInfo?.runtime && !runtimeInfo?.isOpenAiCompatible && (
                          <p>Non-OpenAI provider — may need custom handling</p>
                        )}
                      </div>
                    </div>
                  )}

                  {validationResult?.error?.includes("IPC_BRIDGE_UNAVAILABLE") && (
                    <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <p className="text-[11px] text-red-300/80 font-medium">Backend Not Available</p>
                      </div>
                      <p className="text-[10px] text-red-300/40">
                        The Tauri backend bridge is not initialized. Run the app with <code className="text-red-300/60">tauri dev</code> or <code className="text-red-300/60">tauri build</code> instead of <code className="text-red-300/60">npm run dev</code>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {step === "configure" && (
              <div className="flex items-center gap-3 px-5 py-4 border-t border-white/5 shrink-0">
                <button
                  onClick={() => onClose()}
                  className="flex-1 h-9 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all",
                    canSave
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-600/20"
                      : "bg-white/[0.03] text-white/20 border border-white/5 cursor-not-allowed",
                  )}
                >
                  {isEditing ? "Save Changes" : "Add Provider"}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
