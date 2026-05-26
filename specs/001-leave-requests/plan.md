# Implementation Plan: Чөлөөний хүсэлт (Leave Requests)

**Branch**: `001-leave-requests` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-leave-requests/spec.md`

## Summary

Mobile-аас одоо ажилладаг чөлөөний хүсэлтийн flat schema-г өргөтгөж, web дээр **олон шаттай configurable approval workflow** хэрэгжүүлнэ. Orders module-ын батлагдсан `process → step → step_role → instance → step_reviewer` загвараар явна. Хэрэгжүүлэх 4 гол хэсэг: (1) Supabase migration — `leave_requests`-д огнооны багана нэмэх + 5 workflow хүснэгт үүсгэх + RLS; (2) Server Action давхарга (`actions/leave-requests.ts`, `actions/leave-processes.ts`); (3) UI хуудас (request create / my list / review queue / detail / process admin); (4) Sidebar nav badge. UI болон workflow логик нь `components/orders/*`, `actions/orders.ts`, `actions/nav.ts`-ийг паттерн болгоно.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React 19.1, Next.js 16.0 (App Router)

**Primary Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`, `react-hook-form` ^7.62, `zod` ^4.1, `@tanstack/react-table`, `sonner` ^2, shadcn/ui (Radix), Tailwind v4, `recharts` (admin reporting хэрэгтэй биш), `dnd-kit` (process step reorder)

**Storage**: Supabase Postgres (cloud, project `ljlywyhpxsutvrdeyyla`). Хадгалах bucket: `leave-attachments` (одоо бий). Schema өөрчлөлт MCP `apply_migration`-аар cloud-руу шууд.

**Testing**: ESLint (`npm run lint`); manual smoke testing browser-оос (Playwright MCP — UI flow шалгахад); тус бүр server action-ы happy path болон permission-denied тохиолдол. Constitution-ы дагуу спек батлагдсаны дараа л код руу ордог тул unit test layer одоогийн төсөлд жилийн дотор хэвшээгүй.

**Target Platform**: Web (Chromium / Safari / Firefox), Next.js 16 server (Vercel-style), Supabase managed Postgres. Mobile-той схем нийцтэй (mobile апп ижил `leave_requests` table-аас уншина).

**Project Type**: Web application (Next.js App Router + Supabase backend). Mobile апп нь tertiary хэрэглэгч.

**Performance Goals**:
- Server Action p95 < 400 мс (Supabase round-trip + RLS check)
- Хуудсын анхны render TTI < 1.5 сек хяналтын жагсаалт (≤ 200 хүсэлт)
- Sidebar nav badge fetch < 200 мс (зөвхөн count query)

**Constraints**:
- Mobile апп-аас одоо илгээгдэж буй flat `pending/approved/rejected` хүсэлтүүд ажиллагаатай хэвээр үлдэх (FR-016).
- RLS-first — DB layer policy зөвхөн өөрийн хүсэлт, reviewer-ын хуваарилагдсан хүсэлт, admin-д бүгд.
- Файл хавсралт 10 МБ-аас хэтрэхгүй, PDF/JPG/PNG/DOCX.

**Scale/Scope**:
- ~500 ажилтан, ~50 идэвхтэй reviewer, жилд ~2,000 хүсэлт төлөвлөгдөж байна.
- 4 чөлөөний төрөл x дунджаар 2 шат = 8 process step (admin тохируулна).
- Хуудас: 5 шинэ маршрут (`/leave-requests`, `/leave-requests/add`, `/leave-requests/review`, `/leave-requests/[id]`, `/leave-request-processes`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Зарчим | Үнэлгээ | Тэмдэглэл |
|---|---|---|
| **I. Спек бол үнэний эх сурвалж** | ✅ Pass | `spec.md` баталгаажсан, plan үүнийг ил тод хөрвүүлж байна. |
| **II. Хуваалцсан backend аюулгүй байдал** | ⚠️ Action required | Schema өөрчлөлтийг `#supabase-schema`-аар тохирох (migration apply хийхээс өмнө). `shared-context/SUPABASE_SCHEMA.md` болон `types/db.ts`-ийг web + mobile хоёуланд нь шинэчилнэ. Plan-д Phase 1.5 ("Schema coordination") гэж тусгасан. |
| **III. Давхаргат өгөгдлийн хандалт** | ✅ Pass | Бүх Supabase дуудлага `actions/leave-*` доторх. Return shape `{ ok, ... }`. Mutation бүрд `revalidatePath`. |
| **IV. RLS-first** | ✅ Pass | 6 шинэ хүснэгт бүрд RLS асаах. `security definer` RPC хэрэглэхгүй (logic нь action-уудад үлдэх). Хэрэв RPC шаардлагатай бол `set search_path = public` тавина. `profile.id` (bigint) болон `auth.uid()` (uuid)-г холбохдоо одоо байгаа `public.current_profile_id()` helper-ыг ашиглана. |
| **V. UI тогтвортой байдал** | ✅ Pass | shadcn primitives composition. Статусын өнгө: amber=pending/in_review, emerald=approved, destructive=rejected, indigo=info badge. Destructive үйлдэлд `AlertDialog`. Gradient/raw select/inline style хориглоно. Бүх текст монголоор. |
| **VI. Type safety** | ✅ Pass | `any` хориотой. `Database` type-ийг `types/db.ts`-аас. Action бүрд explicit return type. Named export. `useEffect` зөвхөн client-only side effect-д. |

**Result**: PASS (Зарчим II-ийн дагуу schema coordination алхам plan-д тусгагдсан). Дизайн дараах Phase 1-ийн дараа дахин шалгана.

## Project Structure

### Documentation (this feature)

```text
specs/001-leave-requests/
├── plan.md              # Энэ файл
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── server-actions.md
│   └── ui-routes.md
├── checklists/
│   └── requirements.md  # Аль хэдийн үүссэн
└── tasks.md             # Phase 2 (/speckit-tasks-аар үүснэ)
```

### Source Code (repository root)

```text
app/(protected)/
├── leave-requests/
│   ├── page.tsx                    # Миний хүсэлтүүд + бүх (permission-дагуу)
│   ├── add/page.tsx                # Шинэ хүсэлт үүсгэх форм
│   ├── review/page.tsx             # Reviewer-ын "Хүлээгдэж буй / Хянагдсан" tabs
│   └── [id]/page.tsx               # Хүсэлтийн дэлгэрэнгүй + workflow + actions
└── leave-request-processes/
    ├── page.tsx                    # Process жагсаалт (super_admin)
    ├── new/page.tsx                # Шинэ process + leave type сонгох
    └── [id]/edit/page.tsx          # Process + step + step_role засах (dnd-kit)

actions/
├── leave-requests.ts               # createLeaveRequestWithInstance, getMyLeaveRequests,
│                                   # getAwaitingLeaveRequests, getLeaveRequestWithDetail,
│                                   # approveLeaveStep, rejectLeaveStep, cancelLeaveRequest,
│                                   # getPendingLeaveReviewCountForCurrentUser
├── leave-processes.ts              # CRUD: leave_request_processes, _steps, _step_roles, leave_types
└── nav.ts                          # MODIFIED: leave permission/badge integration

components/
├── leave-requests/
│   ├── leave-request-create-form.tsx
│   ├── leave-requests-list.tsx     # data-table wrapper
│   ├── leave-request-detail-view.tsx
│   ├── leave-request-workflow.tsx  # step indicator (orders-ын pattern)
│   ├── leave-request-review-actions.tsx  # Approve/Reject + tailbar (AlertDialog)
│   ├── leave-request-status-badge.tsx
│   └── requested-leave-list.tsx    # review queue
└── leave-request-processes/
    ├── leave-process-form.tsx
    ├── leave-process-steps-editor.tsx   # dnd-kit reorder
    └── leave-step-role-picker.tsx

supabase/migrations/
└── YYYYMMDDHHMMSS_leave_requests_workflow.sql   # 1 migration (баганад нэмэх + 5 шинэ хүснэгт + RLS + indexes)

types/
└── db.ts                           # Дахин үүсгэгдсэн (web + mobile хоёулан)

shared-context/
└── SUPABASE_SCHEMA.md              # MODIFIED (leave-related table-ыг бүртгэх)
```

**Structure Decision**: Одоогийн төслийн "single Next.js app + Supabase actions" гэсэн зохион байгуулалтыг тогтвортой дагана. Backend нь нэг Supabase project, frontend болон Server Actions нь Next.js дотор хамт. Орчны бусад зэрэгцээ систем (orders, devices)-тэй ижил pattern.

## Phases

### Phase 0: Research

Гол үл мэдэгдэх зүйл алга — clarifications шатанд бүгд шийдэгдсэн. Гэхдээ дараах "best-practice" judgment-уудыг `research.md`-д баримтжуулна:

- Workflow шилжих логикийн хэрэгжүүлэлт (DB trigger vs server action) — orders-ын одоогийн арга барил.
- `is_half_day` UX (хагас өдөр = AM/PM сонголт vs simple toggle).
- File upload validation pattern (client + server side double-check).
- Mobile flat-status migration стратеги (одоо байгаа мөрд default workflow process тогтоох эсвэл туг `is_legacy=true` нэмэх).
- Cancellation policy (зөвхөн `in_review` хүсэлт цуцалж болох гэдгийг хэрхэн enforce хийх).

### Phase 1: Design & Contracts

1. `data-model.md` — 6 хүснэгтийн бүрэн schema (column / type / FK / CHECK / RLS), статусын шилжилт диаграмм, индекс.
2. `contracts/server-actions.md` — server action бүрд signature, input zod schema, return shape `{ ok, ... }`, RLS-ийн илэрхийлэл.
3. `contracts/ui-routes.md` — хуудас тус бүр URL, permission gate, render data, navigation flow.
4. `quickstart.md` — DEV-д migration apply хийх, type re-generate, smoke-test (3 user persona: ажилтан, reviewer, admin) сценари.
5. CLAUDE.md дотор `<!-- SPECKIT START --> ... <!-- SPECKIT END -->` блок дахь plan reference-ыг шинэчилнэ.

### Phase 1.5: Schema Coordination (Constitution Зарчим II)

Энэ нь хэрэгжүүлэлтийн нэг хэсэг боловч migration apply хийхээс өмнө тусад нь алхам:
- `#supabase-schema` Discord thread дээр schema delta-г байршуулж тохирол авах.
- `shared-context/SUPABASE_SCHEMA.md`-ийг шинэчлэх.
- `bgs-mobile-app` репог сэрэмжлүүлэх (тэдний `types/db.ts`-ыг дахин үүсгэх ёстой).

### Phase 2 ба түүнээс цааш

- `/speckit-tasks` (Phase 2) — tasks.md үүсгэнэ.
- `/speckit-implement` (Phase 3) — task бүрд тус тусдаа PR.

## Post-Design Constitution Re-Check

Phase 1 (research, data-model, contracts, quickstart) дууссаны дараа дахин шалгасан:

| Зарчим | Үнэлгээ | Тэмдэглэл |
|---|---|---|
| I. Спек | ✅ | Spec → plan → contracts хатуу align. |
| II. Хуваалцсан backend | ⚠️ pending action | Migration apply хийхийн өмнө `#supabase-schema` зөвшөөрөл + `shared-context/SUPABASE_SCHEMA.md` шинэчлэх + mobile `types/db.ts` regen. `/speckit-tasks` дотор tasks болж орно. |
| III. Давхаргат | ✅ | Бүх action `actions/leave-*` дотор, return `{ ok, ... }`, `revalidatePath` баримтжуулсан. |
| IV. RLS | ✅ | `data-model.md` дотор policy бүрд `auth.uid()` / `current_profile_id()` / `has_permission` ашигласан. RPC шаардлагагүй. |
| V. UI | ✅ | Статусын өнгө `ui-routes.md`-д тогтсон, AlertDialog destructive үйлдэлд тогтсон, monolyngual MN. |
| VI. Type safety | ✅ | Action signature zod-аар, return `ActionResult<T>` template. `types/db.ts` regen алхам quickstart-д тусгасан. |

**Final result**: PASS. Schema coordination (Зарчим II)-ыг `/speckit-tasks` шатанд "Phase 0" tasks болгож оруулна.

## Complexity Tracking

*(Зөрчил байхгүй — энэ хэсэг хоосон)*

Бүх шийдэл орчны патэрнүүдтэй нэг хэвийн (`orders`-ын reuse). Шинэ зүйл нэмэхгүй. YAGNI зөрчигдөхгүй.
