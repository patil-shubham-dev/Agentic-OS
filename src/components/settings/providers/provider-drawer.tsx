import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/app-store"
import { cancelPendingValidation, cancelPendingDiscovery, testConnection } from "@agentic-os/providers"
import { safeDetectRuntime, safeValidateProvider, safeDiscoverModels, resolveAdapter, runFullValidation } from "@agentic-os/providers"
import { getHealth, getProviderDiagnostics, getHealthInfo, PROVIDER_HEALTH_META } from "@agentic-os/providers"
import type { GatewayProvider, ProviderModel, RuntimeInfo } from "@/types"
import {
  X, Eye, EyeOff, ChevronLeft, Brain, Code2, Image, Zap, RefreshCw, Globe, Search, Check, Star, Terminal, Shield, Server, Radio, Activity, Clock, BarChart3, ChevronDown, ChevronRight, Wifi, WifiOff, AlertTriangle, Settings2, Bug, Gauge, BookOpen, Box, Sliders, Copy, ExternalLink, List, Cpu, Loader2, Network, Timer,
} from "lucide-react"
import { PresetGrid, type Preset } from "./preset-grid"
import { ValidationStatus } from "./validation-status"
import { ModelSelector } from "./model-selector"
import { DiagnosticsConsole } from "./diagnostics-console"

interface ProviderDrawerProps {
  open: boolean
  onClose: (saved?: boolean) => void
  editProvider: GatewayProvider | null
}

const VALIDATION_DEBOUNCE_MS = 800
const MIN_API_KEY_LENGTH = 4

type ValidationState = "idle" | "validating" | "connected" | "failed" | "timeout"
type DiscoveryState = "idle" | "fetching" | "loaded" | "failed" | "timeout"

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

