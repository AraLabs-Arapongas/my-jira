# my-jira Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal Kanban board app (Next.js + Supabase) with magic-link auth, multiple projects, customizable columns, and drag-and-drop cards, deployable to `my-board.aralabs.com.br`.

**Architecture:** Next.js 16 App Router with Server Components for reads and Server Actions for writes. Supabase Postgres (with Auth magic-link, signup disabled) as the single source of truth, scoped by RLS on `auth.uid()`. Drag-and-drop uses `@dnd-kit` with optimistic updates on the client, persisted through Server Actions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, `@supabase/ssr`, `@supabase/supabase-js`, `@dnd-kit/core`, `@dnd-kit/sortable`, `sonner`, `lucide-react`.

**Testing note:** The spec defers automated tests ("manual validation only for MVP"). Every task ends with a **manual validation** step that must be run (and observed to pass) before committing. Do not skip validation.

**Working directory:** `/Users/thiagotavares/Projects/a-labs/tech/my-jira` (git repo already initialized with the design spec committed).

---

## Task 1: Bootstrap Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `eslint.config.mjs`, `components.json`, `.env.local.example`
- Create directory: `src/components/ui/`, `src/lib/`

- [ ] **Step 1: Scaffold Next.js app (non-interactive)**

Run from `/Users/thiagotavares/Projects/a-labs/tech`:

```bash
npx create-next-app@latest my-jira \
  --ts --tailwind --eslint --app \
  --src-dir --import-alias "@/*" \
  --no-turbopack --use-npm --skip-install \
  --yes
```

`my-jira` already exists (with docs/). `create-next-app` should write into it since it's mostly empty. If it refuses, back up `docs/` and `.git/`, let it scaffold, then restore them.

- [ ] **Step 2: Install runtime dependencies**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/my-jira
npm install \
  @supabase/ssr @supabase/supabase-js \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  sonner lucide-react \
  class-variance-authority clsx tailwind-merge
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D @types/node
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

Answer any prompts: style = "new-york" (default), base color = "neutral", CSS variables = yes.

This creates `components.json`, adds CSS variables to `globals.css`, and creates `src/lib/utils.ts`.

- [ ] **Step 5: Add the shadcn components we'll need**

```bash
npx shadcn@latest add button dialog input textarea label dropdown-menu sonner badge select
```

- [ ] **Step 6: Create `.env.local.example`**

```
# Copy to .env.local and fill in from Supabase dashboard (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Replace scaffolded home page with placeholder**

Overwrite `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">my-jira scaffolding ready.</p>
    </main>
  );
}
```

- [ ] **Step 8: Update root layout to mount the Sonner Toaster**

Edit `src/app/layout.tsx`. Replace its body JSX so it looks like:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "my-jira",
  description: "Personal Kanban board",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Manual validation**

Run:

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: "my-jira scaffolding ready." renders, no console errors. Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js + Tailwind + shadcn/ui + deps"
```

---

## Task 2: Supabase schema, RLS, and triggers

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration via the Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- `name`: `0001_init`
- `query`: the contents of `supabase/migrations/0001_init.sql`

(If no Supabase project is linked yet, first prompt the user for the project reference and instruct them to run `npx supabase link --project-ref <ref>` locally. Then retry.)

- [ ] **Step 3: Verify tables exist**

Use `mcp__supabase__list_tables` with `schemas: ["public"]`. Expected: `projects`, `board_columns`, `tasks` listed.

- [ ] **Step 4: Create your user in Supabase Auth**

Tell the user to go to Supabase Dashboard → Authentication → Users → "Add user" → email = `thiagodevtavares@gmail.com`, check "Auto-confirm user". Also: Authentication → Providers → Email → **disable** "Enable sign ups".

- [ ] **Step 5: Verify default-column seed trigger works**

Use `mcp__supabase__execute_sql` to insert a dummy project under your user and confirm columns are seeded:

```sql
-- Replace <USER_UUID> with the id from auth.users
insert into public.projects (owner_id, name) values ('<USER_UUID>', '__seed_test__') returning id;
-- then
select name, position, is_default
from public.board_columns
where project_id = '<PROJECT_ID_FROM_ABOVE>'
order by position;
```

Expected: three rows: `To Do/1/true`, `In Progress/2/true`, `Done/3/true`.

Clean up: `delete from public.projects where name = '__seed_test__';` (cascades to columns).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial schema with RLS and triggers"
```

---

## Task 3: Supabase clients, env, and middleware

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`, `middleware.ts`, `.env.local`

