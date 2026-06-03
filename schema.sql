-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Drop existing tables/types if they exist to allow clean replay
drop table if exists public.tasks cascade;
drop table if exists public.projects cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop type if exists public.role_type cascade;
drop type if exists public.task_status cascade;

-- Create types
create type public.role_type as enum ('owner', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'done');

-- Create workspaces table
create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create workspace_members table
create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.role_type not null default 'member',
  primary key (workspace_id, user_id)
);

-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tasks table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  assignee_id uuid references auth.users(id) on delete set null,
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a secure view for workspace users to display names/emails safely without exposing auth credentials
create or replace view public.users as
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as full_name
from auth.users u
where exists (
  select 1 from public.workspace_members wm_current
  where wm_current.user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm_other
    where wm_other.workspace_id = wm_current.workspace_id
    and wm_other.user_id = u.id
  )
);

-- Enable Row Level Security (RLS) on all tables
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

-- Security Helper Functions to prevent infinite recursion
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = 'owner'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- RLS Policies

-- WORKSPACES POLICIES
create policy "Users can select workspaces they are members of"
  on public.workspaces for select
  using (is_workspace_member(id));

create policy "Users can insert workspaces they create"
  on public.workspaces for insert
  with check (auth.uid() is not null);

create policy "Workspace members can update their workspace"
  on public.workspaces for update
  using (is_workspace_member(id));

create policy "Workspace owners can delete their workspace"
  on public.workspaces for delete
  using (is_workspace_owner(id));


-- WORKSPACE_MEMBERS POLICIES
create policy "Workspace members can view workspace membership"
  on public.workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "Workspace owners can add members"
  on public.workspace_members for insert
  with check (is_workspace_owner(workspace_id));

create policy "Workspace owners can update member roles"
  on public.workspace_members for update
  using (is_workspace_owner(workspace_id));

create policy "Workspace members can remove themselves or owners can remove anyone"
  on public.workspace_members for delete
  using (is_workspace_owner(workspace_id) or user_id = auth.uid());


-- PROJECTS POLICIES
create policy "Workspace members can select projects"
  on public.projects for select
  using (is_workspace_member(workspace_id));

create policy "Workspace members can insert projects"
  on public.projects for insert
  with check (is_workspace_member(workspace_id));

create policy "Workspace members can update projects"
  on public.projects for update
  using (is_workspace_member(workspace_id));

create policy "Workspace members can delete projects"
  on public.projects for delete
  using (is_workspace_member(workspace_id));


-- TASKS POLICIES
create policy "Workspace members can select tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "Workspace members can insert tasks"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "Workspace members can update tasks"
  on public.tasks for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and is_workspace_member(p.workspace_id)
    )
  );

create policy "Workspace members can delete tasks"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and is_workspace_member(p.workspace_id)
    )
  );


-- TRIGGERS
-- Auto-create workspace member for the creator of a workspace
create or replace function public.handle_new_workspace()
returns trigger as $$
begin
  if auth.uid() is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute procedure public.handle_new_workspace();


