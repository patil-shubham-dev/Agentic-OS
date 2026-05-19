create extension if not exists pgcrypto;

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

create table if not exists public.provider_configs (
  id text primary key,
  provider text not null unique,
  label text not null,
  base_url text,
  default_model text,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.projects (id, name, description, status)
values ('default-project', 'Dream Project', 'Primary AgentOS Studio workspace', 'active')
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    updated_at = now();

insert into public.agents (id, name, description, type, model, status, tools, memory_scope, config)
values
  ('research', 'Research Agent', 'Runs research, session search, and synthesis via Hermes.', 'built-in', 'deepseek', 'active', '["web_search","session_search","memory","citations"]'::jsonb, 'project', '{"source":"hermes"}'::jsonb),
  ('coding', 'Coding Agent', 'Handles file edits, shell execution, and repo understanding.', 'built-in', 'gpt-5', 'active', '["terminal","read_file","write_file","patch","grep","glob"]'::jsonb, 'project', '{"source":"openclaude"}'::jsonb),
  ('design', 'Design Agent', 'Generates artifacts and screenshot-to-code flows.', 'built-in', 'gemini-2.5-pro', 'idle', '["generate_design","screenshot_to_design","design_tokens"]'::jsonb, 'project', '{"source":"opendesign"}'::jsonb),
  ('qa', 'QA Agent', 'Runs tests, review checks, and preview verification.', 'built-in', 'claude-sonnet', 'idle', '["terminal","browser","read_file","execute_code"]'::jsonb, 'project', '{"source":"agentos"}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    model = excluded.model,
    status = excluded.status,
    tools = excluded.tools,
    memory_scope = excluded.memory_scope,
    config = excluded.config;

insert into public.provider_configs (id, provider, label, base_url, default_model, enabled, metadata)
values
  ('provider-openai', 'openai', 'OpenAI', 'https://api.openai.com/v1', 'gpt-5', true, '{}'::jsonb),
  ('provider-anthropic', 'anthropic', 'Anthropic', 'https://api.anthropic.com', 'claude-opus-4.1', true, '{}'::jsonb),
  ('provider-google', 'google', 'Google AI Studio', 'https://generativelanguage.googleapis.com', 'gemini-2.5-pro', true, '{}'::jsonb),
  ('provider-openrouter', 'openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', null, false, '{}'::jsonb),
  ('provider-groq', 'groq', 'Groq', 'https://api.groq.com/openai/v1', null, false, '{}'::jsonb),
  ('provider-ollama', 'ollama', 'Ollama', 'http://localhost:11434', null, false, '{}'::jsonb)
on conflict (provider) do update
set label = excluded.label,
    base_url = excluded.base_url,
    default_model = excluded.default_model,
    enabled = excluded.enabled,
    metadata = excluded.metadata,
    updated_at = now();

alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.automations enable row level security;
alter table public.chats enable row level security;
alter table public.files enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.usage_records enable row level security;
alter table public.provider_configs enable row level security;

drop policy if exists "service role full access projects" on public.projects;
create policy "service role full access projects" on public.projects for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access agents" on public.agents;
create policy "service role full access agents" on public.agents for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access automations" on public.automations;
create policy "service role full access automations" on public.automations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access chats" on public.chats;
create policy "service role full access chats" on public.chats for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access files" on public.files;
create policy "service role full access files" on public.files for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access knowledge" on public.knowledge_items;
create policy "service role full access knowledge" on public.knowledge_items for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access usage" on public.usage_records;
create policy "service role full access usage" on public.usage_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role full access provider_configs" on public.provider_configs;
create policy "service role full access provider_configs" on public.provider_configs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
