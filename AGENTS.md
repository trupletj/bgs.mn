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
