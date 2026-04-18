-- Extensions
create extension if not exists "pgcrypto";

-- projects
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);

-- board_columns
create table public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  position    integer not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index board_columns_project_id_position_idx on public.board_columns (project_id, position);

-- tasks
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references public.board_columns(id) on delete cascade,
  title       text not null,
  description text,
  priority    text not null check (priority in ('low','medium','high')) default 'medium',
  label       text,
  position    double precision not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_column_id_position_idx on public.tasks (column_id, position);

-- updated_at trigger on tasks
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Prevent deletion of default columns
create or replace function public.prevent_default_column_delete()
returns trigger language plpgsql as $$
begin
  if old.is_default then
    raise exception 'Cannot delete a default column';
  end if;
  return old;
end;
$$;

create trigger board_columns_prevent_default_delete
  before delete on public.board_columns
  for each row execute function public.prevent_default_column_delete();

-- Seed 3 default columns when a project is created
create or replace function public.seed_default_columns()
returns trigger language plpgsql as $$
begin
  insert into public.board_columns (project_id, name, position, is_default) values
    (new.id, 'To Do',       1, true),
    (new.id, 'In Progress', 2, true),
    (new.id, 'Done',        3, true);
  return new;
end;
$$;

create trigger projects_seed_default_columns
  after insert on public.projects
  for each row execute function public.seed_default_columns();

-- RLS
alter table public.projects       enable row level security;
alter table public.board_columns  enable row level security;
alter table public.tasks          enable row level security;

-- projects: owner is the only one who can read/write
create policy "projects_owner_rw" on public.projects
  for all
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- board_columns: access via project ownership
create policy "board_columns_by_project_owner" on public.board_columns
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = board_columns.project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = board_columns.project_id and p.owner_id = auth.uid()
    )
  );

-- tasks: access via column -> project ownership
create policy "tasks_by_project_owner" on public.tasks
  for all
  using (
    exists (
      select 1
      from public.board_columns c
      join public.projects p on p.id = c.project_id
      where c.id = tasks.column_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.board_columns c
      join public.projects p on p.id = c.project_id
      where c.id = tasks.column_id and p.owner_id = auth.uid()
    )
  );