- [ ] **Step 1: Create the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create the server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create the middleware helper**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Wire the middleware**

Create `middleware.ts` at the repo root (not inside `src/`):

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Fill `.env.local`**

Copy `.env.local.example` to `.env.local` and fill in the user's Supabase URL and anon key (from Supabase Dashboard → Project Settings → API).

- [ ] **Step 6: Manual validation**

Start dev server: `npm run dev`. Visit `http://localhost:3000`. Expected: redirected to `/login` (which doesn't exist yet — a 404 is acceptable for now; the key signal is the `/login` URL in the address bar). Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase middleware.ts .env.local.example
git commit -m "feat(auth): supabase clients and route protection middleware"
```

---

## Task 4: Login page and magic-link callback

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the login page shell (server component)**

Create `src/app/login/page.tsx`:

```tsx
import LoginForm from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">my-jira</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in with a magic link.
        </p>
        <LoginForm searchParamsPromise={searchParams} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the client-side login form**

Create `src/app/login/login-form.tsx`:

```tsx
"use client";

import { use, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ error?: string }>;
}) {
  const params = use(searchParamsPromise);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm">
        Check your inbox. Click the link to sign in.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {params.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {params.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send magic link"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the magic-link callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    const redirect = new URL("/login", url.origin);
    redirect.searchParams.set("error", "Missing auth code.");
    return NextResponse.redirect(redirect);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const redirect = new URL("/login", url.origin);
    redirect.searchParams.set("error", error.message);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
```

- [ ] **Step 4: Configure Supabase redirect URLs**

Tell the user to add, in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
- `http://localhost:3000/auth/callback`
- `https://my-board.aralabs.com.br/auth/callback`

- [ ] **Step 5: Manual validation**

Start `npm run dev`. Open `/login`. Enter your email. Expected:
1. "Check your inbox" message appears.
2. Email arrives with a magic link.
3. Clicking the link lands on `/` (which will still be the placeholder).
4. Refreshing `/` stays on `/` (session persists).
5. Manually delete cookies → refreshing `/` redirects to `/login`.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/auth
git commit -m "feat(auth): magic-link login and callback"
```

---

## Task 5: Header component and logout

**Files:**
- Create: `src/components/header.tsx`, `src/app/actions-auth.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the sign-out server action**

Create `src/app/actions-auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Create the Header component**

Create `src/components/header.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions-auth";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-2">
      <Link href="/" className="text-sm font-semibold">
        my-jira
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{user.email}</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Mount Header in the root layout**

Edit `src/app/layout.tsx`. Replace the `<body>` contents so the Header sits above `{children}`:

```tsx
<body className="font-sans antialiased bg-[#F4F5F7] min-h-screen">
  {/* @ts-expect-error Async Server Component */}
  <Header />
  {children}
  <Toaster />
</body>
```

Add `import { Header } from "@/components/header";` at the top.

Note: on the login page we don't want the header. Easiest fix: have `Header()` return `null` when there's no user (already does above). `/login` has no user, so the header is hidden.

- [ ] **Step 4: Manual validation**

Run `npm run dev`. Log in via magic link. Expected:
- Header appears on `/` with your email and a "Sign out" button.
- Clicking "Sign out" lands on `/login` and the session is cleared.

- [ ] **Step 5: Commit**

```bash
git add src/components/header.tsx src/app/actions-auth.ts src/app/layout.tsx
git commit -m "feat(ui): app header with user email and sign out"
```

---

## Task 6: Projects list and CRUD

**Files:**
- Create: `src/app/actions.ts`, `src/components/project-card.tsx`, `src/components/project-form-dialog.tsx`, `src/components/project-card-menu.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the project Server Actions**

Create `src/app/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function createProject(name: string, description?: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("projects")
    .insert({ owner_id: user.id, name: name.trim(), description: description?.trim() || null });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function renameProject(
  id: string,
  name: string,
  description?: string,
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  redirect("/");
}
```

- [ ] **Step 2: Create the ProjectFormDialog**

Create `src/components/project-form-dialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createProject, renameProject } from "@/app/actions";

type Props =
  | { mode: "create"; trigger: React.ReactNode }
  | {
      mode: "edit";
      trigger: React.ReactNode;
      project: { id: string; name: string; description: string | null };
    };

export function ProjectFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.mode === "edit" ? props.project.name : "");
  const [description, setDescription] = useState(
    props.mode === "edit" ? (props.project.description ?? "") : "",
  );
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createProject(name, description)
          : await renameProject(props.project.id, name, description);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Project created" : "Project updated");
      setOpen(false);
      if (props.mode === "create") {
        setName("");
        setDescription("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New project" : "Edit project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create a project-card menu for rename/delete**

Create `src/components/project-card-menu.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectFormDialog } from "./project-form-dialog";
import { deleteProject } from "@/app/actions";
import { toast } from "sonner";

export function ProjectCardMenu({
  project,
}: {
  project: { id: string; name: string; description: string | null };
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${project.name}" and all its tasks?`)) return;
    startTransition(async () => {
      const res = await deleteProject(project.id);
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.preventDefault()}
        className="rounded p-1 hover:bg-neutral-100"
        aria-label="Project actions"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
        <ProjectFormDialog
          mode="edit"
          project={project}
          trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
        />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700"
          onSelect={onDelete}
          disabled={pending}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Create the ProjectCard**

Create `src/components/project-card.tsx`:

```tsx
import Link from "next/link";
import { ProjectCardMenu } from "./project-card-menu";

export function ProjectCard({
  project,
}: {
  project: { id: string; name: string; description: string | null };
}) {
  return (
    <div className="relative rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="absolute right-2 top-2">
        <ProjectCardMenu project={project} />
      </div>
      <Link href={`/projects/${project.id}`} className="block">
        <h3 className="mb-1 pr-8 text-sm font-semibold">{project.name}</h3>
        {project.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
        )}
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the home page**

Overwrite `src/app/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/project-card";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <ProjectFormDialog
          mode="create"
          trigger={
            <Button size="sm">
              <Plus className="mr-1 size-4" /> New project
            </Button>
          }
        />
      </div>

      {!projects || projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Manual validation**

Run `npm run dev`. Logged in, visit `/`. Expected:
- "No projects yet." shown initially.
- Click "New project" → fill in name + description → Save → card appears; toast "Project created".
- Hover card menu → "Rename" → edit → Save → card updates.
- Menu → "Delete" → confirm → card disappears (project and its auto-created columns are cascaded).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/actions.ts src/components/project-card.tsx src/components/project-card-menu.tsx src/components/project-form-dialog.tsx
git commit -m "feat(projects): list, create, rename, delete projects"
```

---

## Task 7: Board page shell + columns CRUD

**Files:**
- Create: `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/actions.ts`, `src/components/board/column-form-dialog.tsx`, `src/components/board/board-static.tsx` (temporary — replaced in Task 9)

- [ ] **Step 1: Write column Server Actions**

Create `src/app/projects/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function createColumn(projectId: string, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("board_columns")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (maxRow?.position ?? 0) + 1;

  const { error } = await supabase.from("board_columns").insert({
    project_id: projectId,
    name: name.trim(),
    position: nextPos,
    is_default: false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function renameColumn(id: string, name: string, projectId: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_columns")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteColumn(id: string, projectId: string): Promise<Result> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Move or delete tasks in this column first." };
  }

  const { error } = await supabase.from("board_columns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function reorderColumns(projectId: string, orderedIds: string[]): Promise<Result> {
  const supabase = await createClient();
  // Two-phase to avoid unique-position conflicts if we ever add a unique constraint.
  const updates = orderedIds.map((id, i) =>
    supabase.from("board_columns").update({ position: i + 1 }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Create the ColumnFormDialog**

Create `src/components/board/column-form-dialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createColumn, renameColumn } from "@/app/projects/[id]/actions";

type Props =
  | { mode: "create"; projectId: string; trigger: React.ReactNode }
  | { mode: "rename"; projectId: string; trigger: React.ReactNode; column: { id: string; name: string } };

export function ColumnFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.mode === "rename" ? props.column.name : "");
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createColumn(props.projectId, name)
          : await renameColumn(props.column.id, name, props.projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      if (props.mode === "create") setName("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New column" : "Rename column"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="column-name">Name</Label>
            <Input id="column-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create a temporary static board (no drag-drop yet)**

Create `src/components/board/board-static.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ColumnFormDialog } from "./column-form-dialog";
import { deleteColumn } from "@/app/projects/[id]/actions";
import { toast } from "sonner";

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
};

export function BoardStatic({
  projectId,
  columns,
}: {
  projectId: string;
  columns: ColumnRow[];
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((c) => (
        <Column key={c.id} projectId={projectId} column={c} />
      ))}
      <ColumnFormDialog
        mode="create"
        projectId={projectId}
        trigger={
          <Button
            variant="outline"
            className="h-10 shrink-0 self-start bg-white/60"
          >
            <Plus className="mr-1 size-4" /> New column
          </Button>
        }
      />
    </div>
  );
}

function Column({ projectId, column }: { projectId: string; column: ColumnRow }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete column "${column.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteColumn(column.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {column.name}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 hover:bg-neutral-200" aria-label="Column actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ColumnFormDialog
              mode="rename"
              projectId={projectId}
              column={column}
              trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
            />
            {!column.is_default && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-red-600 focus:text-red-700"
                disabled={pending}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2">
        {/* Tasks rendered in Task 8 */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the board page (server component)**

Create `src/app/projects/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardStatic } from "@/components/board/board-static";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name, position, is_default")
    .eq("project_id", id)
    .order("position");

  return (
    <main className="mx-auto max-w-[1400px] p-4">
      <nav className="mb-3 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Projects</Link>
        <span className="mx-1">/</span>
        <span className="text-neutral-700">{project.name}</span>
      </nav>
      <BoardStatic projectId={project.id} columns={columns ?? []} />
    </main>
  );
}
```

- [ ] **Step 5: Manual validation**

Run `npm run dev`. Open a project you created earlier. Expected:
- Three columns: "To Do", "In Progress", "Done", in order.
- Default columns have a menu with only "Rename" (no "Delete").
- Click "New column" → "Review" → Save → a 4th column appears with a full menu.
- On the new "Review" column, click menu → "Delete" → confirm → column disappears.
- Rename "To Do" → "Backlog" → Save → header updates.

- [ ] **Step 6: Commit**

```bash
git add src/app/projects src/components/board
git commit -m "feat(board): project page with column CRUD (no drag-drop yet)"
```

---

## Task 8: Task CRUD (cards + detail dialog) without drag-drop

**Files:**
- Create: `src/lib/utils/position.ts`, `src/lib/utils/label-color.ts`, `src/components/board/task-card.tsx`, `src/components/board/task-dialog.tsx`
- Modify: `src/app/projects/[id]/actions.ts`, `src/components/board/board-static.tsx`, `src/app/projects/[id]/page.tsx`

- [ ] **Step 1: Position helpers**

Create `src/lib/utils/position.ts`:

```ts
// Compute a new position between two existing positions (or at the ends).
// Works for both column and task ordering.
export function midpoint(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return (next as number) - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}
```

- [ ] **Step 2: Label color helper**

Create `src/lib/utils/label-color.ts`:

```ts
// Stable hue from a label string.
export function labelColor(label: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return {
    bg: `hsl(${hue} 70% 88%)`,
    fg: `hsl(${hue} 45% 28%)`,
  };
}
```

- [ ] **Step 3: Add task Server Actions**

Append to `src/app/projects/[id]/actions.ts`:

```ts
import { midpoint } from "@/lib/utils/position";

// ---- Tasks ----

export async function createTask(
  projectId: string,
  columnId: string,
  title: string,
): Promise<Result> {
  if (!title.trim()) return { ok: false, error: "Title is required" };
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = midpoint(maxRow?.position ?? null, null);

  const { error } = await supabase.from("tasks").insert({
    column_id: columnId,
    title: title.trim(),
    position: nextPos,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateTask(
  projectId: string,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high";
    label?: string | null;
  },
): Promise<Result> {
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "Title cannot be empty" };
  }
  const cleaned: Record<string, unknown> = { ...patch };
  if (typeof cleaned.title === "string") cleaned.title = (cleaned.title as string).trim();
  if (typeof cleaned.description === "string")
    cleaned.description = (cleaned.description as string).trim() || null;
  if (typeof cleaned.label === "string")
    cleaned.label = (cleaned.label as string).trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(cleaned).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteTask(projectId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function moveTask(
  projectId: string,
  id: string,
  newColumnId: string,
  newPosition: number,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ column_id: newColumnId, position: newPosition })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Create the TaskCard**

Create `src/components/board/task-card.tsx`:

```tsx
"use client";

import { ChevronDown, Minus, ChevronUp } from "lucide-react";
import { labelColor } from "@/lib/utils/label-color";

export type TaskRow = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  label: string | null;
  position: number;
};

const priorityIcon = {
  low: <ChevronDown className="size-3.5 text-blue-600" />,
  medium: <Minus className="size-3.5 text-amber-500" />,
  high: <ChevronUp className="size-3.5 text-red-600" />,
} as const;

export function TaskCard({
  task,
  onClick,
}: {
  task: TaskRow;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded border border-neutral-200 bg-white p-2 text-[13px] shadow-sm transition hover:shadow-md"
    >
      {task.label && (
        <span
          className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={labelColor(task.label)}
        >
          {task.label}
        </span>
      )}
      <p className="line-clamp-2 font-medium leading-snug text-neutral-800">
        {task.title}
      </p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{task.id.slice(0, 6)}</span>
        {priorityIcon[task.priority]}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the TaskDialog**

Create `src/components/board/task-dialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateTask, deleteTask } from "@/app/projects/[id]/actions";
import type { TaskRow } from "./task-card";

export function TaskDialog({
  projectId,
  task,
  open,
  onOpenChange,
}: {
  projectId: string;
  task: TaskRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskRow["priority"]>(task.priority);
  const [label, setLabel] = useState(task.label ?? "");
  const [pending, startTransition] = useTransition();

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateTask(projectId, task.id, {
        title,
        description,
        priority,
        label,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOpenChange(false);
    });
  }

  function onDelete() {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteTask(projectId, task.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskRow["priority"])}>
                <SelectTrigger id="t-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-label">Label</Label>
              <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. bug" />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Render cards + add-task inside the static board**

Replace `src/components/board/board-static.tsx` entirely with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnFormDialog } from "./column-form-dialog";
import { TaskCard, type TaskRow } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { createTask, deleteColumn } from "@/app/projects/[id]/actions";
import { toast } from "sonner";

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
};

export function BoardStatic({
  projectId,
  columns,
  tasks,
}: {
  projectId: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
}) {
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((c) => (
          <Column
            key={c.id}
            projectId={projectId}
            column={c}
            tasks={tasks.filter((t) => t.column_id === c.id).sort((a, b) => a.position - b.position)}
            onTaskClick={setOpenTask}
          />
        ))}
        <ColumnFormDialog
          mode="create"
          projectId={projectId}
          trigger={
            <Button variant="outline" className="h-10 shrink-0 self-start bg-white/60">
              <Plus className="mr-1 size-4" /> New column
            </Button>
          }
        />
      </div>
      {openTask && (
        <TaskDialog
          projectId={projectId}
          task={openTask}
          open
          onOpenChange={(o) => !o && setOpenTask(null)}
        />
      )}
    </>
  );
}

function Column({
  projectId,
  column,
  tasks,
  onTaskClick,
}: {
  projectId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  onTaskClick: (t: TaskRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function onDelete() {
    if (!confirm(`Delete column "${column.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteColumn(column.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createTask(projectId, column.id, title);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {column.name}
          <span className="ml-2 font-normal text-neutral-500">{tasks.length}</span>
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 hover:bg-neutral-200" aria-label="Column actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ColumnFormDialog
              mode="rename"
              projectId={projectId}
              column={column}
              trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
            />
            {!column.is_default && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-red-600 focus:text-red-700"
                disabled={pending}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-[40px] flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
        ))}
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="mt-2 space-y-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setAdding(false); setTitle(""); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 rounded px-1 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-200"
        >
          <Plus className="size-3.5" /> Add a card
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Pass tasks into the board on the server page**

Edit `src/app/projects/[id]/page.tsx`. Replace the page body so it also fetches tasks and passes them in:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardStatic } from "@/components/board/board-static";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: columns }, { data: tasks }] = await Promise.all([
    supabase
      .from("board_columns")
      .select("id, name, position, is_default")
      .eq("project_id", id)
      .order("position"),
    supabase
      .from("tasks")
      .select("id, column_id, title, description, priority, label, position")
      .in(
        "column_id",
        (
          await supabase
            .from("board_columns")
            .select("id")
            .eq("project_id", id)
        ).data?.map((c) => c.id) ?? [],
      ),
  ]);

  return (
    <main className="mx-auto max-w-[1400px] p-4">
      <nav className="mb-3 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Projects</Link>
        <span className="mx-1">/</span>
        <span className="text-neutral-700">{project.name}</span>
      </nav>
      <BoardStatic
        projectId={project.id}
        columns={columns ?? []}
        tasks={tasks ?? []}
      />
    </main>
  );
}
```

- [ ] **Step 8: Manual validation**

Run `npm run dev`. Expected:
- On the board: click "Add a card" in any column → type "First task" → Add → card appears with the title.
- Click the card → dialog opens with title/description/priority/label fields → change priority to High, add label "bug", add description, Save → dialog closes and the card shows a red ▲ icon and a "bug" pill.
- Click the card → Delete → confirm → card disappears.
- Add a few cards across columns to validate ordering (newest goes to bottom).

- [ ] **Step 9: Commit**

```bash
git add src/app/projects src/components/board src/lib/utils
git commit -m "feat(tasks): task CRUD with detail dialog"
```

---

## Task 9: Drag-and-drop (cards and columns)

**Files:**
- Create: `src/app/projects/[id]/board.tsx`, `src/components/board/board-column.tsx`
- Modify: `src/components/board/task-card.tsx`, `src/app/projects/[id]/page.tsx`
- Delete: `src/components/board/board-static.tsx` (superseded)

- [ ] **Step 1: Make TaskCard sortable-aware (accept listeners via props)**

The draggable wiring lives in the parent (`BoardColumn`) using `useSortable`. `TaskCard` stays dumb but accepts an optional `dragHandleProps` prop so the whole card is the handle. Replace `src/components/board/task-card.tsx` with:

```tsx
"use client";

import { ChevronDown, Minus, ChevronUp } from "lucide-react";
import type { HTMLAttributes } from "react";
import { labelColor } from "@/lib/utils/label-color";

export type TaskRow = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  label: string | null;
  position: number;
};

const priorityIcon = {
  low: <ChevronDown className="size-3.5 text-blue-600" />,
  medium: <Minus className="size-3.5 text-amber-500" />,
  high: <ChevronUp className="size-3.5 text-red-600" />,
} as const;

export function TaskCard({
  task,
  onClick,
  dragHandleProps,
  isDragging,
}: {
  task: TaskRow;
  onClick?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}) {
  return (
    <div
      {...dragHandleProps}
      onClick={onClick}
      className={`cursor-grab rounded border border-neutral-200 bg-white p-2 text-[13px] shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {task.label && (
        <span
          className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={labelColor(task.label)}
        >
          {task.label}
        </span>
      )}
      <p className="line-clamp-2 font-medium leading-snug text-neutral-800">{task.title}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{task.id.slice(0, 6)}</span>
        {priorityIcon[task.priority]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the sortable BoardColumn**

Create `src/components/board/board-column.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnFormDialog } from "./column-form-dialog";
import { TaskCard, type TaskRow } from "./task-card";
import { createTask, deleteColumn } from "@/app/projects/[id]/actions";
import { toast } from "sonner";
import type { ColumnRow } from "@/app/projects/[id]/board";

export function SortableTaskCard({
  task,
  onClick,
}: {
  task: TaskRow;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export function BoardColumn({
  projectId,
  column,
  tasks,
  onTaskClick,
}: {
  projectId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  onTaskClick: (t: TaskRow) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: "column", column } });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  function onDelete() {
    if (!confirm(`Delete column "${column.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteColumn(column.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createTask(projectId, column.id, title);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
            aria-label="Drag column"
          >
            <GripVertical className="size-3.5" />
          </button>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {column.name}
            <span className="ml-2 font-normal text-neutral-500">{tasks.length}</span>
          </h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 hover:bg-neutral-200" aria-label="Column actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ColumnFormDialog
              mode="rename"
              projectId={projectId}
              column={column}
              trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
            />
            {!column.is_default && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-red-600 focus:text-red-700"
                disabled={pending}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={setDroppableRef} className="flex min-h-[40px] flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
          ))}
        </SortableContext>
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="mt-2 space-y-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => { setAdding(false); setTitle(""); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 rounded px-1 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-200"
        >
          <Plus className="size-3.5" /> Add a card
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the Board client component with DndContext**

Create `src/app/projects/[id]/board.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardColumn } from "@/components/board/board-column";
import { ColumnFormDialog } from "@/components/board/column-form-dialog";
import { TaskCard, type TaskRow } from "@/components/board/task-card";
import { TaskDialog } from "@/components/board/task-dialog";
import { moveTask, reorderColumns } from "./actions";
import { midpoint } from "@/lib/utils/position";
import { toast } from "sonner";

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
};

export function Board({
  projectId,
  initialColumns,
  initialTasks,
}: {
  projectId: string;
  initialColumns: ColumnRow[];
  initialTasks: TaskRow[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  function onDragStart(e: DragStartEvent) {
    const { active } = e;
    if (active.data.current?.type === "task") {
      setActiveTask(active.data.current.task as TaskRow);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Column reorder
    if (activeType === "column" && overType === "column" && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      const next = arrayMove(columns, oldIndex, newIndex);
      setColumns(next);
      startTransition(async () => {
        const res = await reorderColumns(projectId, next.map((c) => c.id));
        if (!res.ok) {
          toast.error(res.error);
          setColumns(columns); // revert
        }
      });
      return;
    }

    // Task move (drop on task OR on a column's droppable area)
    if (activeType === "task") {
      const draggedId = active.id as string;
      const dragged = tasks.find((t) => t.id === draggedId);
      if (!dragged) return;

      let targetColumnId: string;
      let insertBeforeTaskId: string | null = null;

      if (overType === "task") {
        const overTask = over.data.current!.task as TaskRow;
        targetColumnId = overTask.column_id;
        insertBeforeTaskId = overTask.id;
      } else if (overType === "column-drop") {
        targetColumnId = over.data.current!.columnId as string;
        insertBeforeTaskId = null; // drop at end
      } else {
        return;
      }

      // Compute neighbors in the target column AFTER removing the dragged task.
      const colTasks = tasks
        .filter((t) => t.column_id === targetColumnId && t.id !== draggedId)
        .sort((a, b) => a.position - b.position);

      let prev: TaskRow | null = null;
      let next: TaskRow | null = null;
      if (insertBeforeTaskId) {
        const idx = colTasks.findIndex((t) => t.id === insertBeforeTaskId);
        prev = idx > 0 ? colTasks[idx - 1] : null;
        next = colTasks[idx] ?? null;
      } else {
        prev = colTasks[colTasks.length - 1] ?? null;
      }

      const newPosition = midpoint(prev?.position ?? null, next?.position ?? null);

      // Optimistic update
      const prevState = tasks;
      setTasks((ts) =>
        ts.map((t) =>
          t.id === draggedId ? { ...t, column_id: targetColumnId, position: newPosition } : t,
        ),
      );

      startTransition(async () => {
        const res = await moveTask(projectId, draggedId, targetColumnId, newPosition);
        if (!res.ok) {
          toast.error(res.error);
          setTasks(prevState); // revert
        }
      });
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map((c) => (
              <BoardColumn
                key={c.id}
                projectId={projectId}
                column={c}
                tasks={tasks
                  .filter((t) => t.column_id === c.id)
                  .sort((a, b) => a.position - b.position)}
                onTaskClick={setOpenTask}
              />
            ))}
          </SortableContext>
          <ColumnFormDialog
            mode="create"
            projectId={projectId}
            trigger={
              <Button variant="outline" className="h-10 shrink-0 self-start bg-white/60">
                <Plus className="mr-1 size-4" /> New column
              </Button>
            }
          />
        </div>
        <DragOverlay>{activeTask && <TaskCard task={activeTask} />}</DragOverlay>
      </DndContext>

      {openTask && (
        <TaskDialog
          projectId={projectId}
          task={openTask}
          open
          onOpenChange={(o) => !o && setOpenTask(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Swap BoardStatic out on the server page**

Edit `src/app/projects/[id]/page.tsx`. Change the import and the rendered component:

```tsx
import { Board } from "./board";
// remove: import { BoardStatic } from "@/components/board/board-static";
```

And replace `<BoardStatic ... />` with:

```tsx
<Board
  projectId={project.id}
  initialColumns={columns ?? []}
  initialTasks={tasks ?? []}
/>
```

- [ ] **Step 5: Delete the obsolete static board**

```bash
rm src/components/board/board-static.tsx
```

- [ ] **Step 6: Manual validation**

Run `npm run dev`. Expected:
- Drag a task from "To Do" to "In Progress" — card moves; refresh the page — card stays in new column (persisted).
- Drag a card within the same column to reorder — order persists after refresh.
- Drag a whole column (grab the `GripVertical` icon) — columns reorder; persists after refresh.
- Default columns still cannot be deleted (menu doesn't show the Delete option for them).
- If you drop a card onto an empty column, it lands at the bottom (only task in that column).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(board): drag-and-drop for tasks and columns"
```

---

## Task 10: Jira-classic visual polish

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/board/task-card.tsx`, `src/components/header.tsx`

- [ ] **Step 1: Tune global typography and spacing**

Add or adjust the following in `src/app/globals.css`, right after the shadcn `@theme` block:

```css
html, body {
  font-size: 14px; /* denser, Jira-like */
  font-family: var(--font-inter), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background-color: #F4F5F7;
  color: #172B4D; /* Atlassian ink */
}
```

- [ ] **Step 2: Confirm root layout body class**

`src/app/layout.tsx` already sets `bg-[#F4F5F7] min-h-screen`. No change required unless the globals.css rule isn't applying. If colors don't match, remove the `bg-[#F4F5F7]` from the body and rely on globals.css so the color is defined in one place.

- [ ] **Step 3: Tighten Header styling**

Edit `src/components/header.tsx`. Replace the `<header>` element's className with:

```tsx
<header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 shadow-[0_1px_0_rgba(9,30,66,0.08)]">
```

- [ ] **Step 4: Add a description preview under the card title (if set)**

Edit `src/components/board/task-card.tsx`. Inside the card, after the title paragraph, add:

```tsx
{task.description && (
  <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{task.description}</p>
)}
```

- [ ] **Step 5: Manual validation**

Run `npm run dev`. Expected:
- App-wide font is 14px; ink color is a dark navy on a light gray canvas.
- Header has a subtle 1px bottom shadow; it sticks when you scroll a long list.
- Task cards with a description show a two-line preview under the title.
- Side-by-side comparison with a Jira screenshot should feel visually close (colors, density).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "style: Jira-classic palette and density tweaks"
```

---

## Task 11: Production deploy to Vercel

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write a minimal README**

Create `README.md`:

```md
# my-jira

Personal Kanban board. Next.js 16 (App Router), Tailwind, shadcn/ui, Supabase (Postgres + Auth), dnd-kit.

## Local setup

1. `cp .env.local.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project.
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Database

Migrations live in `supabase/migrations/`. Apply them via Supabase CLI (`npx supabase db push`) or via the MCP server.

## Creating users

Sign-up is disabled. Create users manually:

- Supabase Dashboard → Authentication → Users → Add user (auto-confirm).

## Deploy

Vercel. Set the two `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel project. Add `my-board.aralabs.com.br` as a custom domain. Add `https://my-board.aralabs.com.br/auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs.
```

- [ ] **Step 2: Push to a new GitHub repo (prompt the user)**

Tell the user: "Create an empty GitHub repo named `my-jira` under your account, then run these from `my-jira/`:"

```bash
git remote add origin git@github.com:<USER>/my-jira.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Connect Vercel (user action)**

Tell the user: "In Vercel, Import Project → pick the `my-jira` repo. Set Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Deploy. Once live, Settings → Domains → add `my-board.aralabs.com.br`. Update your DNS (aralabs.com.br) with the CNAME Vercel provides."

- [ ] **Step 4: Update Supabase redirect URLs (user action)**

"In Supabase → Authentication → URL Configuration, add `https://my-board.aralabs.com.br/auth/callback` to Redirect URLs."

- [ ] **Step 5: Manual validation (production)**

Expected:
- Visit `https://my-board.aralabs.com.br` → redirect to `/login`.
- Magic-link email arrives, the link points to the production domain, and clicking it logs in.
- Creating a project + tasks on production persists (DB round-trip succeeds).

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and deploy instructions"
git push
```

---

## Self-Review summary

**Spec coverage checked against `2026-04-18-my-jira-design.md`:**

- §2 Scope (projects, columns, tasks, magic link, Jira visuals) — Tasks 1–10.
- §3 Architecture (Next 15 App Router, `@supabase/ssr`, `@dnd-kit`, `sonner`) — Task 1 installs, Task 3 wires middleware, Task 9 wires dnd-kit.
- §4 Data model (projects, board_columns with `is_default`, tasks, RLS, triggers) — Task 2.
- §5 Screens/routes (`/login`, `/auth/callback`, `/`, `/projects/[id]`) — Tasks 4, 6, 7.
- §6 Components — Tasks 5, 6, 7, 8, 9.
- §7 Server Actions (full list) — Tasks 5 (sign out), 6 (project actions), 7 (column actions), 8 (task actions including `moveTask`).
- §8 Visual design — Tasks 7, 8, 10.
- §9 Auth details (signup disabled, magic link, redirect URLs, first user via dashboard) — Tasks 2, 4, 11.
- §10 Env vars — Task 1 and Task 3.
- §11 Folder layout — matched across all tasks.
- §12 Error handling (toasts, callback error redirect, optimistic rollback) — Tasks 4, 6–9.
- §14 Success criteria — verified in manual-validation steps of each task.

**Placeholder scan:** no TBD/TODO; every code block is complete.

**Type consistency:** `ColumnRow` is declared in `board.tsx` (Task 9) and imported by `board-column.tsx`; `TaskRow` is declared in `task-card.tsx` and reused everywhere. Action signatures (`createTask(projectId, columnId, title)`, `moveTask(projectId, id, newColumnId, newPosition)`, etc.) match between definition (Task 8) and callers (Task 9).
