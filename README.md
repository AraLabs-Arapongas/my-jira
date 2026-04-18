# my-jira

Personal Kanban board. Next.js 16 (App Router), Tailwind v4, shadcn/ui, Supabase (Postgres + Auth), dnd-kit.

## Local setup

1. `cp .env.local.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project.
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Database

Migrations live in `supabase/migrations/`. Apply them either via Supabase CLI (`npx supabase db push`) or by pasting the SQL into the Supabase SQL Editor.

The schema covers:

- `projects` — owner-scoped via RLS (`owner_id = auth.uid()`)
- `board_columns` — per project, with `is_default` flag protecting the three seeded columns (`To Do`, `In Progress`, `Done`). A trigger seeds them on project insert; another trigger blocks `DELETE` when `is_default = true`.
- `tasks` — per column, with `updated_at` trigger and `position double precision` for drag-drop reordering via midpoint math.

## Creating users

Sign-up is disabled. Create users manually from the Supabase dashboard:

**Authentication → Users → Add user** (tick "Auto-confirm user").

Then **Authentication → Providers → Email** and disable "Enable sign ups".

## Auth redirect URLs

Add the following under **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:3000/auth/callback`
- `https://my-board.aralabs.com.br/auth/callback`

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.
5. **Settings → Domains** → add `my-board.aralabs.com.br`. Update your aralabs.com.br DNS with the CNAME Vercel provides.

## Stack

- Next.js 16.2 (App Router, Server Actions)
- React 19.2, TypeScript
- Tailwind CSS v4, shadcn/ui (base-ui under the hood)
- `@supabase/ssr`, `@supabase/supabase-js`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `sonner`, `lucide-react`
