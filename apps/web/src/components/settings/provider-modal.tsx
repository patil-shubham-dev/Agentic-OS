import { useState, useEffect, useRef, memo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Cpu,
  Save,
  Settings,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Server,
  Globe,
  Eye,
  EyeOff,
  Wifi,
  RefreshCw,
  ChevronDown,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UniversalProviderConfig, NormalizedModel } from "@/lib/runtime/types";
import { ModelSelector } from "./model-selector";

const GATEWAY_TYPES = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", icon: <Cpu className="w-4 h-4" /> },
  { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", icon: <Cpu className="w-4 h-4" /> },
  { id: "google", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", icon: <Globe className="w-4 h-4" /> },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", icon: <Cpu className="w-4 h-4 text-emerald-400" /> },
  { id: "nvidia", name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", icon: <Cpu className="w-4 h-4 text-green-400" /> },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", icon: <Cpu className="w-4 h-4 text-blue-400" /> },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", icon: <Cpu className="w-4 h-4" /> },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", icon: <Cpu className="w-4 h-4" /> },
  { id: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434/v1", icon: <Server className="w-4 h-4" /> },
  { id: "lmstudio", name: "LM Studio (Local)", baseUrl: "http://localhost:1234/v1", icon: <Server className="w-4 h-4" /> },
];

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Reusable locally-controlled input with debounced sync ──────────────────

interface DebouncedInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: (val: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  debounceMs?: number;
}

function DebouncedInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  type = "text",
  debounceMs = 300,
}: DebouncedInputProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onChangeRef.current = onChange;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeRef.current(val);
    }, debounceMs);
  }, [debounceMs]);

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeRef.current(local);
    onBlur?.(local);
  }, [local, onBlur]);

  return (
    <Input
      id={id}
      className={className}
      type={type}
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
}

interface ApiKeyInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  isNew: boolean;
}

function ApiKeyInput({ id, value, onChange, showPassword, onToggleVisibility, isNew }: ApiKeyInputProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onChangeRef.current = onChange;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current(val), 300);
  }, []);

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeRef.current(local);
  }, [local]);

  return (
    <div className="relative">
      <Input
        id={id}
        className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 text-xs pr-10 agentos-focus-ring placeholder:[--text-disabled] font-mono"
        type={showPassword ? "text" : "password"}
        value={local}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={isNew ? "sk-..." : "Leave blank to keep current key"}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--text-primary] transition-colors"
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Props interface ────────────────────────────────────────────────────────

interface ProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProvider: Partial<UniversalProviderConfig> | null;
  isNew: boolean;
  editApiKey: string;
  showApiKey: boolean;
  saving: boolean;
  testingDialog: boolean;
  dialogTestResult: { success: boolean; message: string } | null;
  modelPickerOpen: boolean;
  discoveredModels: NormalizedModel[];
  discoveringModels: boolean;
  discoveryError: string | null;
  discoveryStatus: "idle" | "loading" | "success" | "error";
  modelsSource: "cache" | "fresh" | null;
  modelsFetchedAt: number | null;
  onProviderTypeChange: (val: string) => void;
  onNameChange: (name: string) => void;
  onBaseUrlChange: (url: string) => void;
  onBaseUrlBlur: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onShowApiKeyToggle: () => void;
  onSelectedModelSelect: (modelId: string) => void;
  onModelPickerToggle: () => void;
  onTestConnection: () => void;
  onSave: () => void;
  onTriggerDiscovery: () => void;
  onCloseDialogResult: () => void;
}

// ── Modal component ────────────────────────────────────────────────────────

