# my-jira — Design

**Date:** 2026-04-18
**Author:** Thiago (via brainstorming session)
**Status:** Draft — awaiting user review

## 1. Purpose

Personal Kanban board to manage multiple projects. Not a full Jira clone — just projects, customizable columns per project, and cards with Jira-classic visual density. Single user (owner); other users only exist if manually provisioned.

Deployed at `my-board.aralabs.com.br` via Vercel.

## 2. Scope

### In scope

- Magic-link authentication via Supabase Auth (signup disabled at the Supabase level; users created manually from the dashboard)
- Projects: create, list, rename, delete
- Columns per project: create, rename, reorder (drag-drop), delete
  - Three default columns (To Do / In Progress / Done) are auto-created with `is_default = true` and cannot be deleted (they can be renamed and reordered)
- Cards (tasks): create, edit, delete, drag-drop between columns and within a column to reorder
- Card fields: title, description, priority (low/medium/high), single label (free-text pill, color hashed from text)
- Jira-classic visual: dense cards, light gray background, colored priority icon, label pill

### Out of scope

- Sprints, backlog view
- Subtasks / checklists
- Filters and search
- Assignees / comments / attachments
- Multi-user collaboration features (even though Supabase Auth is used, data is single-owner per account)
- Test suite (manual validation only for MVP)
- Native mobile app

## 3. Architecture

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Data layer:** Supabase Postgres
- **Auth:** Supabase Auth (magic link only; signup disabled)
- **SSR/Auth helpers:** `@supabase/ssr` with cookie-based sessions
- **Mutations:** Next.js Server Actions with `revalidatePath`; no REST API routes
- **Toasts:** `sonner` (shadcn)
- **Deploy:** Vercel, custom domain `my-board.aralabs.com.br`

### Rendering model

- Initial board/project loads are Server Components reading directly from Supabase with the authenticated server client.
- The `Board` component is a Client Component that owns drag-drop state. It applies optimistic updates locally, then calls a Server Action to persist.
- No global client state manager. Local `useState` / `useOptimistic` only.

## 4. Data model

All tables live in the `public` schema. Row-level security is enabled on every table and scoped to `auth.uid()`.

```sql
-- projects
create table projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- board_columns
create table board_columns (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  position    integer not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- tasks
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references board_columns(id) on delete cascade,
  title       text not null,
  description text,
  priority    text not null check (priority in ('low','medium','high')) default 'medium',
  label       text,
  position    double precision not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on board_columns (project_id, position);
create index on tasks (column_id, position);
```

### RLS policies (summary)

- `projects`: `owner_id = auth.uid()` for select/insert/update/delete.
- `board_columns`: allowed when `project_id` belongs to a project whose `owner_id = auth.uid()`.
- `tasks`: allowed when `column_id` belongs to a column whose project's `owner_id = auth.uid()`.

### Triggers

- `updated_at` trigger on `tasks` (standard `now()` on UPDATE).
- Trigger `board_columns_prevent_default_delete` raises an exception on DELETE when `is_default = true`. Defense in depth beyond UI checks.
- Trigger `projects_seed_default_columns` on INSERT INTO `projects` inserts three default columns (`To Do`, `In Progress`, `Done`) with positions 1–3 and `is_default = true`.

### Position semantics

- `position` uses `double precision` to allow mid-insertion without reindexing. On reorder: new position = `(prev.position + next.position) / 2`. At the extremes: `first.position - 1` or `last.position + 1`.
- An occasional "rebalance" (reassign positions as integers 1..N) can be added later if floats drift too small; not in MVP.

## 5. Screens and routes

| Route | Rendering | Purpose |
|---|---|---|
| `/login` | Client | Email field; calls `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: '<origin>/auth/callback' } })`. Shows "check your email" state on success. |
| `/auth/callback` | Route Handler (server) | Exchanges the magic-link `code` for a session cookie and redirects to `/`. |
| `/` | Server Component | Lists the user's projects as clickable cards. "New project" opens a dialog. Header has logout. |
| `/projects/[id]` | Server Component loads data; embeds Client `Board` | Shows breadcrumb, columns (horizontal scroll), "+ New column" button, and cards with drag-drop. |

`middleware.ts` uses `@supabase/ssr` to refresh the session cookie on each request and redirects unauthenticated users to `/login` for any route except `/login` and `/auth/callback`.

## 6. Components

