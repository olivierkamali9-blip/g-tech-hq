-- G-Tech HQ — schéma de base
-- À exécuter dans Supabase > SQL Editor

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  status text not null default 'idee', -- idee | en_discussion | valide | en_cours | livre
  lead_agent_id text,
  deletion_votes jsonb default '{}'::jsonb,
  github_repo text,
  vercel_url text,
  created_at timestamptz default now()
);

create table if not exists project_agents (
  project_id uuid references projects(id) on delete cascade,
  agent_id text not null,
  role_in_project text,
  primary key (project_id, agent_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  author_id text not null,
  author_name text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  label text not null,
  created_at timestamptz default now()
);

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  author_id text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  path text not null,
  content text not null,
  updated_at timestamptz default now(),
  unique(project_id, path)
);

alter table projects enable row level security;
alter table project_agents enable row level security;
alter table messages enable row level security;
alter table activity_log enable row level security;
alter table dm_messages enable row level security;
alter table project_files enable row level security;

do $$ begin
  create policy "allow all - projects" on projects for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "allow all - project_agents" on project_agents for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "allow all - messages" on messages for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "allow all - activity_log" on activity_log for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "allow all - dm_messages" on dm_messages for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "allow all - project_files" on project_files for all using (true) with check (true);
exception when duplicate_object then null; end $$;