const SECTION_HEADER = "flex items-center gap-2 mb-3"
const SECTION_LABEL = "text-[9px] text-white/30 font-medium uppercase tracking-wider"
const INPUT_CLASS = "w-full h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 transition-all"
const LABEL_CLASS = "text-[11px] text-white/50 font-medium"

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

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>("general")

  const urlRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)
  const validationVersion = useRef(0)

  const isEditing = !!editProvider

  const filteredSuggestions = useMemo(() => {
    if (!baseUrl) return SUGGESTED_ENDPOINTS
    const q = baseUrl.toLowerCase()
    return SUGGESTED_ENDPOINTS.filter(
      (s) => s.url.toLowerCase().includes(q) || s.label.toLowerCase().includes(q),
    )
  }, [baseUrl])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        urlRef.current && !urlRef.current.contains(e.target as Node)
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
      setDiagnosticsOpen(false)
      setActiveSection("general")
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
      if (mountedRef.current && version === validationVersion.current) setRuntimeInfo(r)
    }).catch(() => {
      if (mountedRef.current && version === validationVersion.current) setRuntimeInfo(null)
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
        success: false, runtime: null, latencyMs: 0,
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
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
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
    if (!name) setName(suggestion.label)
    setShowSuggestions(false)
    setTimeout(() => urlRef.current?.focus(), 50)
  }

  function handleRefreshModels() {
    if (!baseUrl || !apiKey) return
    const version = ++validationVersion.current
    setDiscoveryState("fetching")
    setModelError(null)
    safeDiscoverModels(baseUrl, apiKey).then((r) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      if (r.success) { setAvailableModels(r.models); setDiscoveryState("loaded") }
      else { setDiscoveryState("failed"); setModelError(r.error || "No models returned") }
    }).catch((err) => {
      if (!mountedRef.current || version !== validationVersion.current) return
      setDiscoveryState("failed")
      setModelError(err?.message || "Discovery failed")
    })
  }

  function handleRetryValidation() { runValidation(baseUrl, apiKey) }

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
    } finally { setRawTesting(false) }
  }

  function handleSave() {
    const models = availableModels.filter((m) => selectedModels.includes(m.id))
    const runtime = runtimeInfo?.runtime ?? null
    const adapter = resolveAdapter(baseUrl)

    function generateId(): string {
      return editProvider?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }

    const provider: GatewayProvider = {
      id: generateId(),
      name,
      baseUrl,
      apiKey,
      runtime,
      isLocal: runtimeInfo?.isLocal ?? adapter?.isLocal ?? false,
      isOpenAiCompatible: runtimeInfo?.isOpenAiCompatible ?? adapter?.isOpenAiCompatible ?? true,
      models,
      createdAt: editProvider?.createdAt ?? new Date().toISOString(),
    }
    if (isEditing) updateProvider(editProvider!.id, provider)
    else addProvider(provider)
    onClose(true)
  }

  const isValidated = validationState === "connected" && validationResult?.success
  const canSave = name.length > 0 && baseUrl.length > 0 && (isEditing || isValidated)
  const canSaveWithWarning = name.length > 0 && baseUrl.length > 0 && !isEditing && !isValidated && validationState !== "idle"
  const hasCapabilities = availableModels.length > 0
  const isTimeout = validationState === "timeout"

  const providerIcon = runtimeInfo?.runtime
    ? runtimeInfo.runtime[0]
    : baseUrl.includes("openai.com") ? "O"
    : baseUrl.includes("anthropic.com") ? "A"
    : baseUrl.includes("nvidia.com") ? "N"
    : baseUrl.includes("11434") ? "O"
    : name[0] || "P"

  const healthInfo = editProvider ? getHealthInfo(editProvider.baseUrl, editProvider.id) : null
  const healthMeta = healthInfo ? (PROVIDER_HEALTH_META[healthInfo.state] ?? PROVIDER_HEALTH_META.unknown) : null
  const diagnostics = editProvider ? getProviderDiagnostics(editProvider.baseUrl) : null

  function toggleSection(id: string) {
    setActiveSection(activeSection === id ? null : id)
  }

  function Section({ id, label, icon: Icon, children }: { id: string; label: string; icon: React.ElementType; children: React.ReactNode }) {
    const isOpen = activeSection === id
    return (
      <div className="border border-white/5 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-all"
        >
          <Icon className="h-3 w-3 text-white/30" />
          <span className="text-[10px] text-white/50 font-medium flex-1">{label}</span>
          {isOpen ? <ChevronDown className="h-3 w-3 text-white/20" /> : <ChevronRight className="h-3 w-3 text-white/20" />}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

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
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5 shrink-0">
              {step === "configure" && (
                <button onClick={() => setStep("choose")} className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-all">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-white">
                  {isEditing ? "Edit Provider" : step === "choose" ? "Add Provider" : name || "Configure Provider"}
                </h2>
                <p className="text-[10px] text-white/30">
                  {step === "choose" ? "Select a provider template" : isEditing ? "Manage provider configuration" : "Enter your provider details"}
                </p>
              </div>
              {isEditing && (
                <button
                  onClick={() => setDiagnosticsOpen(true)}
                  className="rounded-lg p-1.5 text-cyan-400/50 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                  title="Diagnostics console"
                >
                  <Bug className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => onClose()} className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {step === "choose" && <PresetGrid onSelect={handlePresetSelect} selectedId={null} />}

              {step === "configure" && (
                <div className="space-y-3 max-w-md">
                  {/* Provider avatar + name header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "flex items-center justify-center h-12 w-12 rounded-xl border shrink-0",
                      validationState === "connected" ? "border-green-500/20 bg-gradient-to-br from-green-500/20 to-emerald-500/10" :
                      validationState === "failed" || isTimeout ? "border-red-500/20 bg-gradient-to-br from-red-500/20 to-rose-500/10" :
                      "border-white/10 bg-gradient-to-br from-blue-500/20 to-purple-500/10",
                    )}>
                      <span className="text-xl font-bold text-white/80">{providerIcon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{name || "Unnamed Provider"}</p>
                      <p className="text-[10px] text-white/30 font-mono truncate max-w-[300px]">{baseUrl || "No endpoint set"}</p>
                    </div>
                  </div>

                  {/* ── Section: General ── */}
                  <Section id="general" label="General" icon={Settings2}>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <label className={LABEL_CLASS}>Provider Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Provider" className={INPUT_CLASS} />
                      </div>
                      <div className="space-y-1 relative">
                        <label className={LABEL_CLASS}>Endpoint URL</label>
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
                        {runtimeInfo && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {runtimeInfo.runtime ? (
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium",
                                runtimeInfo.isLocal ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                              )}>
                                <Server className="h-2.5 w-2.5" />{runtimeInfo.runtime}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-white/[0.05] text-white/30 border border-white/10">
                                <Server className="h-2.5 w-2.5" />Unknown runtime
                              </span>
                            )}
                            {runtimeInfo.isOpenAiCompatible && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <Activity className="h-2.5 w-2.5" />OpenAI-compatible
                              </span>
                            )}
                            {runtimeInfo.isLocal && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <WifiOff className="h-2.5 w-2.5" />Local
                              </span>
                            )}
                          </div>
                        )}
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
                                <div className="px-3 py-1.5 text-[9px] text-white/30 font-medium uppercase tracking-wider border-b border-white/5">
                                  <Search className="h-3 w-3 inline mr-1" /> Suggested endpoints
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                  {filteredSuggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.url}
                                      onClick={() => handleSuggestionSelect(suggestion)}
                                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.03] transition-all"
                                    >
                                      <div className="flex items-center justify-center h-6 w-6 rounded-lg border border-white/5 bg-white/[0.03] shrink-0">
                                        <Globe className="h-3 w-3 text-white/30" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs text-white/70 font-medium truncate">{suggestion.label}</span>
                                          {suggestion.popular && <Star className="h-2.5 w-2.5 text-amber-400/60 fill-amber-400/20 shrink-0" />}
                                        </div>
                                        <p className="text-[10px] text-white/30 font-mono truncate">{suggestion.url}</p>
                                      </div>
                                      {baseUrl === suggestion.url && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </Section>

                  {/* ── Section: Authentication ── */}
                  <Section id="auth" label="Authentication" icon={Shield}>
                    <div className="space-y-2">
                      <label className={LABEL_CLASS}>API Key</label>
                      <div className="relative">
                        <input
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          type={showKey ? "text" : "password"}
                          placeholder={runtimeInfo?.isLocal ? "Optional for local providers" : "sk-..."}
                          className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 pr-9 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 transition-all font-mono"
                          autoComplete="off" spellCheck={false}
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
                      <ValidationStatus state={validationState} result={validationResult} onRetry={handleRetryValidation} />
                    </div>
                  </Section>

                  {/* ── Section: Models ── */}
                  <Section id="models" label="Models" icon={Brain}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className={LABEL_CLASS}>Available Models</label>
                        {validationState === "connected" && discoveryState === "idle" && (
                          <button onClick={handleRefreshModels} className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-1">
                            <RefreshCw className="h-2.5 w-2.5" /> Discover models
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
                          <Check className="h-2.5 w-2.5 inline mr-0.5" />
                          {availableModels.length} model{availableModels.length !== 1 ? "s" : ""} discovered
                        </p>
                      )}
                    </div>
                  </Section>

                  {/* ── Section: Compatibility ── */}
                  {hasCapabilities && (
                    <Section id="compat" label="Compatibility" icon={Radio}>
                      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {availableModels.some((m) => m.supportsStreaming) && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Radio className="h-2.5 w-2.5" />Streaming
                            </span>
                          )}
                          {availableModels.some((m) => m.supportsTools) && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              <Code2 className="h-2.5 w-2.5" />Tool Calling
                            </span>
                          )}
                          {availableModels.some((m) => m.supportsVision) && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Image className="h-2.5 w-2.5" />Vision
                            </span>
                          )}
                          {availableModels.some((m) => m.contextWindow && m.contextWindow > 100000) && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <BookOpen className="h-2.5 w-2.5" />Large Context
                            </span>
                          )}
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* ── Section: Diagnostics ── */}
                  {isEditing && (
                    <Section id="diag" label="Diagnostics" icon={Bug}>
                      <div className="space-y-2">
                        {/* Live health status */}
                        {healthInfo && healthMeta && (
                          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-white/50">Health State</span>
                              <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", healthMeta.color)}>
                                <span className={cn("h-2 w-2 rounded-full", healthMeta.dot)} />
                                {healthMeta.label}
                              </span>
                            </div>
                            {diagnostics && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-white/50">Latency</span>
                                  <span className="text-[10px] text-white/70 font-mono">{diagnostics.avgLatencyMs}ms avg</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-white/50">Uptime</span>
                                  <span className="text-[10px] text-white/70 font-mono">{diagnostics.uptimePercent}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-white/50">Failures</span>
                                  <span className="text-[10px] text-red-400/70 font-mono">{diagnostics.failureCount}</span>
                                </div>
                                {diagnostics.lastError && (
                                  <div className="flex items-start gap-2 mt-1 pt-2 border-t border-white/5">
                                    <AlertTriangle className="h-3 w-3 text-red-400/60 mt-0.5 shrink-0" />
                                    <p className="text-[9px] text-red-400/70 break-all">{diagnostics.lastError}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Raw connection test */}
                        <button
                          onClick={handleRawConnectionTest}
                          disabled={rawTesting || !baseUrl}
                          className="w-full h-8 text-[10px] rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          {rawTesting ? <><RefreshCw className="h-3 w-3 animate-spin" /> Testing connection...</> : <><Zap className="h-3 w-3" /> Test Raw Connection</>}
                        </button>
                        {rawTestResult && (
                          <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Terminal className="h-2.5 w-2.5 text-blue-400/60" />
                              <span className="text-[9px] text-blue-400/60 font-medium uppercase tracking-wider">Raw Response</span>
                            </div>
                            <pre className="text-[9px] text-white/40 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{rawTestResult}</pre>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {/* Validation error */}
                  {(validationState === "failed" || isTimeout) && validationResult && (
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-400/60" />
                        <p className="text-[9px] text-amber-400/60 font-medium uppercase tracking-wider">Validation Failed</p>
                      </div>
                      <div className="space-y-1 text-[10px] text-amber-300/60">
                        <p className="font-mono">Latency: <span className="text-amber-200/80">{validationResult.latencyMs}ms</span></p>
                        {runtimeInfo?.runtime && <p className="font-mono">Detected: <span className="text-amber-200/80">{runtimeInfo.runtime}</span></p>}
                        {validationResult.error && <p className="text-red-400/70 mt-1 text-[9px]">{validationResult.error}</p>}
                      </div>
                      {isTimeout && <p className="text-[9px] text-amber-400/40 mt-1">Endpoint did not respond in time — check URL and network connectivity</p>}
                    </div>
                  )}

                  {/* Successful validation */}
                  {validationState === "connected" && validationResult?.success && (
                    <div className="rounded-xl bg-green-500/5 border border-green-500/10 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Check className="h-3 w-3 text-green-400" />
                        <p className="text-[9px] text-green-400/60 font-medium uppercase tracking-wider">Connected</p>
                      </div>
                      <p className="text-[10px] text-green-400/60 font-mono">{validationResult.latencyMs}ms response time</p>
                      {runtimeInfo?.runtime && <p className="text-[10px] text-green-400/40">Runtime: {runtimeInfo.runtime}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {step === "configure" && (
              <div className="flex items-center gap-3 px-5 py-4 border-t border-white/5 shrink-0">
                <button onClick={() => onClose()} className="flex-1 h-9 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave && !canSaveWithWarning}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all",
                    canSave ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-600/20" :
                    canSaveWithWarning ? "bg-amber-500/10 border border-amber-500/30 text-amber-400/60" :
                    "bg-white/[0.03] text-white/20 border border-white/5 cursor-not-allowed",
                  )}
                  title={canSaveWithWarning ? "Connection not verified — save anyway?" : ""}
                >
                  {isEditing ? "Save Changes" : !isValidated && validationState !== "idle" ? "Save Anyway (Unverified)" : "Add Provider"}
                </button>
              </div>
            )}
          </motion.div>

          {editProvider && (
            <DiagnosticsConsole open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} provider={editProvider} />
          )}
        </>
      )}
    </AnimatePresence>
  )
}
