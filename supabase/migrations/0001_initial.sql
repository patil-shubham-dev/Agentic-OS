-- 0001_initial.sql — AgentOS Studio complete schema.
-- Applies the base schema from docs/supabase-setup.sql plus the complete
-- feature migration from supabase/migrations/0002_complete_schema.sql.
-- Intended to be applied via `pnpm migrate` or piped to psql against a
-- local Postgres + pgvector extension.

\i 'docs/supabase-setup.sql'
\i 'supabase/migrations/0002_complete_schema.sql'
