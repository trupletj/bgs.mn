---

description: "Tasks for 001-leave-requests"
---

# Tasks: Чөлөөний хүсэлт (Leave Requests)

**Input**: Design documents from `/specs/001-leave-requests/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Энэ feature-д unit/integration test үе шаталгаагүй (constitution-ы дагуу одоогийн төсөлд автомат test layer хэвшээгүй). Smoke test нь `quickstart.md`-ийн 3 persona walkthrough-аар хийгдэнэ.

**Organization**: Tasks нь user story-аар бүлэглэгдсэн — story тус бүрийг бие даан хэрэгжүүлж, шалгаж, deploy хийх боломжтой.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Зэрэг гүйцэтгэх боломжтой (өөр өөр файл, dependency байхгүй)
- **[Story]**: User story label (US1, US2, US3, US4) — Setup/Foundational/Polish-д label байхгүй
- Файлын замуудыг тодорхой бичсэн

## Path Conventions

`bgs.mn` нь single Next.js App Router project:
- Server actions: `actions/`
- Pages: `app/(protected)/`
- Components: `components/`
- Migrations: `supabase/migrations/`
- Generated DB types: `types/db.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch болон tooling шалгалт. Project аль хэдийн setup хийгдсэн тул минимал.

- [ ] T001 Confirm working branch is `001-leave-requests` (`git branch --show-current`); confirm `.env.local` нь `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`-той (no file change, verification only)
- [ ] T002 `npm install` ажиллуулж dependency-уудыг шинэчлэх; `npm run lint` амжилттай гарч байгааг шалгах

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Бүх user story-ийн өмнө хийгдэх ёстой schema, RLS, type, permission бүтэц.

**⚠️ CRITICAL**: Энэ phase бүрэн дуусахгүйгээр US1, US2, US3, US4-н нэг ч ажил эхэлж болохгүй.

### Schema coordination (Constitution Зарчим II)

- [ ] T003 `#supabase-schema` Discord thread дээр `data-model.md`-ийн migration outline-ыг байршуулж зөвшөөрөл авах (no file change in this repo)
- [ ] T004 `../shared-context/SUPABASE_SCHEMA.md`-д шинэ хүснэгт (`leave_request_processes`, `_steps`, `_step_roles`, `_instances`, `_step_reviewers`, `_status_history`) болон `leave_requests`/`leave_types` өргөтгөлийг бүртгэж commit + push

### Migration

- [ ] T005 Шинэ migration файл үүсгэх `supabase/migrations/<timestamp>_leave_requests_workflow.sql` — `data-model.md`-ийн "Migration outline" хэсгийг бүрэн оруулах (CREATE TABLE x6, ALTER TABLE leave_types/leave_requests, trigger функц, RLS policies, permission seed, индексүүд)
- [ ] T006 Migration-ыг cloud-руу MCP `apply_migration`-аар apply (НЭ `supabase db push` биш). Дараа нь `mcp__supabase__list_tables`-аар 6 шинэ хүснэгт байгаа эсэхийг шалгах
- [ ] T007 Migration-ийн rollback файл бэлдэх `supabase/migrations/_revert/<timestamp>_revert_leave_requests_workflow.sql` (commit, apply хийхгүй) — DROP policy, DROP table, DROP column, ALTER duration_days back to int, DELETE permissions

### Type regeneration (web + mobile)

- [ ] T008 [P] `bgs.mn` дотор `npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts` ажиллуулж шинэ хүснэгт type-уудыг үүсгэх
- [ ] T009 [P] `bgs-mobile-app` repo-руу шилжиж `npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts` ажиллуулж commit + push (mobile-руу breaking change байгаа эсэхийг шалгана)

### Default workflow seed data

- [ ] T010 Manual seed (SQL via MCP `execute_sql` эсвэл Supabase Studio): хамгийн багадаа нэг идэвхтэй `leave_request_processes` мөр + 1 step + step_role үүсгэх; одоо байгаа `leave_types`-ийн нэгд `process_id` оноох — US1 болон US2 өгөгдөлгүй ажиллахгүй

