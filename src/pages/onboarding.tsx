import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@agentic-os/ui"
import { Card, CardContent } from "@agentic-os/ui"
import { useAppStore } from "@/stores/app-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  Rocket, FolderOpen, Cpu, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Sparkles, Server, AppWindow,
  AlertTriangle,
} from "lucide-react"

interface StepProps {
  title: string
  description: string
  icon: typeof Rocket
}

const steps: StepProps[] = [
  {
    title: "Welcome to AgenticOS",
    description: "Your AI operating system for development. Let's get you set up in just a few steps.",
    icon: Rocket,
  },
  {
    title: "Choose Workspace",
    description: "Select a folder where your projects and workspace data will be stored.",
    icon: FolderOpen,
  },
  {
    title: "Configure AI Provider",
    description: "Connect an AI provider to power your agent workforce. You can use OpenAI, Anthropic, or a local runtime.",
    icon: Cpu,
  },
  {
    title: "System Check",
    description: "We'll verify your setup and make sure everything is ready to go.",
    icon: Server,
  },
  {
    title: "Ready to Go",
    description: "All set! You can now start building with your AI operating system.",
    icon: Sparkles,
  },
]

interface OnboardingPageProps {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [workspace, setWorkspace] = useState("")
  const [providerType, setProviderType] = useState<"openai" | "anthropic" | "local" | null>(null)
  const [checking, setChecking] = useState(false)
  const [checks, setChecks] = useState<{ label: string; status: "pending" | "pass" | "fail" }[]>([])

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

  const handleSystemCheck = async () => {
    setChecking(true)
    const items = [
      { label: "Workspace directory access", status: "pending" as const },
      { label: "AI provider connectivity", status: "pending" as const },
      { label: "System resources", status: "pending" as const },
      { label: "File system permissions", status: "pending" as const },
      { label: "Network connectivity", status: "pending" as const },
    ]
    setChecks(items)

    for (let i = 0; i < items.length; i++) {
      await new Promise((r) => setTimeout(r, 500))
      setChecks((prev) =>
        prev.map((c, j) => (j === i ? { ...c, status: "pass" as const } : c)),
      )
    }
    setChecking(false)
  }

  const handleNext = async () => {
    if (currentStep === 3) {
      await handleSystemCheck()
    }
    if (currentStep === steps.length - 1) {
      if (workspace) {
        useWorkspaceStore.getState().setRootPath(workspace)
      }
      if (providerType) {
        const providerConfigs: Record<string, { name: string; baseUrl: string }> = {
          openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
          anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
          local: { name: "Local Runtime", baseUrl: "http://localhost:11434/v1" },
        }
        const cfg = providerConfigs[providerType]
        useAppStore.getState().addProvider({
          id: providerType,
          name: cfg.name,
          baseUrl: cfg.baseUrl,
          apiKey: "",
          runtime: providerType === "local" ? "ollama" : null,
          isLocal: providerType === "local",
          isOpenAiCompatible: true,
          models: [],
          createdAt: new Date().toISOString(),
        })
      }
      onComplete()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

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
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i <= currentStep ? "bg-blue-500" : "bg-white/10"
                  }`}
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

            {/* Step-specific content */}
            {currentStep === 1 && (
              <Card className="border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <button
                      onClick={handleSelectWorkspace}
                      className="w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-white/10 p-6 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                    >
                      <FolderOpen className="h-8 w-8 text-white/40" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white/70">Choose Workspace Folder</p>
                        <p className="text-xs text-white/40">
                          {workspace || "Click to select a folder..."}
                        </p>
                      </div>
                    </button>
                    {workspace && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Workspace set to {workspace}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "openai" as const, label: "OpenAI", desc: "GPT-4, GPT-3.5", icon: Cpu },
                  { id: "anthropic" as const, label: "Anthropic", desc: "Claude 3, Claude 3.5", icon: AppWindow },
                  { id: "local" as const, label: "Local Runtime", desc: "Ollama, LM Studio, vLLM", icon: Server },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProviderType(p.id)}
                    className={`flex items-center gap-4 rounded-xl border p-4 transition-all backdrop-blur-xl ${
                      providerType === p.id
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p.icon className="h-6 w-6 text-white/50" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white/70">{p.label}</p>
                      <p className="text-xs text-white/40">{p.desc}</p>
                    </div>
                    {providerType === p.id && (
                      <CheckCircle2 className="h-5 w-5 text-blue-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                {checks.length === 0
                  ? [
                    { label: "Workspace directory access", status: "pending" },
                    { label: "AI provider connectivity", status: "pending" },
                    { label: "System resources", status: "pending" },
                    { label: "File system permissions", status: "pending" },
                    { label: "Network connectivity", status: "pending" },
                  ].map((check, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                    >
                      <Loader2 className="h-4 w-4 text-white/30 animate-spin" />
                      <span className="text-sm text-white/40">{check.label}</span>
                    </div>
                  ))
                  : checks.map((check, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        check.status === "pass"
                          ? "border-green-500/20 bg-green-500/5"
                          : check.status === "fail"
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      {check.status === "pass" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : check.status === "fail" ? (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-white/30 animate-spin" />
                      )}
                      <span className={`text-sm ${
                        check.status === "pass"
                          ? "text-green-400"
                          : check.status === "fail"
                            ? "text-red-400"
                            : "text-white/40"
                      }`}>
                        {check.label}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                  <Sparkles className="h-12 w-12 text-green-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-white">Everything looks great!</p>
                  <p className="text-sm text-white/40">
                    Your AI operating system is ready. You can always change these settings later.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 disabled:opacity-30 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <Button onClick={handleNext} disabled={currentStep === 1 && !workspace}>
                {currentStep === steps.length - 1 ? (
                  <>Get Started <Rocket className="ml-2 h-4 w-4" /></>
                ) : (
                  <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}