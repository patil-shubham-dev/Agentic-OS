"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  Key,
  Palette,
  Save,
  Shield,
  Bell,
  CheckCircle2,
  AlertCircle,
  Server,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";

interface ProviderConfig {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
}

const providerModels: Record<string, string[]> = {
  openai: ["gpt-5", "gpt-4o", "gpt-4-turbo"],
  anthropic: ["claude-opus-4.1", "claude-sonnet-4", "claude-3.5-haiku"],
  google: ["gemini-2.5-pro", "gemini-1.5-pro"],
  openrouter: ["anthropic/claude-opus-4.1", "openai/gpt-5", "google/gemini-2.5-pro"],
  groq: ["llama-3.3-70b", "mixtral-8x7b"],
  together: ["llama-3.3-70b", "mixtral-8x22b"],
  ollama: ["llama3.3", "mistral", "codellama"],
};

const modelRoles = [
  { role: "Manager", description: "Primary agent that delegates tasks", provider: "anthropic" },
  { role: "Coding", description: "Code generation and review", provider: "openai" },
  { role: "Design", description: "UI/UX generation", provider: "google" },
  { role: "Research", description: "Web search and analysis", provider: "openrouter" },
  { role: "Fast Inference", description: "Quick responses and simple tasks", provider: "groq" },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  useEffect(() => {
    getJson<{ providers: Array<Record<string, unknown>> }>("/api/settings/providers")
      .then((data) => {
        setProviders(
          data.providers.map((provider) => ({
            id: String(provider.provider),
            name: String(provider.label),
            status: provider.enabled ? "connected" : "disconnected",
            baseUrl: provider.base_url ? String(provider.base_url) : undefined,
            models: providerModels[String(provider.provider)] ?? [],
            defaultModel: provider.default_model ? String(provider.default_model) : undefined,
          }))
        );
      })
      .catch(() => setProviders([]));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage providers, model roles, security, and workspace preferences</p>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="providers" className="gap-2"><Key className="w-4 h-4" /> Providers</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><Cpu className="w-4 h-4" /> Roles</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" /> Security</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="w-4 h-4" /> Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      <Badge
                        className={cn(
                          provider.status === "connected" && "bg-green-500/10 text-green-500",
                          provider.status === "disconnected" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {provider.status === "connected" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
                        {provider.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.models.length} configured models</p>
                  </div>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Base URL</Label>
                    <Input value={provider.baseUrl ?? ""} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Model</Label>
                    <Select defaultValue={provider.defaultModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose model" />
                      </SelectTrigger>
                      <SelectContent>
                        {provider.models.map((model) => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {modelRoles.map((role) => {
            const provider = providers.find((item) => item.id === role.provider);
            return (
              <Card key={role.role}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-semibold">{role.role}</p>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                  <div className="w-[260px]">
                    <Select defaultValue={provider?.defaultModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {(provider?.models ?? []).map((model) => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution Safety</CardTitle>
              <CardDescription>Sandbox and service integration controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Allow terminal execution", enabled: true },
                { label: "Allow filesystem writes", enabled: true },
                { label: "Require approval for destructive actions", enabled: true },
                { label: "Enable browser automation", enabled: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <Label>{item.label}</Label>
                  <Switch defaultChecked={item.enabled} />
                </div>
              ))}
              <div className="rounded-xl border border-white/10 bg-muted/30 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Supabase is being used as the primary data backend for workspace state.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Consumer-grade dark workspace with premium contrast</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              {[
                { name: "Light", icon: Sun },
                { name: "Dark", icon: Moon },
                { name: "System", icon: Monitor },
              ].map((theme) => (
                <button key={theme.name} className={cn("rounded-xl border p-4 text-center", theme.name === "Dark" && "border-primary bg-primary/5")}>
                  <theme.icon className="mx-auto mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">{theme.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Delivery preferences for workspace events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Agent completion alerts",
                "Automation failure alerts",
                "Cost threshold warnings",
                "Weekly usage digest",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> {item}</Label>
                  <Switch defaultChecked />
                </div>
              ))}
              <div className="flex justify-end">
                <Button className="gap-2"><Save className="h-4 w-4" /> Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