export const ProviderModal = memo(function ProviderModal({
  open,
  onOpenChange,
  activeProvider,
  isNew,
  editApiKey,
  showApiKey,
  saving,
  testingDialog,
  dialogTestResult,
  modelPickerOpen,
  discoveredModels,
  discoveringModels,
  discoveryError,
  discoveryStatus,
  modelsSource,
  modelsFetchedAt,
  onProviderTypeChange,
  onNameChange,
  onBaseUrlChange,
  onBaseUrlBlur,
  onApiKeyChange,
  onShowApiKeyToggle,
  onSelectedModelSelect,
  onModelPickerToggle,
  onTestConnection,
  onSave,
  onTriggerDiscovery,
  onCloseDialogResult,
}: ProviderModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] agentos-glass-elevated rounded-2xl p-0 overflow-hidden border-[--border-primary] max-h-[85vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-[--border-primary] shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[--text-primary] flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center shadow-sm">
                {isNew ? (
                  <Plus className="w-4 h-4 text-[--accent-primary]" />
                ) : (
                  <Settings className="w-4 h-4 text-[--accent-primary]" />
                )}
              </span>
              <div>
                {isNew ? "Add Provider" : `Configure ${activeProvider?.name}`}
                <DialogDescription className="text-xs text-[--text-muted] mt-0.5 font-normal">
                  Connect a model provider. API keys are encrypted at rest.
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {activeProvider && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gateway-type" className="text-xs font-medium text-[--text-secondary]">
                    Gateway Type
                  </Label>
                  {isNew ? (
                    <Select
                      value={activeProvider.id}
                      onValueChange={onProviderTypeChange}
                    >
                      <SelectTrigger id="gateway-type" className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 text-xs agentos-focus-ring">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="agentos-glass-elevated min-w-[200px]">
                        {GATEWAY_TYPES.map((g) => (
                          <SelectItem
                            key={g.id}
                            value={g.id}
                            className="text-xs text-[--text-primary] focus:bg-[--bg-elevated] py-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-md bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center shrink-0">
                                {g.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-[--text-primary]">
                                  {g.name}
                                </span>
                                <span className="text-[9px] text-[--text-muted]">
                                  {g.baseUrl}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                        <div className="h-px bg-[--border-primary] mx-2 my-1" />
                        <SelectItem
                          value="custom"
                          className="text-xs text-[--text-primary] focus:bg-[--bg-elevated] py-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center shrink-0">
                              <Server className="w-3 h-3 text-[--accent-primary]" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-[--text-primary]">
                                Custom API Provider
                              </span>
                              <span className="text-[9px] text-[--text-muted]">
                                OpenAI-compatible endpoint
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 px-3 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] flex items-center text-xs text-[--text-primary] gap-2">
                      {GATEWAY_TYPES.find((g) => g.id === activeProvider.id)?.icon || <Server className="w-3.5 h-3.5" />}
                      <span className="font-medium">{activeProvider.id}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="provider-name" className="text-xs font-medium text-[--text-secondary]">
                    Display Name
                  </Label>
                  <DebouncedInput
                    id="provider-name"
                    value={activeProvider.name || ""}
                    onChange={onNameChange}
                    placeholder="My Provider"
                    className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 text-xs agentos-focus-ring placeholder:text-[--text-disabled]"
                  />
                </div>
              </div>

              <div className="h-px bg-[--border-primary]" />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[--text-secondary] uppercase tracking-wider flex items-center gap-2">
                  <Wifi className="w-3 h-3" /> Connection
                </h4>

                <div className="space-y-1.5">
                  <Label htmlFor="base-url" className="text-xs font-medium text-[--text-secondary]">
                    Base URL
                  </Label>
                  <DebouncedInput
                    id="base-url"
                    value={activeProvider.baseUrl || ""}
                    onChange={onBaseUrlChange}
                    onBlur={onBaseUrlBlur}
                    placeholder="https://api.openai.com/v1"
                    className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 text-xs agentos-focus-ring placeholder:text-[--text-disabled] font-mono"
                  />
                  {!activeProvider.baseUrl ? (
                    <p className="text-[10px] text-[--text-muted] flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      Enter the API endpoint URL
                    </p>
                  ) : !activeProvider.baseUrl.startsWith("http") ? (
                    <p className="text-[10px] text-[--accent-primary] flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      URL should start with http:// or https://
                    </p>
                  ) : !activeProvider.baseUrl.match(/^https?:\/\/.+\..+/) ? (
                    <p className="text-[10px] text-[--text-muted] flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      URL may be invalid
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="api-key" className="text-xs font-medium text-[--text-secondary]">
                    API Key
                    <span className="text-[--text-disabled] font-normal ml-1">(optional for local providers)</span>
                  </Label>
                  <ApiKeyInput
                    id="api-key"
                    value={editApiKey}
                    onChange={onApiKeyChange}
                    showPassword={showApiKey}
                    onToggleVisibility={onShowApiKeyToggle}
                    isNew={isNew}
                  />
                </div>
              </div>

              <div className="h-px bg-[--border-primary]" />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[--text-secondary] uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-3 h-3" /> Model Selection
                  <span className="text-[9px] font-normal text-[--accent-primary] bg-[--accent-primary]/10 px-1.5 py-0.5 rounded-md border border-[--accent-primary]/20">
                    One per provider
                  </span>
                </h4>

                <div className="space-y-1.5">
                  <Label htmlFor="selected-model" className="text-xs font-medium text-[--text-secondary]">
                    Select Model
                  </Label>
                  <div className="relative">
                    <button
                      id="selected-model"
                      type="button"
                      onClick={onModelPickerToggle}
                      className="w-full h-10 px-3 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-between text-xs text-[--text-primary] hover:border-[--border-hover] transition-colors"
                    >
                      <span className={activeProvider.selectedModel ? "font-mono" : "text-[--text-disabled]"}>
                        {activeProvider.selectedModel || "Select a model..."}
                      </span>
                      <div className="flex items-center gap-2">
                        {discoveryStatus === "loading" && (
                          <Loader2 className="w-3 h-3 animate-spin text-[--accent-primary]" />
                        )}
                        {discoveryStatus === "error" && (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                        {discoveryStatus === "success" && discoveredModels.length > 0 && (
                          <span className="text-[9px] text-emerald-400 font-medium">
                            Pick one model
                          </span>
                        )}
                        <ChevronDown className={cn("w-3.5 h-3.5 text-[--text-muted] transition-transform shrink-0", modelPickerOpen && "rotate-180")} />
                      </div>
                    </button>

                    <ModelSelector
                      isOpen={modelPickerOpen}
                      onOpenChange={(open) => {
                        if (!open) onModelPickerToggle();
                      }}
                      selectedModelId={activeProvider.selectedModel || ""}
                      onSelect={onSelectedModelSelect}
                      models={discoveredModels}
                      discoveryStatus={discoveryStatus}
                      discoveryError={discoveryError}
                      providerId={activeProvider.id}
                      onTriggerDiscovery={onTriggerDiscovery}
                    />
                  </div>
                  <p className="text-[10px] text-[--text-muted]">
                    {isNew
                      ? "Pick exactly ONE model for this provider. For multiple models, add another provider card."
                      : "Select exactly ONE model. The selected model is what roles and routing will use."}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {dialogTestResult && (
          <div className={cn(
            "px-6 py-3 flex items-start gap-2.5 text-xs border-t shrink-0",
            dialogTestResult.success
              ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400"
              : "bg-red-950/20 border-red-900/30 text-red-400"
          )}>
            {dialogTestResult.success ? (
              <Wifi className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{dialogTestResult.success ? "Connected" : "Connection Issue"}</p>
              <p className="text-[11px] text-[--text-muted] mt-0.5 break-words">{dialogTestResult.message}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!dialogTestResult.success && (
                <button
                  onClick={onTestConnection}
                  disabled={testingDialog}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white/10 hover:bg-white/20 text-[--text-primary] transition-colors"
                >
                  <RefreshCw className={cn("w-3 h-3", testingDialog && "animate-spin")} />
                  Retry
                </button>
              )}
              <button
                onClick={onCloseDialogResult}
                className="shrink-0 text-[--text-muted] hover:text-[--text-primary] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-[--border-primary] gap-2 shrink-0">
          <div className="flex items-center gap-2 w-full justify-between">
            <Button
              variant="outline"
              size="sm"
              className="border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--text-primary] rounded-lg h-9 text-xs"
              onClick={onTestConnection}
              disabled={testingDialog || !activeProvider?.baseUrl}
            >
              {testingDialog ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
              )}
              {testingDialog ? "Testing..." : "Test Connection"}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--text-primary] rounded-lg h-9 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-9 text-xs font-medium shadow-sm shadow-[--glow-soft] px-5"
                onClick={onSave}
                disabled={saving || !activeProvider?.selectedModel}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" /> {isNew ? "Add Provider" : "Save Changes"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});