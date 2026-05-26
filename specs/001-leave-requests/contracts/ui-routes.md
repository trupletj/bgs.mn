# UI Routes Contract: Чөлөөний хүсэлт

**Branch**: `001-leave-requests` | **Date**: 2026-05-26

Бүх хуудас `app/(protected)/` дотор. Layout нь автомат authentication + sidebar nav (`AppSidebar` + `getNavServices()`).

| URL | Permission | Render data (server-action) | Component |
|---|---|---|---|
| `/leave-requests` | `leave:access` | `getMyLeaveRequests()` + admin бол `getAllLeaveRequests()` | `LeaveRequestsList` (data-table) |
| `/leave-requests/add` | `leave:create` | `getLeaveTypesWithProcess()` (active) | `LeaveRequestCreateForm` |
| `/leave-requests/review` | `leave:review` | `getAwaitingLeaveRequests(profile_id, "pending" / "reviewed")` | `RequestedLeaveList` (Tabs) |
| `/leave-requests/[id]` | RLS (өөрийн / reviewer / admin) | `getLeaveRequestWithDetail(id)` | `LeaveRequestDetailView` |
| `/leave-request-processes` | `leave:admin` | `getLeaveTypesWithProcess()`, `listLeaveProcesses()` | `LeaveProcessesList` |
| `/leave-request-processes/new` | `leave:admin` | `getRolesForPicker()` | `LeaveProcessForm` |
| `/leave-request-processes/[id]/edit` | `leave:admin` | `getLeaveProcessWithSteps(id)` | `LeaveProcessForm` |

---

## Navigation flow

```
                            ┌─────────────────────────────┐
                            │  Sidebar > "Чөлөө"          │
                            └──────────┬──────────────────┘
                                       │
                  ┌────────────────────┼──────────────────────────────┐
                  │                    │                              │
                  ▼                    ▼                              ▼
       /leave-requests         /leave-requests/add        /leave-requests/review
       (Миний хүсэлт)         (Шинэ хүсэлт)             (Хяналт — badge[N])
                  │                    │                              │
                  └──────┬─────────────┘                              │
                         │  click row / "Дэлгэрэнгүй"                 │
                         ▼                                             ▼
              /leave-requests/[id]                          /leave-requests/[id]
              (өөрийн хүсэлт — Cancel)                     (reviewer — Approve/Reject)
```

Admin зориулалт:
```
Sidebar > "Чөлөө" > "Чөлөөний төрөл"
       ▼
/leave-request-processes
       ▼  "+ Шинэ"
/leave-request-processes/new ──INSERT──> back to list
       ▼  edit
/leave-request-processes/[id]/edit ──UPDATE──> back to list
```

---

## Хуудас бүрийн skeleton

### `/leave-requests`

- Header: "Миний чөлөөний хүсэлт" + `[+ Шинэ хүсэлт]` (хэрэв `leave:create`).
- Tab сонголт (хэрэв `leave:admin`): "Миний" / "Бүх ажилтан".
- Filter chip: статус (`pending`, `in_review`, `approved`, `rejected`, `cancelled`).
- Data-table: огноо, төрөл, өдөр, статус-badge, action menu (Дэлгэрэнгүй / Cancel).

### `/leave-requests/add`

- Form (react-hook-form + zod, sonner toast):
  - `leave_type_id` (Select)
  - `start_date` / `end_date` (Calendar popover)
  - `is_half_day` (Switch — start=end үед л идэвхтэй)
  - `description` (Textarea)
  - `file` (Input type=file, нэг файл)
  - Submit товч → `createLeaveRequestWithInstance`.
- Submit-ийн дараа: redirect `/leave-requests/[new_id]`.

### `/leave-requests/review`

- Tabs: "Хүлээгдэж буй" (badge[N]) / "Хянагдсан".
- Card list (orders-ын `RequestedList`-той ижил): хэрэглэгчийн нэр, төрөл, огноо, шат N, "Дэлгэрэнгүй" → `/leave-requests/[id]`.

### `/leave-requests/[id]`

- Section 1: Header (хэрэглэгч, төрөл, огнооны хүрээ, ерөнхий статус-badge).
- Section 2: Workflow indicator (`LeaveRequestWorkflow` — orders-ын `OrderWorkflow`-ийн загвараар, шат бүрд reviewer-уудын статус).
- Section 3:
  - Description, file хавсралт.
- Section 4 (action panel):
  - Хэрэв `auth.uid() = user_id && status IN ('pending','in_review')`: `[Цуцлах]` (AlertDialog).
  - Хэрэв reviewer = current user && pending мөртэй: `[Зөвшөөрөх]` / `[Татгалзах]` (AlertDialog + tailbar Textarea).
- Section 5: Status history timeline.

### `/leave-request-processes`

- Жагсаалт: process бүр (нэр, шатны тоо, харьцсан leave_type-ууд).
- `[+ Шинэ process]`.
- Action: Edit / Deactivate (AlertDialog).
- Дэд хэсэг: leave_types CRUD (inline хүснэгт эсвэл modal).

### `/leave-request-processes/new` болон `/[id]/edit`

- Form:
  - Process нэр, тайлбар.
  - Steps editor (dnd-kit-ээр reorder, "+ Шат нэмэх").
  - Step бүр: нэр, role multi-picker (roles_profiles-ээс ирсэн role жагсаалтаас).
- Submit → `createLeaveProcess` / `updateLeaveProcess`.

---

## Permission gates (хуудасны эхэнд)

```ts
// /leave-requests/page.tsx
const canAccess = await hasPermission("leave", "access");
if (!canAccess) redirect("/dashboard");
```

```ts
// /leave-requests/add/page.tsx
const canCreate = await hasPermission("leave", "create");
if (!canCreate) redirect("/leave-requests");
```

```ts
// /leave-requests/review/page.tsx
const canReview = await hasPermission("leave", "review");
if (!canReview) redirect("/dashboard");
```

```ts
// /leave-request-processes/**
const canAdmin = await hasPermission("leave", "admin");
if (!canAdmin) redirect("/dashboard");
```

---

## Status өнгө (constitution Зарчим V)

| status | badge color (Tailwind / shadcn) |
|---|---|
| `pending` | `bg-amber-100 text-amber-800` |
| `in_review` | `bg-amber-100 text-amber-800` (sub-label: шат N) |
| `approved` | `bg-emerald-100 text-emerald-800` |
| `rejected` | `bg-destructive/10 text-destructive` |
| `cancelled` | `bg-muted text-muted-foreground` |

Reviewer мөрийн статусын dot:
- pending: amber
- approved: emerald
- rejected: destructive
- skipped: muted
