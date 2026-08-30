CREATE SCHEMA IF NOT EXISTS trytrust_web;

CREATE TABLE IF NOT EXISTS trytrust_web.users (
  id text PRIMARY KEY, email text NOT NULL, name text NOT NULL, avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trytrust_web.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES trytrust_web.users(id) ON DELETE CASCADE,
  backend_session_id text NOT NULL, agent_id text NOT NULL, mandate_jti text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, backend_session_id)
);
CREATE TABLE IF NOT EXISTS trytrust_web.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES trytrust_web.users(id) ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '', slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  current_version_id uuid, public_config jsonb NOT NULL DEFAULT '{"bindingAllowlist":{}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz, deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS sites_owner_idx ON trytrust_web.sites(owner_id);
CREATE TABLE IF NOT EXISTS trytrust_web.site_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES trytrust_web.sites(id) ON DELETE CASCADE,
  version integer NOT NULL, html text NOT NULL, bindings jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, version)
);
ALTER TABLE trytrust_web.sites DROP CONSTRAINT IF EXISTS sites_current_version_fk;
ALTER TABLE trytrust_web.sites ADD CONSTRAINT sites_current_version_fk FOREIGN KEY (current_version_id) REFERENCES trytrust_web.site_versions(id);