**Checkpoint**: Foundation бэлэн. Одооноос US1-ээс эхлээд user story phase-уудыг зэрэгцэн эхлүүлж болно (FE/BE-ийн файлын хувьд бараг л conflict байхгүй учир).

---

## Phase 3: User Story 1 — Ажилтан чөлөөний хүсэлт илгээнэ (Priority: P1) 🎯 MVP

**Goal**: Ажилтан leave type, эхлэх/дуусах огноо, хагас өдөр сонголт, тайлбар, файл хавсаргаж шинэ хүсэлт илгээж чаддаг болох. Илгээсний дараа workflow эхний шатны хянагч нар автоматаар томилогдох.

**Independent Test**: Tester ажилтан logon → `/leave-requests/add` → form бөглөж submit → `/leave-requests/[id]` руу redirect → workflow indicator + reviewer-ууд харагдсан байх + DB-д `leave_requests` + `leave_request_instances` + `leave_request_step_reviewers` мөрүүд үүссэн байх.

### Implementation for User Story 1

- [ ] T011 [P] [US1] `components/leave-requests/leave-request-status-badge.tsx` — статусын өнгөт badge (Constitution Зарчим V палитр: amber/emerald/destructive/muted). 5 статус дэмжих (`pending`, `in_review`, `approved`, `rejected`, `cancelled`)
- [ ] T012 [US1] `actions/leave-requests.ts` үүсгэж эхлэх. Дотор: `getLeaveTypesWithProcess()` action (return: active `leave_types` + JOIN `leave_request_processes`)
- [ ] T013 [US1] `actions/leave-requests.ts`-д `createLeaveRequestWithInstance(formData)` action нэмэх — `contracts/server-actions.md`-ийн дагуу zod schema, file upload-ыг `leave-attachments` bucket-руу, leave_types.process_id татах, transaction-аар request + instance + step_reviewer-уудын INSERT, self-skip filter, recursive auto-advance, status_history-д бүртгэх, `revalidatePath`
- [ ] T014 [US1] `components/leave-requests/leave-request-create-form.tsx` — react-hook-form + zod, shadcn `Calendar` popover (start/end), `Switch` (is_half_day), `Textarea` (description), `Input type=file` (хавсралт, 10MB / PDF·JPG·PNG·DOCX client-side validation), submit товч `createLeaveRequestWithInstance` дуудах, sonner toast + redirect
- [ ] T015 [US1] `app/(protected)/leave-requests/add/page.tsx` — server component, `hasPermission("leave","create")` шалгаж redirect, `getLeaveTypesWithProcess()` дуудаж form-руу дамжуулах
- [ ] T016 [US1] `components/leave-requests/leave-request-workflow.tsx` — step indicator (orders-ын `components/orders/order-workflow.tsx`-ыг тулгуурлан). Props: `process_snapshot`, `instance`, `reviewers[]`. Шат бүр + дотроо reviewer-ийн нэр + статус dot
- [ ] T017 [US1] `actions/leave-requests.ts`-д `getLeaveRequestWithDetail(id)` action нэмэх — request + profile + leave_type + instance + reviewers(grouped by step) + history (RLS-аар шүүлт хийх)
- [ ] T018 [US1] `components/leave-requests/leave-request-detail-view.tsx` — header (хэрэглэгч, төрөл, огноо, статус-badge), `LeaveRequestWorkflow`, description + file хавсралтын линк, status history timeline. Action panel-ыг хоосон div болгож үлдээх (US2/US3-д бөглөгдөнө)
- [ ] T019 [US1] `app/(protected)/leave-requests/[id]/page.tsx` — server component, `getLeaveRequestWithDetail(id)` дуудаж detail view-руу дамжуулах, RLS-аас алдаа гарвал 404

