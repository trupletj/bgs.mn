# bgs.mn Constitution

Энэхүү constitution нь `bgs.mn` (Next.js web) төслийн зайлшгүй баримтлах зарчмуудыг тогтооно. `bgs.mn` нь `bgs-mobile-app`, `bgs-dining`-тэй нэг Supabase backend хуваалцдаг тул эдгээр зарчим нь нийтлэг `shared-context` репогийн дүрмүүдтэй нийцнэ.

## Core Principles

### I. Спек бол үнэний эх сурвалж (NON-NEGOTIABLE)

Код руу шууд орж эхлэхгүй. Feature бүр `specs/NNN-<нэр>/` дотор `spec.md` → `plan.md` → `tasks.md` дарааллаар явна. Спек батлагдсаны дараа л хэрэгжүүлнэ. Код нь спекийн илэрхийлэл — спек код-д биш, код спек-д үйлчилнэ. Спек, plan-ыг хамт тохирно (Discord thread → PR review); хэрэгжүүлэлтийг тус тусдаа.

### II. Хуваалцсан backend-ийн аюулгүй байдал (NON-NEGOTIABLE)

`bgs.mn`, `bgs-mobile-app`, `bgs-dining` гурав нэг Supabase project (`ljlywyhpxsutvrdeyyla`) хуваалцдаг. Schema-д хүрэх ЯМАР Ч өөрчлөлт (table, column, RPC, RLS, enum):
- Зөвхөн `#supabase-schema`-аар тохирно — хэзээ ч төслийн суваг дотор биш.
- `shared-context/SUPABASE_SCHEMA.md`-ийг шинэчилнэ.
- `types/db.ts`-ийг web + mobile ХОЁУЛАНД нь дахин үүсгэнэ.
- Migration cloud-only: MCP `apply_migration` (локал Supabase stack ашиглахгүй). Timestamped файл.

Нэг өөрчлөлт мартагдвал нөгөө хоёр төсөл эвдэрнэ — энэ нь хатуу checkpoint.

### III. Давхаргат өгөгдлийн хандалт

Component-аас шууд Supabase дуудахгүй. Бүх Supabase read/write нь `actions/` дотор (`"use server"`). `components/`-оос `utils/supabase/server.ts`-ийг шууд import хийхгүй. Action-ы return shape: `{ ok: true, ... } | { ok: false, error?, fieldErrors? }`. Mutation амжилттай болсны дараа `revalidatePath(path)` ЗААВАЛ дуудна. Admin (service-role) client-ийг component-аас хэзээ ч дуудахгүй.

### IV. RLS-first аюулгүй байдал

Бүх public table-д RLS асаалттай — аюулгүй байдлыг DB layer-т хийнэ, client дээр найдахгүй. `security definer` RPC бүрд `set search_path = public` ЗААВАЛ (search_path injection-аас сэргийлнэ). `profile.id` нь bigint (uuid биш) — `auth.uid()`-г `public.current_profile_id()` helper-ээр хөрвүүлнэ.

### V. UI тогтвортой байдал (Gold Standard)

`components/ui/*` (shadcn primitive)-ийг шууд засахгүй — composition хийнэ. Статусын өнгөний палитр: emerald (амжилт) · amber (хүлээгдэх) · indigo (info) · cyan (force) · destructive (татгалзах/устгах). Destructive үйлдэлд `confirm()` биш `AlertDialog`. Хориотой: gradient background/text, raw `<table>`/`<select>`, inline `style` (computed утгаас бусад), dynamic Tailwind class (`ml-${x}`). Хэрэглэгчид харагдах текст монгол хэлээр.

### VI. Type safety

`any` хориотой — `unknown` + narrow. DB row type-ийг `supabase gen types`-аас үүссэн `Database` type-аас импорт. Public API (action, hook export)-д return type тодорхой бичнэ. Default export-гүй, named export (refactor хялбар). `useEffect`-ийг сүүлийн арга болгох — data авахад Server Action ашиглана.

## Technology Constraints

Тогтмол стек (өөрчлөхөд `#decisions`-д ADR шаардлагатай):

- **Framework:** Next.js 16 (App Router, React Server Components)
- **Runtime:** React 19, TypeScript (strict)
- **UI:** shadcn/ui (Radix primitives) + Tailwind v4 + `tw-animate-css`
- **Backend:** Supabase (Postgres + Auth + SSR via `@supabase/ssr`)
- **Data:** Server Actions → Supabase; business логик RPC-д төвлөрнө
- **Tables:** `@tanstack/react-table` (`components/data-table.tsx`)
- **Forms:** `react-hook-form` + `zod`; **Toast:** sonner; **DnD:** dnd-kit
- **Auth:** Supabase Auth (OTP), middleware-д publishable key (anon key БИШ)

## Development Workflow

- Нэгж = feature: нэг feature = Discord thread (`#bgs-mn` дотор) = `specs/NNN-.../` = git branch (`001-...`). 1:1 таарна.
- Хуваалцсан гэрээ (DB schema, types, API)-г feature эхлэхээс өмнө тусад нь тохирч царцаана.
- Спек бүрт "Dependencies / Interfaces" хэсэг — өөр feature-тэй холболтыг тодорхой бичих.
- PR жижиг (~300 мөр), нөгөө хүн review → `main`. UI өөрчлөлтөд screenshot. Schema migration бол rollback step.
- Branch: `feat/<нэр>`, `fix/<нэр>`, `chore/<нэр>`. Commit: Conventional Commits санал болгоно.

## Governance

Энэ constitution нь бусад practice-аас давамгайлна. Зарчимтай зөрчилдвөл constitution-ыг баримтлах; зайлшгүй бол `#decisions`-д ADR-аар тэмдэглэж засна. PR/review бүр нийцлийг шалгана. Нарийн төвөгтэй шийдлийг үндэслэлтэй болгох (YAGNI). Runtime хөгжүүлэлтийн заавар: `CLAUDE.md` + `shared-context/`.

**Version**: 1.0.0 | **Ratified**: 2026-05-25 | **Last Amended**: 2026-05-25
