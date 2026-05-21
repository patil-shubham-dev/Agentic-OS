-- ============================================================================
-- AgentOS Studio — Complete Schema Migration
-- ============================================================================
-- This file extends the base schema (0001_initial.sql / docs/supabase-setup.sql)
-- with all tables and columns required by the fully implemented features:
--   • Multi-agent orchestration v2 (real-time collaboration)
--   • Security guard with audit logging
--   • Tool execution loop with approval workflow
--   • Git integration
--   • Context indexing (TF-IDF)
--   • Autonomous execution tracking
--   • Execution history
-- ============================================================================

-- ============================================================================
-- 1. Security Audit Log
-- Records every security check performed by the SecurityGuard, including
-- permission denials, approvals, and secret detections.
-- ============================================================================

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  session_id text not null default '',
  action text not null,                    -- 'allow' | 'block' | 'pending_approval' | 'approved' | 'denied'
  tool_name text not null,                 -- 'execute_terminal' | 'write_file' | 'fetch_web' | etc.
  args jsonb not null default '{}'::jsonb,
  result text not null,                    -- 'allowed' | 'blocked' | 'pending_approval' | 'approved' | 'denied'
  reason text default '',
  ip_address text default '',
  user_agent text default '',
  created_at timestamptz not null default now()
);

create index if not exists security_audit_log_project_idx
  on public.security_audit_log(project_id, created_at desc);

create index if not exists security_audit_log_tool_idx
  on public.security_audit_log(tool_name, created_at desc);

-- ============================================================================
-- 2. Pending Approvals
-- Tracks tool calls waiting for user approval (for destructive operations).
-- Used by the execution store's pendingApprovals state.
-- ============================================================================

create table if not exists public.pending_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  execution_id text not null,              -- links to agent_runs or automation_runs
  tool_call_id text not null,              -- unique identifier for the tool call
  tool_name text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_by text default 'system',      -- 'system' | role name (e.g. 'Coding')
  resolved_by text default '',             -- 'user' or user identifier
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists pending_approvals_status_idx
  on public.pending_approvals(status, created_at asc);

create index if not exists pending_approvals_execution_idx
  on public.pending_approvals(execution_id);

-- ============================================================================
-- 3. Agent Collaboration Messages
-- Persistent log of inter-agent communication (from InterAgentBus).
-- Supports real-time collaboration between Manager, Coding, Design, etc.
-- ============================================================================

create table if not exists public.agent_collaboration (
  id text primary key,                     -- msg_<timestamp>_<random> format
  project_id text references public.projects(id) on delete cascade,
  execution_id text not null default '',   -- links messages to a specific orchestration run
  from_agent text not null,                -- sender role name
  to_agent text not null,                  -- recipient role name
  type text not null default 'delegation' check (type in (
    'delegation', 'query', 'response', 'proposal', 'approval_request',
    'approval_response', 'status_update', 'clarification', 'notification', 'error'
  )),
  task text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  response jsonb,
  topic text not null default 'general',
  conversation_id text,                    -- groups messages into threads
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_collaboration_execution_idx
  on public.agent_collaboration(execution_id, created_at asc);

create index if not exists agent_collaboration_conversation_idx
  on public.agent_collaboration(conversation_id);

create index if not exists agent_collaboration_topic_idx
  on public.agent_collaboration(topic);

-- ============================================================================
-- 4. Execution History
-- Persistent record of all agent executions including tool calls, timing,
-- token usage, and outcomes. Complements the in-memory useExecutionStore.
-- ============================================================================

create table if not exists public.execution_history (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  parent_id text,                          -- links to a parent execution (for sub-steps)
  type text not null check (type in ('agent', 'tool', 'plan', 'automation', 'chat')),
  role text not null default '',           -- agent role name
  model_id text default '',
  provider_id text default '',
  status text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'failed', 'fallback', 'awaiting_approval'
  )),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text default '',
  runtime_ms integer default 0,
  tokens_used integer default 0,
  tokens_per_second numeric(10,2) default 0,
  cost numeric(12,6) default 0,
  fallback_chain jsonb default '[]'::jsonb,  -- list of provider fallbacks attempted
  metadata jsonb default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists execution_history_project_idx
  on public.execution_history(project_id, started_at desc);

create index if not exists execution_history_status_idx
  on public.execution_history(status);