**Checkpoint**: US1 бие даан ажиллана. Ажилтан хүсэлт илгээж, өөрийн хүсэлтийн дэлгэрэнгүйг харж байна. Reviewer-ийн UI байхгүй ч instance + reviewer мөр зөв үүсч буйг DB-аас шалгаж болно. Sidebar nav-д "Чөлөө > + Хүсэлт илгээх" хараахан байхгүй (Phase 4-д орно).

---

## Phase 4: User Story 2 — Хянагч хүсэлтийг батлах/татгалзах (Priority: P1)

**Goal**: Reviewer-ууд өөрт хуваарилагдсан pending хүсэлтийг хянаж зөвшөөрөх/татгалзах. Олон шаттай шилжилт, татгалзлын тайлбар, sidebar badge ажиллана.

**Independent Test**: US1-ээр илгээгдсэн хүсэлт бий гэж үзвэл — reviewer logon → sidebar "Чөлөө" дээр badge[N] харагдах → `/leave-requests/review`-руу очих → pending list → нэг хүсэлт нээх → "Зөвшөөрөх" дарах → ⓐ хэрэв нэг шаттай байсан бол хүсэлтийн статус `approved` болсон, ⓑ хэрэв хоёр шаттай байсан бол дараагийн шатанд шилжсэн.

### Implementation for User Story 2

- [ ] T020 [P] [US2] `actions/leave-requests.ts`-д `getPendingLeaveReviewCountForCurrentUser()` action нэмэх — single `select count(*)` query, `idx_leave_step_reviewers_pending`-ыг ашиглах
- [ ] T021 [P] [US2] `actions/leave-requests.ts`-д `getAwaitingLeaveRequests(profile_id, type)` action нэмэх — type "pending"/"reviewed" branching, JOIN-ууд, `contracts/server-actions.md` outline-ын дагуу
- [ ] T022 [US2] `actions/leave-requests.ts`-д `approveLeaveStep({request_id, note?})` action нэмэх — advisory lock (`pg_advisory_xact_lock`), өөрийн reviewer мөрийг update, шатны бүх reviewer approved/skipped эсэх шалгаад дараагийн шат руу автомат шилжих (recursive self-skip-тэй), сүүлчийн шат бол `leave_requests.status = 'approved'`, status_history INSERT, `revalidatePath`
- [ ] T023 [US2] `actions/leave-requests.ts`-д `rejectLeaveStep({request_id, note})` action нэмэх — note заавал, өөрийн reviewer мөрийг rejected, бусад pending мөрүүдийг skipped, instance + request статусыг rejected, status_history INSERT, `revalidatePath`
- [ ] T024 [P] [US2] `components/leave-requests/leave-request-review-actions.tsx` — `[Зөвшөөрөх]` товч (AlertDialog confirm) + `[Татгалзах]` товч (AlertDialog + Textarea note). Submit-д action дуудаж sonner toast. Component нь хэрэв хэрэглэгч pending reviewer мөртэй бол л render
- [ ] T025 [US2] `components/leave-requests/leave-request-detail-view.tsx`-ын action panel placeholder-руу `LeaveRequestReviewActions` оруулах. Component нь `reviewers` props-оос `auth.uid()`-той тааруулж өөрийн pending мөрийг олж рендэрнэ
- [ ] T026 [P] [US2] `components/leave-requests/requested-leave-list.tsx` — orders-ын `components/orders/requested-list.tsx`-аар. Pending/Reviewed tab, card list (хэрэглэгчийн нэр, төрөл, огноо, шат), "Дэлгэрэнгүй" link `/leave-requests/[id]`
- [ ] T027 [US2] `app/(protected)/leave-requests/review/page.tsx` — server component, `hasPermission("leave","review")` шалгаж redirect, profile_id татах, `getAwaitingLeaveRequests` 2 удаа дуудаж "pending"/"reviewed" data авах, `RequestedLeaveList`-руу дамжуулах
- [ ] T028 [US2] `actions/nav.ts`-д "Чөлөө" service нэмэх — `contracts/server-actions.md`-ийн дагуу `hasLeaveAccess/Create/Review/Admin` checks, `pendingLeaveReviewCount` badge, items array, push to services
- [ ] T029 [US2] `actions/nav.ts`-аас `getPendingLeaveReviewCountForCurrentUser` import болон шинэ `NavService` push логикийг шалгах — sidebar-д "Чөлөө > Хяналт" badge гарч буйг dev server-аас шалгах

