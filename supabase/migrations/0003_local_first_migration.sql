-- ============================================================================
-- AgentOS Studio — Local-First Schema Additions
-- ============================================================================
-- This migration adds any tables/columns required by the local-first SQLite
-- layer that may not exist in the Supabase schema yet.
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT …).
-- ============================================================================

-- ============================================================================
-- 1. Provider Models Cache
-- Mirrors discovered models locally. The Supabase schema should already
-- have a provider_models table from docs/supabase-setup.sql; this ensures
-- the required columns are present.
-- ============================================================================

-- Ensure provider_models exists with all columns
create table if not exists public.provider_models (
  id text primary key,
  provider text not null,
  model text not null,
  context_window integer,
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (provider, model)
);

create index if not exists idx_provider_models_provider
  on public.provider_models(provider);

-- ============================================================================
-- 2. Execution History (with extended columns for local-first runtime)
-- ============================================================================

-- Add tokens_per_second and cost columns if they don't already exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'execution_history'
    and column_name = 'tokens_per_second'
  ) then
    alter table public.execution_history add column tokens_per_second numeric(10,2) default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'execution_history'
    and column_name = 'cost'
  ) then
    alter table public.execution_history add column cost numeric(12,6) default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'execution_history'
    and column_name = 'fallback_chain'
  ) then
    alter table public.execution_history add column fallback_chain jsonb default '[]'::jsonb;
  end if;
end $$;

-- ============================================================================
-- 3. Agent Prompts (versioned system prompts per role)
-- ============================================================================

create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  version integer not null default 1,
  prompt_text text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (role, version)
);

-- ============================================================================
-- 4. Context Index Cache (TF-IDF state persistence)
-- ============================================================================

create table if not exists public.context_index_cache (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  extension text not null default '',
  terms jsonb not null default '{}'::jsonb,
  term_count integer not null default 0,
  file_size integer not null default 0,
  indexed_at timestamptz not null default now(),
  unique (project_id, file_path)
);

create index if not exists idx_context_index_cache_project
  on public.context_index_cache(project_id);

-- ============================================================================
-- 5. Tool Invocations — ensure all columns for local-first exist
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tool_invocations'
    and column_name = 'input_tokens'
  ) then
    alter table public.tool_invocations add column input_tokens integer default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tool_invocations'
    and column_name = 'output_tokens'
  ) then
    alter table public.tool_invocations add column output_tokens integer default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tool_invocations'
    and column_name = 'step_index'
  ) then
    alter table public.tool_invocations add column step_index integer default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tool_invocations'
    and column_name = 'turn_index'
  ) then
    alter table public.tool_invocations add column turn_index integer default 0;
  end if;
end $$;

-- ============================================================================
-- 6. Row Level Security — new tables
-- ============================================================================

do $$
declare
  t text;
  new_tables text[] := array['provider_models', 'context_index_cache', 'agent_prompts'];
begin
  foreach t in array new_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists service_role_full_access_%I on public.%I', t, t);
    execute format(
      'create policy service_role_full_access_%I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      t, t
    );
  end loop;
end $$;