| Component | Type | Purpose |
|---|---|---|
| `LoginForm` | Client | Email field + submit; surfaces success/error state. |
| `ProjectList` | Server | Grid of `ProjectCard`s. |
| `ProjectCard` | Server | Link to `/projects/[id]`; shows name, description, count of columns/tasks (nice-to-have, not required). |
| `ProjectFormDialog` | Client | Modal to create or rename a project. |
| `Board` | Client | `DndContext` owner; renders `BoardColumn`s; handles drag state and optimistic updates. |
| `BoardColumn` | Client | Droppable zone; header with name, menu (rename / delete if not `is_default`), `+` button. |
| `TaskCard` | Client | Draggable; renders label pill, title (2-line clamp), priority icon. |
| `TaskDialog` | Client | Modal to view/edit a task (title, description, priority, label, delete). |
| `ColumnFormDialog` | Client | Modal to create/rename a column. |
| `Header` | Server | App title + user email + logout button. |

## 7. Server Actions

All mutations are Server Actions colocated under `src/app/**/actions.ts` or a shared `src/lib/actions/`. Each action:

- Uses `createServerClient` from `@supabase/ssr` (cookie-based).
- Returns `{ ok: true }` or `{ ok: false, error: string }`.
- Calls `revalidatePath` on the affected route.

Action list (MVP):

- `createProject(name, description?)`
- `renameProject(id, name, description?)`
- `deleteProject(id)`
- `createColumn(projectId, name)`
- `renameColumn(id, name)`
- `reorderColumns(projectId, orderedIds[])`
- `deleteColumn(id)` — rejected if `is_default = true` or if the column has tasks
- `createTask(columnId, title)`
- `updateTask(id, { title?, description?, priority?, label? })`
- `deleteTask(id)`
- `moveTask(id, newColumnId, newPosition)`

Drag-drop flow:

1. User drags a card. `Board` computes the new `column_id` and `position` (midpoint of neighbors).
2. Optimistic state update.
3. Calls `moveTask`.
4. On error, reverts state and shows a toast.

## 8. Visual design (Jira classic)

- App background: `#F4F5F7` (Atlassian-like neutral).
- Column background: `#EBECF0`, rounded, ~280px wide, `max-height` with internal scroll.
- Card: white, subtle shadow, 8px radius, `hover` lifts shadow. Padding ~8–12px. Dense typography (13–14px).
- Priority icons (top-right of the card footer): `low` blue ▼, `medium` amber –, `high` red ▲ — using lucide-react icons tinted.
- Label: pill above the title, color derived by hashing the label text to a stable hue (HSL).
- Font: Inter (Next.js built-in `next/font/google`).

## 9. Auth details

- Supabase project (existing or new under the user's account).
- Disable public signup: Authentication → Providers → Email → "Enable sign ups" OFF.
- Enable email confirmations and customize the Magic Link template (optional).
- URL Configuration: allow `http://localhost:3000` and `https://my-board.aralabs.com.br` as redirect URLs.
- First user: created manually from Supabase dashboard → Authentication → Users → Add user (pre-confirmed email).

## 10. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # only for local scripts/migrations; not used at runtime in the app
```

## 11. Folder layout (target)

```
my-jira/
  src/
    app/
      layout.tsx
      page.tsx                    # projects list (server)
      login/
        page.tsx                  # login form (client)
      auth/
        callback/route.ts         # magic link exchange
      projects/[id]/
        page.tsx                  # board (server shell)
        board.tsx                 # Board client component
        actions.ts                # task + column server actions
      actions.ts                  # project server actions
    components/
      ui/...                      # shadcn generated
      board/
        board-column.tsx
        task-card.tsx
        task-dialog.tsx
        column-form-dialog.tsx
      project-card.tsx
      project-form-dialog.tsx
      header.tsx
    lib/
      supabase/
        server.ts                 # createServerClient
        client.ts                 # createBrowserClient
        middleware.ts
      utils/
        position.ts               # midpoint helpers
        label-color.ts            # hash -> hsl
  supabase/
    migrations/
      0001_init.sql               # tables, RLS, triggers
  middleware.ts
  docs/superpowers/specs/
    2026-04-18-my-jira-design.md  # this file
```

## 12. Error handling

- Server Actions catch and return `{ ok: false, error }`. Client shows `sonner` toast on failure.
- Magic link errors (expired/invalid): `/auth/callback` redirects to `/login?error=...` and the login page renders a visible banner.
- Drag-drop failures roll back optimistic state.

## 13. Open questions / deferred decisions

- No real-time sync between devices (optional Supabase Realtime subscription can be added later).
- Board column virtualization is not needed at MVP scale (personal use, dozens of tasks).
- A "rebalance positions" maintenance job is deferred until drift is observed.

## 14. Success criteria

- User can log in with a magic link using a pre-provisioned Supabase account.
- User can create at least two projects and switch between them.
- Each project starts with To Do / In Progress / Done, visibly marked as non-deletable.
- User can add a custom column (e.g., "Review") and delete it when empty.
- User can create cards with title + description + priority + label.
- Dragging a card between columns persists after a full page refresh.
- Visual density and palette resemble classic Jira at a glance.