**Checkpoint**: US1 + US2 хоёулаа бие даан ажиллана. End-to-end loop хаагдсан: илгээх → хяналт → шийдвэр → статус шинэчлэгдэх → badge буурах.

---

## Phase 5: User Story 3 — Ажилтан өөрийн хүсэлтийн жагсаалт + цуцлах (Priority: P2)

**Goal**: Ажилтан "Миний хүсэлтүүд" хуудаснаас өөрийн бүх хүсэлтийг харах, статус filter хийх, идэвхтэй хүсэлтийг цуцлах.

**Independent Test**: US1-ээр илгээсэн ажилтан `/leave-requests`-руу очих → жагсаалтад өөрийн хүсэлтүүд харагдах → статус filter сонгох → үлдэгдэл шүүгдэх → нэг `in_review` хүсэлт нээж "Цуцлах" → AlertDialog confirm → статус `cancelled` болж, badge буурсан.

### Implementation for User Story 3

- [ ] T030 [P] [US3] `actions/leave-requests.ts`-д `getMyLeaveRequests({status?, page?, pageSize?})` action нэмэх — RLS-аар auto-filter (өөрийн), JOIN leave_types + latest instance, pagination
- [ ] T031 [P] [US3] `actions/leave-requests.ts`-д `cancelLeaveRequest(id)` action нэмэх — status `pending`/`in_review` шалгах, request + instance + pending reviewers status update, status_history INSERT, `revalidatePath`
- [ ] T032 [US3] `components/leave-requests/leave-requests-list.tsx` — `components/data-table.tsx` wrapper, column бүрт: огнооны хүрээ, leave_type.name, duration_days, `LeaveRequestStatusBadge`, current step, action menu (Дэлгэрэнгүй / Цуцлах AlertDialog)
- [ ] T033 [US3] `app/(protected)/leave-requests/page.tsx` — server component, `hasPermission("leave","access")` redirect guard. URL search params-аас status filter уншиж `getMyLeaveRequests` дуудах. Header-д `[+ Шинэ хүсэлт]` товч (`hasPermission("leave","create")`-той бол). Admin (`hasPermission("leave","admin")`)-д "Миний" / "Бүх ажилтан" Tabs нэмэх — admin tab-д `getAllLeaveRequests()` action хэрэглэх (доорх T034)
- [ ] T034 [US3] `actions/leave-requests.ts`-д `getAllLeaveRequests({status?, page?, pageSize?})` action нэмэх (admin зориулалт, RLS `leave:admin` policy-аар enforce) — JOIN profile.name
- [ ] T035 [US3] `actions/nav.ts`-д "Чөлөө > Миний хүсэлтүүд" link items-д нэмэх (хэрвээ `hasLeaveAccess`)

**Checkpoint**: US1 + US2 + US3 гурван хувилбар бие даан ажиллана. Ажилтан / Reviewer / Admin гурван persona-ын flow бүрэн дууссан, зөвхөн workflow тохиргооны UI үлдсэн.

---

## Phase 6: User Story 4 — Admin: leave types + processes тохируулна (Priority: P3)

**Goal**: `leave:admin` эрхтэй хэрэглэгч `leave_types` болон `leave_request_processes`-ыг UI-аас CRUD хийнэ. Шинэ leave type-руу шинэ process оноох, шат / step_role-уудыг dnd-kit-ээр reorder.

