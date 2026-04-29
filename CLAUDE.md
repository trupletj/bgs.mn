# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BGS.MN — a Next.js 15 + Supabase internal management platform for a Mongolian company. It covers three main subsystems:

- **Orders** (`/orders`, `/order-processes`): Multi-step equipment spare-parts ordering with a configurable approval workflow.
- **Dine** (`/dine`): Dining hall / canteen management including food logs and meal overrides.
- **Policy** (`/policy`): Policy document management — policies contain sections which contain clauses; clauses are linked to job positions for compliance tracking and rating.

Supporting modules: Employees (`/employees`), Admin RBAC (`/admin`), Dashboard (`/dashboard`), Job Descriptions (`/dashboard/job-descriptions`).

The UI is Mongolian-language. Comments in server actions are frequently in Mongolian.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run start      # Serve production build
npm run lint       # ESLint (run before PRs)
npm run lint -- --fix  # Auto-fix lint issues

# Supabase local backend
supabase start           # Boot local Supabase services
supabase db push         # Apply migrations from supabase/migrations/
supabase db diff         # Check for schema drift before committing SQL

# Smoke tests (need env vars exported)
npx tsx test-auth.ts
node test-orders.js
```

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=   # NOT anon key — this is the publishable default key
SUPABASE_SERVICE_ROLE_KEY=                       # server-only, never expose to client
```

Note: The middleware and server clients both use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is not used here.

## Architecture

### Routing & Auth

- `app/page.tsx` — public login (OTP request form). Redirects to `/dashboard` if already authenticated.
- `app/otp/` — OTP verification step.
- `app/(protected)/layout.tsx` — checks `supabase.auth.getClaims()` and redirects to `/` if not authenticated. Fetches user profile and sidebar nav, then renders `AppSidebar`.
- All authenticated pages live under `app/(protected)/`.

Auth is OTP-based (email). Session lives in cookies managed by `@supabase/ssr`.

### Supabase Clients

Three clients, each for a different context:

| File | When to use |
|------|-------------|
| `utils/supabase/server.ts` | Server Components and Server Actions (uses `cookies()`) |
| `utils/supabase/client.ts` | Client Components (browser) |
| `utils/supabase/supabaseAdmin.ts` | Admin operations requiring service-role key (singleton, server-only) |

Use `createClient()` from `server.ts` in Server Actions marked `"use server"`. Do not call the admin client from components.

### RBAC

Two complementary mechanisms:

1. **Role-based** — `actions/rbac.ts` → `getUserRoles()` returns an array of role name strings (e.g., `hr_emp`, `monitoring_emp`, `super_admin`, `order_system`). Use `hasRole(roleOrArray)` for coarse-grained guards.
2. **Permission-based** — `hasPermission(module, action)` calls the Supabase RPC `has_permission`. Used for finer control (e.g., `hasPermission("dining", "access")`).

Sidebar navigation (`actions/nav.ts`) is built dynamically at render time by combining role and permission checks. Add new top-level sections there.

### Server Actions Pattern

All Supabase reads/writes happen in `actions/`. Pages call these functions directly (they are Server Components). Never import from `utils/supabase/server.ts` inside a `components/` file — go through an action instead.

Actions that mutate data should call `revalidatePath(path)` after success so the Next.js cache is invalidated.

### Order Workflow

The order system uses a process/step/reviewer model:

- `order_processes` — configurable workflow templates (e.g., "Emergency repair")
- `order_steps` — ordered steps within a process, each step has required roles (`order_step_roles`)
- `orders` — the submitted order
- `order_instances` — a running execution of a process for one order; tracks `current_step_order` and `status`
- `order_step_reviewers` — one row per person who must review the current step; status: `pending | approved | changes_requested | rejected | skipped`
- `sub_order_item` — created when a reviewer changes quantities during review

When an order is created (`createOrderWithInstace` in `actions/orders.ts`):
1. `orders` row inserted
2. `order_instances` row created (step 1, status `in_progress`)
3. Roles required for step 1 are fetched from `order_step_roles`
4. All profiles with those roles are fetched from `roles_profiles` and inserted into `order_step_reviewers`

### Policy Workflow

`policy` → `section[]` → `clause[]` → `clause_job_position[]` (links clauses to `job_position` rows with an `ActionType`: IMPLEMENTATION | MONITORING | VERIFICATION | DEPLOYMENT). Ratings are stored per `clause_job_position`.

### UI Stack

- **shadcn/ui** (`components/ui/`) — all base primitives. Do not style these files directly; compose them.
- **Tailwind v4** with `@tailwindcss/postcss`
- **Recharts** for charts
- **react-hook-form + zod** for forms
- **@tanstack/react-table** for data tables (`components/data-table.tsx`)
- **sonner** for toast notifications
- **dnd-kit** for drag-and-drop

### Naming Conventions

- Shared module files: `kebab-case.tsx` (e.g., `nav-user.tsx`)
- Domain component files may use PascalCase (e.g., `ClauseItem.tsx`, `OrdersList.tsx`)
- Hooks: `use-*.ts` prefix
- Import alias: `@/` maps to repo root — always use this instead of relative paths

## Key DB Tables (for quick reference)

| Table | Purpose |
|-------|---------|
| `profile` | Linked to Supabase auth user; holds `name`, `department_name`, `position_name` |
| `roles` / `roles_profiles` | Role definitions and user→role assignments |
| `permissions` / `role_permissions` | Permission definitions and role→permission assignments |
| `orders` / `order_items` | Order header and line items |
| `order_processes` / `order_steps` / `order_step_roles` | Workflow templates |
| `order_instances` / `order_step_reviewers` | Running workflow state |
| `sub_order_item` | Reviewer quantity adjustments |
| `policy` / `section` / `clause` | Policy document hierarchy |
| `job_position` / `clause_job_position` | Job role compliance linkage |
| `dining_hall` / `meal_override` | Dining subsystem |
