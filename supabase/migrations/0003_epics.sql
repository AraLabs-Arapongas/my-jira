-- epics
create table public.epics (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  color       text not null default 'purple',
  created_at  timestamptz not null default now()
);
create index epics_project_id_idx on public.epics (project_id);

-- link tasks to epic (nullable)
alter table public.tasks
  add column epic_id uuid references public.epics(id) on delete set null;
create index tasks_epic_id_idx on public.tasks (epic_id);

-- RLS
alter table public.epics enable row level security;

create policy "epics_by_project_owner" on public.epics
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = epics.project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = epics.project_id and p.owner_id = auth.uid()
    )
  );