**Independent Test**: Super_admin `/leave-request-processes`-руу очих → шинэ process үүсгэх (2 шаттай, role оноох) → шинэ leave_type үүсгэж process-руу холбох → ажилтан US1-аар хүсэлт илгээх → шинэ workflow эхний шатны reviewer-уудад томилогдсон эсэхийг шалгах.

### Implementation for User Story 4

- [ ] T036 [P] [US4] `actions/leave-processes.ts` үүсгэх. Гол action-ууд: `getLeaveTypesWithProcess` (US1-тэй давхцал — re-export), `createLeaveType({name})`, `updateLeaveType(id, {name, is_active})`, `deactivateLeaveType(id)`. Permission `leave:admin` шалгалт.
- [ ] T037 [P] [US4] `actions/leave-processes.ts`-д process CRUD: `listLeaveProcesses()`, `getLeaveProcessWithSteps(id)`, `createLeaveProcess({name, description, steps:[{name, role_ids:[]}]})` — transaction-аар process + steps + step_roles bulk INSERT, `updateLeaveProcess(id, ...)`, `deactivateLeaveProcess(id)`, `assignProcessToLeaveType(leave_type_id, process_id)`
- [ ] T038 [P] [US4] `actions/leave-processes.ts`-д `getRolesForPicker()` action — `roles` table-аас идэвхтэй role-уудын `id, name` (form-д dropdown)
- [ ] T039 [US4] `components/leave-request-processes/leave-step-role-picker.tsx` — multi-select shadcn `Popover` + `Command` (search-able), props: `availableRoles[]`, `value: number[]`, `onChange`
- [ ] T040 [US4] `components/leave-request-processes/leave-process-steps-editor.tsx` — dnd-kit-аар шат reorder, "+ Шат нэмэх" товч, шат бүр нэр Input + `LeaveStepRolePicker`, "Устгах" товч (AlertDialog confirm), эцэст нь `steps` state-ыг exposeдэг
- [ ] T041 [US4] `components/leave-request-processes/leave-process-form.tsx` — react-hook-form, process нэр/тайлбар Input + `LeaveProcessStepsEditor`, submit-д `createLeaveProcess` эсвэл `updateLeaveProcess` дуудах
- [ ] T042 [US4] `components/leave-request-processes/leave-types-table.tsx` — `data-table` дээр leave_types CRUD inline (нэр, идэвхтэй badge, харьцсан process нэр, "+ Шинэ" товч, action menu: Edit dialog / Deactivate AlertDialog, "Process оноох" Combobox-той dialog)
- [ ] T043 [US4] `app/(protected)/leave-request-processes/page.tsx` — server component, `hasPermission("leave","admin")` redirect guard, `listLeaveProcesses()` + `getLeaveTypesWithProcess()` дуудаж 2 section render (Processes list + Types table)
- [ ] T044 [US4] `app/(protected)/leave-request-processes/new/page.tsx` — `LeaveProcessForm` mode=create, `getRolesForPicker()` дамжуулах
- [ ] T045 [US4] `app/(protected)/leave-request-processes/[id]/edit/page.tsx` — `getLeaveProcessWithSteps(id)` дуудаж `LeaveProcessForm` mode=edit

