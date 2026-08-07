-- G-Tech HQ — schéma de base
-- À exécuter dans Supabase > SQL Editor

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  status text not null default 'idee', -- idee | en_discussion | valide | en_cours | livre
  lead_agent_id text,
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
  author_id text not null,        -- 'user' ou id de l'agent
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

-- Row Level Security : désactivé pour l'instant (outil mono-utilisateur, clé anon uniquement)
alter table projects enable row level security;
alter table project_agents enable row level security;
alter table messages enable row level security;
alter table activity_log enable row level security;

create policy "allow all - projects" on projects for all using (true) with check (true);
create policy "allow all - project_agents" on project_agents for all using (true) with check (true);
create policy "allow all - messages" on messages for all using (true) with check (true);
-- Messagerie privée : conversations 1-à-1 entre Olivier et chaque agent
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,         -- id de l'agent concerné par ce fil
  author_id text not null,        -- 'user' ou l'id de l'agent
  content text not null,
  created_at timestamptz default now()
);
alter table dm_messages enable row level security;
create policy "allow all - dm_messages" on dm_messages for all using (true) with check (true);
