import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@agentic-os/ui"
import { Card, CardContent } from "@agentic-os/ui"
import { useAppStore } from "@/stores/app-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  Rocket, FolderOpen, Cpu, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Sparkles, Server, AppWindow,
  AlertTriangle, Wifi, XCircle, Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingPageProps {
  onComplete: () => void
}

type ProviderChoice = "openai" | "anthropic" | "local" | "ollama"

type OllamaState = "checking" | "found" | "not-found"

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [workspace, setWorkspace] = useState("")
  const [providerChoice, setProviderChoice] = useState<ProviderChoice | null>(null)
  const [ollamaState, setOllamaState] = useState<OllamaState>("checking")
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [setupComplete, setSetupComplete] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupRunning, setSetupRunning] = useState(false)
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    detectOllama()
  }, [])

  useEffect(() => {
    if (ollamaState === "found") {
      setProviderChoice("ollama")
    }
  }, [ollamaState])

  async function detectOllama() {
    try {
      const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json()
        const models = (data.models || []).map((m: any) => m.name)
        setOllamaModels(models)
        setOllamaState("found")
        return
      }
    } catch {}
    setOllamaState("not-found")
  }

  const handleSelectWorkspace = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({ directory: true, multiple: false })
      if (selected) {
        setWorkspace(String(selected))
      }
    } catch {
      setWorkspace("~/agentic-os-workspace")
    }
  }

  async function runSetup() {
    setSetupRunning(true)
    setSetupError(null)

    try {
      const store = useAppStore.getState()

      store.initializeDefaultRoles()

      if (providerChoice) {
        let providerId: string
        let providerName: string
        let baseUrl: string
        let runtime: string | null
        let models: { id: string; name: string; supportsTools: boolean; supportsVision: boolean; supportsStreaming: boolean }[]

        if (providerChoice === "ollama") {
          providerId = "ollama"
          providerName = "Ollama"
          baseUrl = "http://localhost:11434/v1"
          runtime = "ollama"
          models = ollamaModels.length > 0
            ? ollamaModels.map((m) => ({
                id: m,
                name: m,
                supportsTools: true,
                supportsVision: m.includes("llava") || m.includes("vision"),
                supportsStreaming: true,
              }))
            : [{ id: "llama3.2", name: "Llama 3.2", supportsTools: true, supportsVision: false, supportsStreaming: true }]
        } else if (providerChoice === "openai") {
          providerId = "openai"
          providerName = "OpenAI"
          baseUrl = "https://api.openai.com/v1"
          runtime = null
          models = [
            { id: "gpt-4o", name: "GPT-4o", supportsTools: true, supportsVision: true, supportsStreaming: true },
            { id: "gpt-4o-mini", name: "GPT-4o Mini", supportsTools: true, supportsVision: true, supportsStreaming: true },
          ]
        } else if (providerChoice === "anthropic") {
          providerId = "anthropic"
          providerName = "Anthropic"
          baseUrl = "https://api.anthropic.com/v1"
          runtime = null
          models = [
            { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", supportsTools: true, supportsVision: true, supportsStreaming: true },
            { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", supportsTools: true, supportsVision: true, supportsStreaming: true },
          ]
        } else {
          providerId = "local"
          providerName = "Local Runtime"
          baseUrl = "http://localhost:11434/v1"
          runtime = "ollama"
          models = [
            { id: "llama3.2", name: "Llama 3.2", supportsTools: true, supportsVision: false, supportsStreaming: true },
          ]
        }

        store.addProvider({
          id: providerId,
          name: providerName,
          baseUrl,
          apiKey: apiKey || "",
          runtime,
          isLocal: providerChoice === "local" || providerChoice === "ollama",
          isOpenAiCompatible: true,
          models,
          createdAt: new Date().toISOString(),
        })

        const defaultModel = models[0]?.id
        if (defaultModel) {
          const roleConfigs = useAppStore.getState().roleConfigs
          for (const role of roleConfigs) {
            if (role.name.toLowerCase() === "manager" || role.isBuiltIn) {
              store.upsertRoleConfig({
                ...role,
                providerId,
                model: defaultModel,
              })
            }
          }
        }
      }

      if (workspace) {
        const { loadFileTree } = await import("@/lib/workspace")
        const store = useWorkspaceStore.getState()
        await store.setRootPath(workspace)
        store.setLoading(true)
        const tree = await loadFileTree(workspace)
        store.setFileTree(tree)
      }

      setSetupComplete(true)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err))
    } finally {
      setSetupRunning(false)
    }
  }

  const canContinue = (): boolean => {
    if (currentStep === 0) return true
    if (currentStep === 1) {
      if (!providerChoice) return false
      if (providerChoice === "openai" || providerChoice === "anthropic") return apiKey.trim().length > 0
      return true
    }
    if (currentStep === 2) return true
    if (currentStep === 3) return setupComplete
    return true
  }

  const handleNext = async () => {
    if (currentStep === 2) {
      await runSetup()
    }
    if (currentStep === 3 && setupComplete) {
      setSetupRunning(false)
      onComplete()
    } else if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const steps = [
    { title: "Welcome to AgenticOS", description: "Your AI operating system for development.", icon: Rocket },
    { title: "Choose Your AI Provider", description: "Connect an AI provider to power your agent workforce.", icon: Cpu },
    { title: "Setting Up Your System", description: "We'll configure everything automatically.", icon: Server },
    { title: "Ready to Go", description: "All set! Let's start building.", icon: Sparkles },
  ]

  const Step = steps[currentStep]

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-black via-[#050508] to-[#0a0a14]">
      <div className="w-full max-w-2xl px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Progress Bar */}
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-500",
                    i <= currentStep ? "bg-blue-500" : "bg-white/10",
                  )}
                />
              ))}
            </div>

            {/* Step Content */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 backdrop-blur-xl">
                <Step.icon className="h-10 w-10 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{Step.title}</h1>
              <p className="text-sm text-white/40">{Step.description}</p>
            </div>

            {/* Step 0: Welcome + Ollama detection */}
            {currentStep === 0 && (
              <Card className="border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl">
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-white/60 leading-relaxed">
                    AgenticOS gives you an AI-powered development environment with collaborative agent roles, a code workspace, and a visual canvas.
                  </p>
                  <div className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-sm",
                    ollamaState === "found"
                      ? "border-green-500/20 bg-green-500/5 text-green-400"
                      : ollamaState === "checking"
                        ? "border-white/5 bg-white/[0.02] text-white/40"
                        : "border-white/5 bg-white/[0.02] text-white/30",
                  )}>
                    {ollamaState === "found" ? (
                      <><CheckCircle2 className="h-4 w-4 text-green-400" /> Ollama detected — one-click setup available</>
                    ) : ollamaState === "checking" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Checking for local Ollama...</>
                    ) : (
                      <><Wifi className="h-4 w-4" /> No local Ollama detected</>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Provider selection */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 gap-3">
                {ollamaState === "found" && (
                  <button
                    onClick={() => setProviderChoice("ollama")}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border p-4 transition-all backdrop-blur-xl",
                      providerChoice === "ollama"
                        ? "border-green-500/30 bg-green-500/10 ring-1 ring-green-500/20"
                        : "border-green-500/20 bg-green-500/[0.03] hover:border-green-500/40",
                    )}
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10">
                      <Sparkles className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-white flex items-center gap-2">
                        Try with Ollama
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Recommended</span>
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {ollamaModels.length > 0
                          ? `Auto-configure with ${ollamaModels.slice(0, 3).join(", ")}`
                          : "Zero configuration — local AI out of the box"}
                      </p>
                    </div>
                    {providerChoice === "ollama" && <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
                  </button>
                )}
                {[
                  { id: "openai" as const, label: "OpenAI", desc: "GPT-4o, GPT-4o Mini", icon: Cpu },
                  { id: "anthropic" as const, label: "Anthropic", desc: "Claude 3.5 Sonnet, Claude 3.5 Haiku", icon: AppWindow },
                  { id: "local" as const, label: "Local Runtime", desc: "Ollama, LM Studio, vLLM (bring your own)", icon: Server },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProviderChoice(p.id)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border p-4 transition-all backdrop-blur-xl",
                      providerChoice === p.id
                        ? "border-blue-500/30 bg-blue-500/10 ring-1 ring-blue-500/20"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                    )}
                  >
                    <p.icon className="h-6 w-6 text-white/50" />
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-white/70">{p.label}</p>
                      <p className="text-xs text-white/40">{p.desc}</p>
                    </div>
                    {providerChoice === p.id && <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />}
                  </button>
                ))}
                {(providerChoice === "openai" || providerChoice === "anthropic") && (
                  <div className="mt-4 space-y-2">
                    <label className="text-xs text-white/50">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={providerChoice === "openai" ? "sk-..." : "sk-ant-..."}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20"
                    />
                    <p className="text-[10px] text-white/30">Your key is stored locally and never shared.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Setup running */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <Card className="border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl">
                  <CardContent className="p-6 space-y-3">
                    {[
                      { label: "Setting up assistants", done: setupComplete || setupRunning },
                      { label: providerChoice ? `Configuring ${providerChoice === "ollama" ? "Ollama" : providerChoice === "openai" ? "OpenAI" : providerChoice === "anthropic" ? "Anthropic" : "Local"} provider` : "Configuring provider", done: setupComplete || setupRunning },
                      { label: "Setting up manager assistant", done: setupComplete || setupRunning },
                      { label: "Configuring agent assistants", done: setupComplete || setupRunning },
                      { label: setupRunning ? "Setting up workspace..." : "Workspace ready", done: setupComplete },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {item.done && setupComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                        ) : setupRunning ? (
                          <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-white/10 shrink-0" />
                        )}
                        <span className={cn(
                          "text-sm",
                          item.done && setupComplete ? "text-green-400" : setupRunning ? "text-white/60" : "text-white/20",
                        )}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                {setupError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {setupError}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Ready */}
            {currentStep === 3 && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                  <Sparkles className="h-12 w-12 text-green-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-white">Everything is ready!</p>
                  <p className="text-sm text-white/40 max-w-md mx-auto">
                    {providerChoice === "ollama"
                      ? "Ollama is configured and ready. You can start chatting."
                      : providerChoice === "local"
                        ? "Local runtime is configured. You can start chatting."
                        : "Provider configured with API key. You can start chatting."}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { label: providerChoice === "ollama" ? "Ollama" : providerChoice === "openai" ? "OpenAI" : providerChoice === "anthropic" ? "Anthropic" : "Local", icon: Bot, color: "text-blue-400" },
                    { label: "Manager role", icon: Cpu, color: "text-amber-400" },
                    { label: `${useAppStore.getState().roleConfigs.length} agent roles`, icon: Server, color: "text-green-400" },
                  ].map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/5 px-3 py-1 text-[10px] text-white/50">
                      <tag.icon className={cn("h-3 w-3", tag.color)} />
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => {
                  if (currentStep > 0) setCurrentStep(currentStep - 1)
                }}
                disabled={currentStep === 0 || setupRunning}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 disabled:opacity-30 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                {currentStep === 0 && (
                  <button
                    onClick={async () => {
                      localStorage.setItem('opencode-onboarded', 'true')
                      useAppStore.getState().initializeDefaultRoles()
                      setTimeout(() => onComplete(), 100)
                    }}
                    className="text-xs text-red-400/50 hover:text-red-400/80 transition-colors"
                  >
                    Skip onboarding (configure later)
                  </button>
                )}
                <Button onClick={handleNext} disabled={!canContinue() || setupRunning}>
                  {currentStep === 3 ? (
                    <><Rocket className="mr-2 h-4 w-4" /> Start Building</>
                  ) : currentStep === 2 ? (
                    setupRunning ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Configuring...</>
                    ) : (
                      <>{setupComplete ? "Continue" : "Configure Now"} <ArrowRight className="ml-2 h-4 w-4" /></>
                    )
                  ) : (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