**Checkpoint**: Бүх 4 user story бие даан ажиллаж дууссан. End-to-end pipeline (admin process тохируулна → ажилтан илгээнэ → reviewer хянана → status шинэчлэгдэнэ → ажилтан үр дүнг харна).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T046 [P] `CLAUDE.md`-ийн "Architecture" хэсэгт "Leave Request Workflow" sub-section нэмэх (Order Workflow хэсгийн загвараар): хүснэгтүүд, action файлуудын зорилго, RBAC-ийн map
- [ ] T047 [P] `CLAUDE.md`-ийн "Key DB Tables" хүснэгтэд 6 шинэ хүснэгтийг нэмэх + `leave_types`/`leave_requests` мөрийг өргөтгөл талаар update
- [ ] T048 `quickstart.md`-ийн 3 persona smoke test-ийг гүйцэтгэх (A: ажилтан илгээх+цуцлах, B: reviewer approve/reject + multi-step, C: admin process үүсгэх + leave_type холбох). Playwright MCP-ээр UI screenshot эсвэл chromium dev tools-аар хийгдэж болно.
- [ ] T049 `quickstart.md`-ийн edge case-уудыг шалгах: `end_date < start_date`, файл 11MB / `.exe`, self-review skip (HR ажилтан өөрөө илгээх), concurrent approve race (advisory lock).
- [ ] T050 [P] `npm run lint` бүрэн pass эсэхийг шалгах + `npx tsc --noEmit` strict type check
- [ ] T051 [P] `npm run build` амжилттай дуусч буйг шалгах (production build smoke)
- [ ] T052 PR draft нээх `gh pr create --draft --title "feat: leave requests with multi-step approval (001-leave-requests)" --body @./specs/001-leave-requests/spec.md` (эсвэл богино body), reviewer оноох — Constitution Зарчим II-ийн дагуу schema өөрчлөлтийг highlight хийх

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: dependency байхгүй, шууд эхэлж болно
- **Phase 2 (Foundational)**: Phase 1-ийн дараа. **БҮХ user story-г блоклоно**
  - T003 (Discord approval) → T004 (shared-context) → T005 (migration file) → T006 (apply) → T008/T009 (types regen) → T010 (seed)
  - T008 болон T009 зэрэг гүйцэтгэж болно
- **Phase 3 (US1)**: Phase 2 дуусахад л эхэлнэ
- **Phase 4 (US2)**: Phase 2 дуусахад эхлэх боломжтой; US1-тэй FE/BE-ийн файлуудтай давхцал бараг л байхгүй — зэрэг хөгжүүлж болно. Гэхдээ smoke test нь US1-ийн "request submit"-аас гарсан data шаардна.
- **Phase 5 (US3)**: Phase 2 дуусахад эхлэх боломжтой; T030/T031/T034 нь US1/US2-тэй давхар `actions/leave-requests.ts`-д бичих учир merge conflict-оос болгоомжлох
- **Phase 6 (US4)**: Phase 2 дуусахад эхлэх боломжтой; `actions/leave-processes.ts` нь шинэ файл, давхцалгүй
- **Phase 7 (Polish)**: US1-US4 бүгд дуусахад

### Story-түвшний dependency

- **US1 (P1)**: Foundational-ийн дараа эхлэх. Бусад story-аас хараат бус.
- **US2 (P1)**: Foundational-ийн дараа эхлэх. Бие даан testable боловч smoke test нь US1-ийн data-аас хамаардаг (workaround: seed data SQL-аар оруулж болно).
- **US3 (P2)**: Foundational-ийн дараа эхлэх. US1-ийн data-тай шууд харьцана; bie даан зэрэгцэн хөгжүүлж болно.
- **US4 (P3)**: Foundational-ийн дараа эхлэх; US1 эхлэхийн өмнө л Phase 2-ийн T010 (manual seed)-ыг орлох UI-аар орлуулах боломж нь US4-ийн долоо хоног.

### Story дотроо

- Action → Page → Component урсгал биш, **Action эхэлж бий байх ёстой**, Component нь тэр Action-ыг дуудах.
- US1: T011 → (T012 ∥ T013) → T014 → T015 → T016 → T017 → T018 → T019
- US2: (T020 ∥ T021) → (T022 ∥ T023) → T024 → T025 → T026 → T027 → T028 → T029
- US3: (T030 ∥ T031 ∥ T034) → T032 → T033 → T035
- US4: (T036 ∥ T037 ∥ T038) → T039 → T040 → T041 → T042 → (T043 ∥ T044 ∥ T045)

### Parallel Opportunities (товч)

