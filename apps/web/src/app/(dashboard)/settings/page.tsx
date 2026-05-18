"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Key,
  Cpu,
  Shield,
  Palette,
  Bell,
  Database,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  HardDrive,
  Lock,
  User,
  Users,
  CreditCard,
  Moon,
  Sun,
  Monitor,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  status: "connected" | "disconnected" | "error";
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
}

const providers: ProviderConfig[] = [
  { id: "openai", name: "OpenAI", icon: "OpenAI", status: "connected", apiKey: "sk-••••••••••••••••••••••••", models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"], defaultModel: "gpt-4o" },
  { id: "anthropic", name: "Anthropic", icon: "Anthropic", status: "connected", apiKey: "sk-ant-••••••••••••••••••••••••", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"], defaultModel: "claude-3-opus" },
  { id: "google", name: "Google AI Studio", icon: "Google", status: "connected", apiKey: "AI••••••••••••••••••••••••", models: ["gemini-pro", "gemini-pro-vision"], defaultModel: "gemini-pro" },
  { id: "openrouter", name: "OpenRouter", icon: "OpenRouter", status: "connected", apiKey: "sk-or-••••••••••••••••••••••••", baseUrl: "https://openrouter.ai/api/v1", models: ["anthropic/claude-3-opus", "openai/gpt-4o", "meta/llama-3.3-70b"], defaultModel: "anthropic/claude-3-opus" },
  { id: "groq", name: "Groq", icon: "Groq", status: "disconnected", models: ["llama-3.3-70b", "mixtral-8x7b", "gemma-7b"], defaultModel: "llama-3.3-70b" },
  { id: "together", name: "Together AI", icon: "Together", status: "disconnected", models: ["llama-3.3-70b", "mixtral-8x22b"], defaultModel: "llama-3.3-70b" },
  { id: "ollama", name: "Ollama", icon: "Ollama", status: "connected", baseUrl: "http://localhost:11434", models: ["llama3.3", "mistral", "codellama"], defaultModel: "llama3.3" },
];

const modelRoles = [
  { role: "Manager", description: "Primary agent that delegates tasks", defaultModel: "Claude 3 Opus", provider: "anthropic" },
  { role: "Coding", description: "Code generation and review", defaultModel: "GPT-4o", provider: "openai" },
  { role: "Design", description: "UI/UX generation", defaultModel: "Gemini Pro", provider: "google" },
  { role: "Research", description: "Web search and analysis", defaultModel: "Claude 3 Opus", provider: "anthropic" },
  { role: "Reasoning", description: "Complex problem solving", defaultModel: "Claude 3 Opus", provider: "anthropic" },
  { role: "Fast Inference", description: "Quick responses and simple tasks", defaultModel: "Llama 3.3 70B", provider: "groq" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("providers");
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);

  const toggleApiKey = (id: string) => {
    setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your AI providers, agents, and workspace preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="providers" className="gap-2">
            <Key className="w-4 h-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Cpu className="w-4 h-4" /> Model Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">AI Providers</h2>
              <p className="text-sm text-muted-foreground">Manage your API keys and model connections</p>
            </div>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Test All
            </Button>
          </div>

          <div className="grid gap-4">
            {providers.map((provider) => (
              <Card key={provider.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">
                        {provider.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{provider.name}</h3>
                          <Badge
                            className={cn(
                              provider.status === "connected" && "bg-green-500/10 text-green-500",
                              provider.status === "disconnected" && "bg-muted text-muted-foreground",
                              provider.status === "error" && "bg-destructive/10 text-destructive"
                            )}
                          >
                            {provider.status === "connected" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {provider.status === "error" && <AlertCircle className="w-3 h-3 mr-1" />}
                            {provider.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {provider.models.length} models available
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setSelectedProvider(provider)}
                      >
                        <Key className="w-3 h-3" /> Configure
                      </Button>
                    </div>
                  </div>

                  {provider.status === "connected" && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">API Key</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type={showApiKey[provider.id] ? "text" : "password"}
                              value={provider.apiKey || ""}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => toggleApiKey(provider.id)}
                            >
                              {showApiKey[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        {provider.baseUrl && (
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Base URL</Label>
                            <Input value={provider.baseUrl} readOnly className="font-mono text-sm mt-1" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Default Model</Label>
                        <Select defaultValue={provider.defaultModel}>
                          <SelectTrigger className="w-[300px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {provider.models.map((model) => (
                              <SelectItem key={model} value={model}>{model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Model Roles Tab */}
        <TabsContent value="models" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Model Role Assignment</h2>
            <p className="text-sm text-muted-foreground">Assign specific models to different agent roles</p>
          </div>

          <div className="grid gap-4">
            {modelRoles.map((role) => (
              <Card key={role.role}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{role.role}</h3>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{role.provider}</Badge>
                      <Select defaultValue={role.defaultModel}>
                        <SelectTrigger className="w-[240px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Claude 3 Opus">Claude 3 Opus</SelectItem>
                          <SelectItem value="GPT-4o">GPT-4o</SelectItem>
                          <SelectItem value="Gemini Pro">Gemini Pro</SelectItem>
                          <SelectItem value="Llama 3.3 70B">Llama 3.3 70B</SelectItem>
                          <SelectItem value="DeepSeek Chat">DeepSeek Chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Security & Permissions</h2>
            <p className="text-sm text-muted-foreground">Configure sandbox permissions and access controls</p>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Sandbox Permissions
                </CardTitle>
                <CardDescription>Control what agents can do in the execution environment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Allow file system access", description: "Agents can read and write files", defaultChecked: true },
                  { label: "Allow terminal execution", description: "Agents can run shell commands", defaultChecked: true },
                  { label: "Allow network requests", description: "Agents can make HTTP requests", defaultChecked: true },
                  { label: "Allow code execution", description: "Agents can run Python/Node.js code", defaultChecked: true },
                  { label: "Allow browser automation", description: "Agents can control a browser", defaultChecked: false },
                  { label: "Require approval for destructive actions", description: "Prompt before delete, overwrite, or system changes", defaultChecked: true },
                ].map((permission) => (
                  <div key={permission.label} className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{permission.label}</Label>
                      <p className="text-sm text-muted-foreground">{permission.description}</p>
                    </div>
                    <Switch defaultChecked={permission.defaultChecked} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-5 h-5" /> MCP Servers
                </CardTitle>
                <CardDescription>Connect Model Context Protocol servers for extended capabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "filesystem", status: "connected", description: "Local file system access" },
                  { name: "github", status: "disconnected", description: "GitHub repository operations" },
                  { name: "postgres", status: "connected", description: "PostgreSQL database queries" },
                ].map((mcp) => (
                  <div key={mcp.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium capitalize">{mcp.name}</p>
                        <p className="text-xs text-muted-foreground">{mcp.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          mcp.status === "connected" && "bg-green-500/10 text-green-500",
                          mcp.status === "disconnected" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {mcp.status}
                      </Badge>
                      <Button variant="ghost" size="sm">Configure</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full gap-2 mt-2">
                  <Plus className="w-4 h-4" /> Add MCP Server
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">Customize the look and feel of your workspace</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: "Light", icon: Sun, value: "light" },
                  { name: "Dark", icon: Moon, value: "dark" },
                  { name: "System", icon: Monitor, value: "system" },
                ].map((theme) => (
                  <button
                    key={theme.value}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all hover:border-primary",
                      theme.value === "dark" && "border-primary bg-primary/5"
                    )}
                  >
                    <theme.icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{theme.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accent Color</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {["#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#f59e0b"].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all hover:scale-110",
                      color === "#0ea5e9" && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">Configure how and when you receive alerts</p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-4">
              {[
                { label: "Agent completion", description: "When an agent finishes a task", defaultChecked: true },
                { label: "Automation failures", description: "When an automation encounters an error", defaultChecked: true },
                { label: "Cost alerts", description: "When daily spending exceeds threshold", defaultChecked: true },
                { label: "Token usage warnings", description: "When approaching token limits", defaultChecked: false },
                { label: "New agent skills", description: "When an agent learns a new skill", defaultChecked: false },
                { label: "Weekly summary", description: "Weekly usage and activity report", defaultChecked: true },
              ].map((notification) => (
                <div key={notification.label} className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">{notification.label}</Label>
                    <p className="text-sm text-muted-foreground">{notification.description}</p>
                  </div>
                  <Switch defaultChecked={notification.defaultChecked} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Config Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent>
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle>Configure {selectedProvider.name}</DialogTitle>
                <DialogDescription>Update API key and model settings</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="Enter API key" defaultValue={selectedProvider.apiKey} />
                </div>
                {selectedProvider.baseUrl !== undefined && (
                  <div className="space-y-2">
                    <Label>Base URL (optional)</Label>
                    <Input placeholder="https://api.example.com/v1" defaultValue={selectedProvider.baseUrl} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Default Model</Label>
                  <Select defaultValue={selectedProvider.defaultModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider.models.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>Cancel</Button>
                <Button className="gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