-- Trigger to automatically set up a workspace for new auth users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  -- Only create workspace if the user has no workspace assigned yet
  if not exists (select 1 from public.workspace_members where user_id = new.id) then
    -- Create a default workspace for the user
    insert into public.workspaces (name)
    values (concat(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '''s Workspace'))
    returning id into new_workspace_id;

    -- Add the user as owner of the workspace (explicitly here since auth.uid() might be null in this system context)
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, new.id, 'owner')
    on conflict do nothing;

    -- Create a default project for them
    insert into public.projects (workspace_id, name)
    values (new_workspace_id, 'First Project');
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- SEED DATA
-- Insert seed users (using standard pgcrypto extension for crypt / gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
VALUES 
('11111111-1111-1111-1111-111111111111', 'user1@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"John Doe"}', 'authenticated', 'authenticated', now(), now()),
('22222222-2222-2222-2222-222222222222', 'user2@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jane Smith"}', 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '{"sub":"11111111-1111-1111-1111-111111111111","email":"user1@example.com"}', 'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()),
('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '{"sub":"22222222-2222-2222-2222-222222222222","email":"user2@example.com"}', 'email', '22222222-2222-2222-2222-222222222222', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert workspaces
INSERT INTO public.workspaces (id, name, created_at)
VALUES 
('a1111111-1111-1111-1111-111111111111', 'Acme Corp', now()),
('b2222222-2222-2222-2222-222222222222', 'Stark Industries', now())
ON CONFLICT (id) DO NOTHING;

-- Insert workspace members
INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES 
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner'),
('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'member'),
('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Insert projects
INSERT INTO public.projects (id, workspace_id, name, created_at)
VALUES 
('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Marketing Campaign', now()),
('c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Website Redesign', now()),
('d1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'Arc Reactor', now()),
('d2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Mark LXXXV Suite', now())
ON CONFLICT (id) DO NOTHING;

-- Insert tasks
-- Acme Corp - Marketing Campaign
INSERT INTO public.tasks (id, project_id, title, description, status, assignee_id, due_date, created_at)
VALUES 
('e1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Draft Social Media Plan', 'Outline the posting schedule and creatives for Q3.', 'done', '11111111-1111-1111-1111-111111111111', now() - interval '2 days', now() - interval '5 days'),
('e2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Review Ad Copy', 'Proofread search ads and review campaign setup.', 'in_progress', '22222222-2222-2222-2222-222222222222', now() + interval '1 day', now() - interval '3 days'),
('e3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'Setup Analytics Tracking', 'Add Google Tag Manager scripts and verify conversion goals.', 'todo', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', now() - interval '2 days'),
('e4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', 'Prepare Monthly Budget Report', 'Assemble expense sheets and project ROI figures.', 'todo', null, now() + interval '4 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Acme Corp - Website Redesign
INSERT INTO public.tasks (id, project_id, title, description, status, assignee_id, due_date, created_at)
VALUES 
('f1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Design Wireframes', 'Design low-fidelity mockups for landing and checkout pages.', 'done', '22222222-2222-2222-2222-222222222222', now() - interval '4 days', now() - interval '10 days'),
('f2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Implement Hero Section', 'Code the frontend hero section with interactive gradients.', 'in_progress', '11111111-1111-1111-1111-111111111111', now() + interval '2 days', now() - interval '4 days'),
('f3333333-3333-3333-3333-333333333333', 'c2222222-2222-2222-2222-222222222222', 'Migrate to Tailwind v4', 'Upgrade config files and handle new theme imports.', 'todo', '22222222-2222-2222-2222-222222222222', now() - interval '3 days', now() - interval '5 days'),
('f4444444-4444-4444-4444-444444444444', 'c2222222-2222-2222-2222-222222222222', 'Conduct User Acceptance Testing', 'Gather feedback from selected client base on design changes.', 'todo', null, now() + interval '7 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Stark Industries - Arc Reactor
INSERT INTO public.tasks (id, project_id, title, description, status, assignee_id, due_date, created_at)
VALUES 
('71111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Synthesize Palladium Core', 'Prepare high-purity palladium samples for test runs.', 'done', '22222222-2222-2222-2222-222222222222', now() - interval '5 days', now() - interval '15 days'),
('72222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Assemble Containment Ring', 'Join the magnetic coils with the vacuum chamber housing.', 'in_progress', '22222222-2222-2222-2222-222222222222', now() + interval '3 days', now() - interval '8 days'),
('73333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'Calibrate Energy Output', 'Run diagnostic simulations to control thermal spike hazards.', 'todo', '22222222-2222-2222-2222-222222222222', now() - interval '2 hours', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Stark Industries - Mark LXXXV Suite
INSERT INTO public.tasks (id, project_id, title, description, status, assignee_id, due_date, created_at)
VALUES 
('81111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 'Initialize Nanotech Framework', 'Upload latest control algorithms to nanite matrices.', 'done', '22222222-2222-2222-2222-222222222222', now() - interval '3 days', now() - interval '12 days'),
('82222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'Integrate F.R.I.D.A.Y. Interface', 'Link target tracking and sensor feeds to voice HUD.', 'in_progress', '22222222-2222-2222-2222-222222222222', now() + interval '1 day', now() - interval '5 days'),
('83333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'Stress-Test Flight Stabilizers', 'Execute high-g turns and deceleration maneuvers in wind tunnel.', 'todo', null, now() - interval '4 hours', now() - interval '3 days'),
('84444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'Deploy Vibranium Coating', 'Apply final outer shielding for advanced impact protection.', 'todo', '22222222-2222-2222-2222-222222222222', now() + interval '5 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;