- Phase 2: T008 ∥ T009 (web + mobile types regen)
- Phase 3 US1: T011, T012 эхэндээ зэрэгцэн (T012 нь `actions/leave-requests.ts`-ыг үүсгэх ⇒ T013 дараа)
- Phase 4 US2: T020 ∥ T021 ∥ T024 ∥ T026
- Phase 5 US3: T030 ∥ T031 ∥ T034
- Phase 6 US4: T036 ∥ T037 ∥ T038, дараа нь T043 ∥ T044 ∥ T045
- Phase 7 Polish: T046 ∥ T047 ∥ T050 ∥ T051

### Файлын merge-conflict эрсдэл

- `actions/leave-requests.ts` — US1 (T012, T013, T017), US2 (T020, T021, T022, T023), US3 (T030, T031, T034) нэг файлд бичнэ. Зэрэгцүүлэн хийх бол тус бүрд branch-ыг feature-branch-ээс дараах sub-branch-аар хуваах.
- `actions/nav.ts` — US2 (T028) болон US3 (T035) хоёр өөр өөр sub-item нэмнэ. Хэрвээ зэрэг хийвэл нэг developer integrate хийнэ.
- `components/leave-requests/leave-request-detail-view.tsx` — US1 (T018) үүсгэх, US2 (T025) action panel нэмэх. Sequential хийх.

---

## Parallel Example: User Story 1 хурдан стартлах

```bash
# Foundation бэлэн болсны дараа US1-ийн зэрэгцүүлэх боломжтой эхний tasks
Task T011: "Create status badge in components/leave-requests/leave-request-status-badge.tsx"
Task T016: "Create workflow indicator in components/leave-requests/leave-request-workflow.tsx" (T012 дууссаны дараа)

# US2-той зэрэгцүүлэх:
Developer A → Phase 3 (US1)
Developer B → Phase 4 (US2)  (US1-ийн detail-view.tsx merge-аас болгоомжлох)
```

---

## Implementation Strategy

### MVP (US1 + US2 — P1 хоёулаа)

1. Phase 1 (Setup) — 1 цаг
2. Phase 2 (Foundational) — 1 өдөр (Discord approval хүлээж байх үе)
3. Phase 3 (US1) — 2 өдөр
4. Phase 4 (US2) — 2 өдөр
5. **STOP, VALIDATE** — `quickstart.md`-ийн Persona A + B-г шалгах
6. PR review → main руу нийлүүлэх → demo

### Incremental Delivery (US3, US4 нэмэлт)

7. US3 — өөрийн хүсэлтийн жагсаалт + цуцлах (1 өдөр)
8. US4 — admin process тохиргооны UI (2-3 өдөр)
9. Phase 7 Polish + PR finalization

### Parallel Team Strategy

- Dev A: Phase 2 → US1 → US3 → Polish (Action-ийн файлын мэргэжилтэн)
- Dev B: Phase 2 cross-check → US2 → US4 → Polish

---

## Notes

- `actions/leave-requests.ts`-ийг нэг файлд төвлөрүүлэх — orders-ын loose convention-ыг дагана (`actions/orders.ts` нь дотроо 700+ мөр). Хэрвээ файл хэт томров `leave-requests/{create,review,query}.ts` болгож split хийж болно (refactor дараа гарч ирэх юм бол).
- `actions/leave-processes.ts` нь admin scope-той тусдаа файл.
- US-аас гадуурх action (жишээ нь нэмэлт notification trigger) ирээдүйд `notifications`-ыг хэрэгжүүлэхэд үнэлгээтэй — одоо v1-д хамаарахгүй.
- Constitution Зарчим III: бүх action `revalidatePath` дуудах ёстой. Test шалгахдаа: данс шинэ хүсэлт илгээсний дараа list page-нь stale data харуулж болохгүй.
- Constitution Зарчим V: AlertDialog-ыг бүх destructive үйлдэлд (Cancel, Reject, Deactivate) ашиглах.
- Schema migration apply-ийн дараа `bgs-mobile-app`-ыг тестлэх: одоогийн mobile-ын leave create flow нь шинэ NULL баганатай үлдсэн ч ажиллах ёстой (`status='pending'` шууд хадгалагдсаар байх).
