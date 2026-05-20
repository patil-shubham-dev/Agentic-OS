-- AgentOS Studio — canonical Supabase schema.
-- Apply with `pnpm migrate` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ============================================================================
-- Core entities
-- ============================================================================

create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id text primary key,
  name text not null,
  description text not null,
  type text not null default 'custom',
  model text not null,
  status text not null default 'idle',
  tools jsonb not null default '[]'::jsonb,
  memory_scope text not null default 'project',
  config jsonb not null default '{}'::jsonb,
  runs integer,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.automations (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null,
  status text not null default 'draft',
  trigger jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  runs integer not null default 0,
  success_rate numeric not null default 100,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  model text not null,
  agent_id text,
  messages jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  path text not null,
  content text,
  size integer not null default 0,
  language text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create table if not exists public.knowledge_items (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null,
  source text not null,
  size integer not null default 0,
  chunks integer not null default 0,
  embedding_id text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- pgvector chunk store for retrieval-augmented chat (Wave D will populate).
create table if not exists public.knowledge_chunks (
  id text primary key,
  document_id text not null references public.knowledge_items(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.memories (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  scope text not null default 'project',
  key text not null,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scope, key)
);

create table if not exists public.usage_records (
  id text primary key,
  user_id text,
  project_id text references public.projects(id) on delete set null,
  model text not null,
  provider text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost numeric not null default 0,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Provider configuration (encrypted credentials at rest)
-- ============================================================================

create table if not exists public.provider_configs (
  id text primary key,
  provider text not null unique,
  label text not null,
  base_url text,
  default_model text,
  enabled boolean not null default false,
  api_key_ciphertext text,
  api_key_last4 text,
  validation_status text,
  last_validated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column additions for installs created before these fields existed.
alter table public.provider_configs add column if not exists api_key_ciphertext text;
alter table public.provider_configs add column if not exists api_key_last4 text;
alter table public.provider_configs add column if not exists validation_status text;
alter table public.provider_configs add column if not exists last_validated_at timestamptz;
alter table public.provider_configs add column if not exists created_at timestamptz not null default now();

create table if not exists public.provider_models (
  id text primary key,
  provider text not null references public.provider_configs(provider) on delete cascade,
  model text not null,
  context_window integer,
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (provider, model)
);

-- ============================================================================
-- Run history
-- ============================================================================

create table if not exists public.agent_runs (
  id text primary key,
  agent_id text not null references public.agents(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_agent_idx on public.agent_runs(agent_id, started_at desc);

create table if not exists public.automation_runs (
  id text primary key,
  automation_id text not null references public.automations(id) on delete cascade,
  status text not null,
  trigger jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists automation_runs_automation_idx on public.automation_runs(automation_id, started_at desc);

create table if not exists public.tool_invocations (
  id text primary key,
  run_id text,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Settings KV (free-form workspace state, e.g. setup wizard progress)
-- ============================================================================

create table if not exists public.settings_kv (
  id text primary key,
  scope text not null default 'global',
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Seeds — definitions only. No fake metrics, no fake project, no fake users.
-- Built-in agent rows are upserted with NULL runs / NULL last_run_at so the UI
-- shows "No runs yet" until real executions happen.
-- ============================================================================

insert into public.agents (id, name, description, type, model, status, tools, memory_scope, config)
values
  ('research', 'Research Agent', 'Open-ended research, search, and synthesis.', 'built-in', 'gpt-5', 'idle', '["web_search","memory","citations"]'::jsonb, 'project', '{"source":"hermes"}'::jsonb),
  ('coding', 'Coding Agent', 'File edits, repo understanding, terminal execution.', 'built-in', 'gpt-5', 'idle', '["terminal","read_file","write_file","patch","grep","glob"]'::jsonb, 'project', '{"source":"openclaude"}'::jsonb),
  ('design', 'Design Agent', 'Prompt-to-UI, screenshot-to-code, design tokens.', 'built-in', 'gpt-5', 'idle', '["generate_design","screenshot_to_design","design_tokens"]'::jsonb, 'project', '{"source":"opendesign"}'::jsonb),
  ('qa', 'QA Agent', 'Tests, review checks, preview verification.', 'built-in', 'gpt-5', 'idle', '["terminal","browser","read_file","execute_code"]'::jsonb, 'project', '{"source":"agentos"}'::jsonb),
  ('docs', 'Documentation Agent', 'Maintains READMEs and API docs.', 'built-in', 'gpt-5', 'idle', '["read_file","write_file","memory"]'::jsonb, 'project', '{"source":"hermes"}'::jsonb),
  ('deployment', 'Deployment Agent', 'Release checks, environment diffs, rollouts.', 'built-in', 'gpt-5', 'idle', '["terminal","read_file","webhook"]'::jsonb, 'global', '{"source":"openclaude"}'::jsonb),
  ('analytics', 'Analytics Agent', 'Telemetry, spend, run performance analysis.', 'built-in', 'gpt-5', 'idle', '["execute_code","read_file","memory"]'::jsonb, 'project', '{"source":"agentos"}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    tools = excluded.tools,
    memory_scope = excluded.memory_scope,
    config = excluded.config;

-- Empty provider catalog rows. All disabled and unconfigured. The Settings UI
-- treats `enabled = false` as "Disconnected". The operator must add an API key
-- and click Test Connection before validation_status becomes 'connected'.
insert into public.provider_configs (id, provider, label, base_url, default_model, enabled, metadata)
values
  ('provider-openai', 'openai', 'OpenAI', 'https://api.openai.com/v1', null, false, '{}'::jsonb),
  ('provider-anthropic', 'anthropic', 'Anthropic', 'https://api.anthropic.com', null, false, '{}'::jsonb),
  ('provider-google', 'google', 'Google AI Studio', 'https://generativelanguage.googleapis.com', null, false, '{}'::jsonb),
  ('provider-groq', 'groq', 'Groq', 'https://api.groq.com/openai/v1', null, false, '{}'::jsonb),
  ('provider-deepseek', 'deepseek', 'DeepSeek', 'https://api.deepseek.com', null, false, '{}'::jsonb),
  ('provider-openrouter', 'openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', null, false, '{}'::jsonb),
  ('provider-together', 'together', 'Together AI', 'https://api.together.xyz/v1', null, false, '{}'::jsonb),
  ('provider-ollama', 'ollama', 'Ollama', 'http://localhost:11434/v1', null, false, '{}'::jsonb),
  ('provider-lmstudio', 'lmstudio', 'LM Studio', 'http://localhost:1234/v1', null, false, '{}'::jsonb)
on conflict (provider) do update
set label = excluded.label,
    base_url = excluded.base_url,
    metadata = excluded.metadata,
    updated_at = now();

-- ============================================================================
-- Row level security (service role full access; client uses service-role only)
-- ============================================================================

alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.automations enable row level security;
alter table public.chats enable row level security;
alter table public.files enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.memories enable row level security;
alter table public.usage_records enable row level security;
alter table public.provider_configs enable row level security;
alter table public.provider_models enable row level security;
alter table public.agent_runs enable row level security;
alter table public.automation_runs enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.settings_kv enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'projects', 'agents', 'automations', 'chats', 'files',
    'knowledge_items', 'knowledge_chunks', 'memories', 'usage_records',
    'provider_configs', 'provider_models', 'agent_runs', 'automation_runs',
    'tool_invocations', 'settings_kv'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', 'service role full access ' || t, t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      'service role full access ' || t, t
    );
  end loop;
end $$;