create index if not exists execution_history_parent_idx
  on public.execution_history(parent_id);

-- ============================================================================
-- 5. Tool Invocations (Extended)
-- Extended from the base schema with additional fields for multi-turn loops,
-- approval tracking, and security audit references.
-- ============================================================================

-- Add columns to existing tool_invocations table
alter table public.tool_invocations add column if not exists execution_id text;
alter table public.tool_invocations add column if not exists step_index integer default 0;
alter table public.tool_invocations add column if not exists turn_index integer default 0;  -- which turn in multi-turn loop
alter table public.tool_invocations add column if not exists approved boolean;
alter table public.tool_invocations add column if not exists approval_id text;              -- links to pending_approvals
alter table public.tool_invocations add column if not exists security_audit_id text;         -- links to security_audit_log
alter table public.tool_invocations add column if not exists input_tokens integer default 0;
alter table public.tool_invocations add column if not exists output_tokens integer default 0;

create index if not exists tool_invocations_execution_idx
  on public.tool_invocations(execution_id);

-- ============================================================================
-- 6. Agent Runs (Extended for Multi-Agent v2)
-- Add collaboration and replanning tracking to existing agent_runs.
-- ============================================================================

alter table public.agent_runs add column if not exists plan_id text;
alter table public.agent_runs add column if not exists replan_count integer default 0;
alter table public.agent_runs add column if not exists parallel_group text default '';       -- which parallel group this run belongs to
alter table public.agent_runs add column if not exists collaboration_msg_count integer default 0;
alter table public.agent_runs add column if not exists context_index_used boolean default false;
alter table public.agent_runs add column if not exists autonomous boolean default false;

create index if not exists agent_runs_plan_idx on public.agent_runs(plan_id);

-- ============================================================================
-- 7. Git Cache
-- Caches git status, recent commits, and branch info to avoid repeated
-- exec() calls. Refreshed by the /api/git/* endpoints.
-- ============================================================================

create table if not exists public.git_cache (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade unique,
  branch text not null default 'main',
  changes_count integer not null default 0,
  changes_list jsonb not null default '[]'::jsonb,
  recent_commits jsonb not null default '[]'::jsonb,
  ahead integer not null default 0,
  behind integer not null default 0,
  last_refreshed_at timestamptz not null default now()
);

-- ============================================================================
-- 8. Context Index Cache
-- Persists TF-IDF index entries across sessions so the index doesn't need
-- to be rebuilt every time the app loads.
-- ============================================================================

create table if not exists public.context_index_cache (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  extension text not null default '',
  terms jsonb not null default '{}'::jsonb,   -- { "word": frequency, ... }
  term_count integer not null default 0,
  file_size integer not null default 0,
  indexed_at timestamptz not null default now(),
  unique (project_id, file_path)
);

create index if not exists context_index_cache_project_idx
  on public.context_index_cache(project_id);

-- ============================================================================
-- 9. Agent Prompts (Versioned)
-- Stores versioned system prompts per role so changes can be audited
-- and rolled back if needed.
-- ============================================================================

create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  role text not null,                      -- 'Manager' | 'Coding' | 'Design' | 'Research' | etc.
  version integer not null default 1,
  prompt_text text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (role, version)
);

-- ============================================================================
-- 10. Automation Runs (Extended)
-- Add context indexing and approval tracking to automation runs.
-- ============================================================================

alter table public.automation_runs add column if not exists autonomous boolean default false;
alter table public.automation_runs add column if not exists approval_count integer default 0;
alter table public.automation_runs add column if not exists tool_invocation_count integer default 0;

-- ============================================================================
-- Row Level Security — new tables
-- ============================================================================

alter table public.security_audit_log enable row level security;
alter table public.pending_approvals enable row level security;
alter table public.agent_collaboration enable row level security;
alter table public.execution_history enable row level security;
alter table public.git_cache enable row level security;
alter table public.context_index_cache enable row level security;
alter table public.agent_prompts enable row level security;

do $$
declare
  t text;
  policy_name text;
  tables text[] := array[
    'security_audit_log', 'pending_approvals', 'agent_collaboration',
    'execution_history', 'git_cache', 'context_index_cache', 'agent_prompts'
  ];
begin
  foreach t in array tables loop
    policy_name := 'service_role_full_access_' || t;
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      policy_name, t
    );
  end loop;
end $$;
