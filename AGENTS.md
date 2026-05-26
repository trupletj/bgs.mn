# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds App Router pages; authenticated views live under `app/(protected)/...`.
- `components/` collects reusable UI; primitives stay in `components/ui/`, and domain widgets (e.g., `components/orders/`) bundle feature logic.
- `actions/` wraps all Supabase reads/writes; prefer exporting focused server actions rather than calling Supabase from components.
- `utils/supabase/` defines browser, server, and admin clients; database config and SQL migrations live in `supabase/`.
- Shared helpers reside in `hooks/`, `lib/`, and `utils/`; static assets belong in `public/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server (port 3000); ensure Supabase environment variables are loaded.
- `npm run build` compiles the production bundle, and `npm run start` serves that build for staging checks.
- `npm run lint` applies the ESLint rules; run `npm run lint -- --fix` before opening a PR.
- Manage the local backend with the Supabase CLI: `supabase start` to boot services, `supabase db push` to apply migrations from `supabase/migrations/`.

## Coding Style & Naming Conventions
- The project is strict TypeScript on Next.js 15; default to React Server Components and gate client-side code with `"use client"`.
- Match existing naming: shared modules use kebab-case (`nav-user.tsx`), feature internals may opt for PascalCase (`OrderDetailView.tsx`), and hooks begin with `use`.
- Keep two-space indentation, rely on Tailwind utility ordering already in the repo, and favor composing primitives over bespoke styling.
- Import shared code through the `@/` alias to avoid brittle relative paths.

## Testing Guidelines
- Automated tests are pending; use the root smoke scripts (`test-auth.ts`, `test-orders.js`) via `npx tsx <script>` once Supabase keys are exported.
- Document manual checks covering OTP login, order creation, status updates, and reviewer assignment in `app/(protected)/`.
- When adding features, park lightweight test scripts beside the code and reference them in your PR.

## Commit & Pull Request Guidelines
- Follow the concise, present-tense commit style seen in history (e.g., `remote migration`, `workflow changed`) and keep each commit focused.
- PRs should include a brief summary, screenshots for UI edits, Supabase migration notes, environment variable changes, and a list of verification steps.

## Supabase & Environment Setup
- Store credentials in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Never commit service-role secrets; if policies change, describe rollback steps alongside the migration.
- Keep the schema synchronized by running `supabase db diff` before committing SQL updates.

## Recent Food Log / Supabase Notes
- A database overview document was added at `docs/supabase-database.md`; update it when schema ownership or major table groups change.
- `/dine` summary page had a hydration mismatch from implicit `toLocaleString()` formatting in `components/dine/food-log-summary-table.tsx`. Keep rendered timestamps deterministic: SSR now renders `---` first, then formats on client mount with `mn-MN` and `Asia/Ulaanbaatar`.
- `meal_logs.sub_employee_id` represents гэрээт/туслан компанийн QR-based meal logs. Regular employee logs should keep using `user_id` or `bteg_id`.
- `daily_meal_summary` now includes `sub_employee_total`, populated by `public.refresh_daily_meal_summary()`. The existing cron refreshes hourly, so avoid row-level summary refresh triggers on `meal_logs` unless real-time summary is required.
- Relevant migrations:
  - `supabase/migrations/20260501212114_add_sub_employee_meal_summary.sql`
  - `supabase/migrations/20260501212457_set_refresh_daily_meal_summary_search_path.sql`
- `/dine` uses `components/dine/food-log-summary-table.tsx` for the summary table. The `Гэрээт` column is clickable and opens `components/dine/sub-employee-meal-detail-modal.tsx`.
- `SubEmployeeMealDetailModal` has two modes:
  - summary mode: no `orgName`, shows all `meal_logs` for the selected `date + dining_hall_id` where `sub_employee_id is not null`;
  - breakdown mode: receives `orgName`, filters to one гэрээт company from the expanded breakdown.
- The expanded `/dine` breakdown still uses `get_meal_expected_vs_actual`. That RPC already includes `sub_employee_meal_plans` as expected counts and `meal_logs.sub_employee_id` as actual counts under `Гэрээт`.
- `expected plan-д орсон эсэх` in the sub-employee detail modal is currently company-level: it checks whether the company's `sub_employee_meal_plans` count for that meal type is greater than zero. The schema does not assign a per-person expected meal plan.
- Verification caveats from the implementation:
  - `npx eslint components/dine/sub-employee-meal-detail-modal.tsx components/dine/food-log-summary-table.tsx components/dine/meal-breakdown-row.tsx` passed.
  - Full `npm run lint` currently scans `.next` and many existing repo issues, so it fails for pre-existing/generated files.
  - `npx tsc --noEmit` currently fails on stale `.next/types/validator.ts` referencing removed `app/(protected)/dine/food-log/page.js`; clear/regenerate `.next` or fix the stale route state before using full typecheck as a gate.

## Recent Order System Notes
- `/orders` is the all-orders view and now redirects to `/orders/list` when `hasPermission("order", "access")` is false. Keep `/orders/list` as the regular user's own-orders fallback.
- Order process access control uses order type reviewer/purchase visibility rules. Super admin should be treated as all-access for order process filtering unless a task explicitly narrows that behavior.
- Purchase workflow is intentionally lightweight for now: fulfillment registration drives purchase status. Items without fulfillment are shown as `Захиалга хийгдээгүй`; any fulfillment in progress means `Захиалга хийгдэж байна`; all items completed/received means `Захиалга хэрэгжсэн`.
- `changes_requested` status name is intentionally kept as-is because renaming it would touch many places.

## Recent Policy Notes
- `policy_scope_targets` links policies to multiple heltes/alba targets. It is used by policy create/edit and `/policy/list` scope search.
- `/policy/legal-acts/[id]` now has an edit flow via `/policy/legal-acts/[id]/edit`, reusing `components/policy/legal-acts/legal-act-form.tsx` with prefilled values. The delete button uses `components/policy/legal-acts/legal-act-delete-button.tsx`; keep server-only actions out of client imports and pass server actions from the page.
- `policy_revision_targets.change_action` tracks legal-act audit actions: `updated`, `added`, `invalidated`, `deleted`. This is audit-only and must not automatically soft-delete `policy`, `section`, or `clause`. Migration: `supabase/migrations/20260523120000_add_policy_revision_target_change_action.sql`.
- `/policy/[policy_id]` legal-act history now groups all section/clause/policy markers by legal act. Updated/invalidated/deleted section and clause markers strike through the current text and show the legal act plus `change_note` below the affected item.
- The real clause-position table in the current database is `clause_job_position`, not `clause_position`. Some older code used the wrong name; prefer `clause_job_position` for new work.
- `/policy/[policy_id]` displays sections as collapsible accordion items. They open by default and can be collapsed section by section.
- Policy edit save was optimized through `actions/policy-document.ts` and `/api/policy/document`: editing sends one policy document payload instead of many section/clause requests.
- Relevant migration for policy save indexes: `supabase/migrations/20260503131000_add_policy_document_save_indexes.sql`. It should index `clause_job_position(clause_id)`, not `clause_position`.

## Recent Employees / Shift Notes
- Employee detail modal can show current shift info using `get_employee_shift_for_modal(p_bteg_id text)`, created in `supabase/migrations/20260503124500_add_employee_shift_lookup.sql`.
- Kiosk/user meal eligibility around overnight shifts depends on `get_users_with_stats()` choosing the correct shift day. The latest intended behavior is: previous overnight shift ending today can remain relevant until local `15:00`; otherwise use today's `day_date`.
- For meal and shift logic, use `Asia/Ulaanbaatar` local time explicitly. Do not rely on server UTC defaults for day-boundary decisions.

## MCP Notes
- Project MCP config exists at `.mcp.json` and points to Supabase MCP with project ref `ljlywyhpxsutvrdeyyla`.
- `curl https://mcp.supabase.com/mcp` returning `401` means the server is reachable and authentication is the missing step.
- If MCP tools do not appear, restart/reload the Codex/agent session from the repo root (`/home/aagiihhz/bgs.mn`) so `.mcp.json` is re-read, then complete the Supabase OAuth prompt.
