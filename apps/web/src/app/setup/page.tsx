import Link from "next/link";
import { getSetupStatus } from "@/lib/server/setup";
import { REQUIRED_ENV_KEYS } from "@/lib/server/env";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Database,
  KeyRound,
  Sparkles,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

const envCopy: Record<string, { description: string; example: string }> = {
  SUPABASE_URL: {
    description: "Public URL of your Supabase project (or local Supabase stack).",
    example: "SUPABASE_URL=https://your-project.supabase.co",
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    description: "Service-role key with full DB access. Keep server-side only.",
    example: "SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...",
  },
  AGENTOS_ENCRYPTION_KEY: {
    description: "AES-256-GCM passphrase used to encrypt provider API keys at rest.",
    example: "AGENTOS_ENCRYPTION_KEY=$(openssl rand -hex 32)",
  },
};

export default async function SetupPage() {
  const status = await getSetupStatus();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-amber-900">Welcome to AgentOS Studio</h1>
          <p className="text-sm text-amber-700/80">
            Finish configuring your local workspace. Each step below has to pass before the dashboard becomes available.
          </p>
        </div>
      </header>

      {/* Step 1 — environment */}
      <section className="rounded-2xl border border-amber-200 bg-white/70 p-6 shadow-sm">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-amber-900">1. Environment variables</h2>
          </div>
          <Badge
            className={
              status.env.ready
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
            }
          >
            {status.env.ready ? "Configured" : `${status.env.missing.length} missing`}
          </Badge>
        </header>
        <p className="mt-2 text-xs text-amber-700/80">
          Add these to <code className="rounded bg-amber-100/70 px-1 py-0.5 text-[11px] text-amber-900">apps/web/.env.local</code> and restart the dev server.
        </p>
        <ul className="mt-4 space-y-3">
          {REQUIRED_ENV_KEYS.map((key) => {
            const present = status.env.values[key];
            const meta = envCopy[key];
            return (
              <li key={key} className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3">
                {present ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                )}
                <div className="flex-1">
                  <p className="font-mono text-xs font-semibold text-amber-900">{key}</p>
                  <p className="mt-0.5 text-xs text-amber-700/80">{meta.description}</p>
                  {!present ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">{meta.example}</pre>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Step 2 — Supabase connectivity */}
      <section className="rounded-2xl border border-amber-200 bg-white/70 p-6 shadow-sm">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-amber-900">2. Supabase connectivity</h2>
          </div>
          <Badge
            className={
              status.supabaseReachable
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
            }
          >
            {status.supabaseReachable ? "Reachable" : "Not reachable"}
          </Badge>
        </header>
        <p className="mt-2 text-xs text-amber-700/80">
          Apply the schema with <code className="rounded bg-amber-100/70 px-1 py-0.5 text-[11px] text-amber-900">pnpm migrate</code> (or run
          {' '}<code className="rounded bg-amber-100/70 px-1 py-0.5 text-[11px] text-amber-900">docs/supabase-setup.sql</code> against your project). For
          local-only development, start the bundled stack with <code className="rounded bg-amber-100/70 px-1 py-0.5 text-[11px] text-amber-900">docker compose -f infra/docker-compose.yml up -d postgres</code>.
        </p>
      </section>

      {/* Step 3 — connect a provider */}
      <section className="rounded-2xl border border-amber-200 bg-white/70 p-6 shadow-sm">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-amber-900">3. Connect an AI provider</h2>
          </div>
          <Badge
            className={
              status.hasConnectedProvider
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
            }
          >
            {status.hasConnectedProvider ? "Connected" : "Not connected"}
          </Badge>
        </header>
        <p className="mt-2 text-xs text-amber-700/80">
          AgentOS Studio supports OpenAI, Anthropic, Google AI Studio, Groq, OpenRouter, Together AI, DeepSeek, Ollama, LM Studio, and any
          OpenAI-compatible custom endpoint. Add yours from the Settings page once the dashboard is available.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/settings">
            <Button className="bg-amber-500 text-white hover:bg-amber-600">Open Settings</Button>
          </Link>
          {!status.needsSetup ? (
            <Link href="/dashboard">
              <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                Go to dashboard
              </Button>
            </Link>
          ) : null}
        </div>
      </section>

      <footer className="mt-2 text-[11px] text-amber-700/60">
        Need help? See <Link className="underline" href="https://github.com/your-org/agentos-studio">the README</Link> or{" "}
        <code className="rounded bg-amber-100/70 px-1 py-0.5 text-amber-900">docs/local-development.md</code>.
      </footer>
    </div>
  );
}
