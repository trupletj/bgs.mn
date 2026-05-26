# Phase 1 Data Model: Чөлөөний хүсэлт (Leave Requests)

**Branch**: `001-leave-requests` | **Date**: 2026-05-26

Энэ хэсэг нь Supabase Postgres schema-ийн тодорхойлолт. Бүх өөрчлөлтийг **нэг migration** (`YYYYMMDDHHMMSS_leave_requests_workflow.sql`) дотор хийнэ. MCP `apply_migration`-аар cloud-руу шууд apply (constitution Зарчим II).

---

## Schema Diagram (текстээр)

```
┌─────────────────────┐
│  leave_types        │  (одоо бий — extend)
│  + process_id (FK)  │
└──────────┬──────────┘
           │ 1:1 (default process)
           ▼
┌─────────────────────┐         ┌──────────────────────────────┐
│  leave_request_     │ 1:N     │  leave_request_steps         │
│  processes (NEW)    ├────────►│                              │
└─────────────────────┘         └──────────┬───────────────────┘
                                           │ 1:N
                                           ▼
                                ┌──────────────────────────────┐
                                │  leave_request_step_roles    │
                                └──────────────────────────────┘
                                           ▲
                                           │ N:1 (role_id)
                                           │
┌─────────────────────┐                    │
│  leave_requests     │  ──── start_date, end_date, is_half_day нэмэх
│  (одоо бий — extend)│
└──────────┬──────────┘
           │ 1:1 (instance)
           ▼
┌─────────────────────────┐    1:N    ┌─────────────────────────────────┐
│  leave_request_         ├──────────►│  leave_request_step_reviewers   │
│  instances (NEW)        │           └─────────────────────────────────┘
└──────────┬──────────────┘
           │ 1:N
           ▼
┌─────────────────────────────────┐
│  leave_request_status_history    │  (NEW — audit log)
└─────────────────────────────────┘
```

---

## 1. `leave_types` (одоо бий — өргөтгөнө)

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `name` | text | ✓ | — | Жишээ: "Ээлжийн", "Өвчтэй" |
| `is_active` | boolean | — | `true` | Идэвхтэй эсэх |
| `created_at` | timestamptz | — | `now()` | |
| **`process_id`** *(NEW)* | bigint | — | `NULL` | FK → `leave_request_processes(id)`. Default workflow. NULL = legacy single-status. |

**Migration**:
```sql
ALTER TABLE leave_types
  ADD COLUMN process_id bigint REFERENCES leave_request_processes(id) ON DELETE SET NULL;
```

---

## 2. `leave_requests` (одоо бий — өргөтгөнө)

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `user_id` | uuid | ✓ | `auth.uid()` | FK → `auth.users(id)` |
| `leave_type_id` | bigint | ✓ | — | FK → `leave_types(id)` |
| `duration_days` | numeric(4,1) | ✓ | — | **Type change: int → numeric (0.5-ыг дэмжих)**. CHECK > 0 |
| `description` | text | — | — | |
| `file_url` | text | — | — | Supabase Storage URL |
| `file_name` | text | — | — | |
| `status` | text | — | `'pending'` | **CHECK extend**: `IN ('pending','in_review','approved','rejected','cancelled')` |
| `created_at` | timestamptz | — | `now()` | |
| **`start_date`** *(NEW)* | date | — | `NULL` | Шинэ хүсэлтэд zod-аар enforce. Legacy мөрд NULL. |
| **`end_date`** *(NEW)* | date | — | `NULL` | CHECK: `end_date >= start_date` (хоёулаа NULL биш бол) |
| **`is_half_day`** *(NEW)* | boolean | — | `false` | CHECK: `is_half_day = false OR start_date = end_date` |
| **`updated_at`** *(NEW)* | timestamptz | — | `now()` | trigger-ээр шинэчлэх |

**Validation rules** (application + DB):
- `start_date <= end_date` (DB CHECK хоёулаа NOT NULL үед).
- `is_half_day = true` ⇒ `start_date = end_date`.
- `duration_days` нь application-аас тооцоологдоно: `is_half_day ? 0.5 : (end_date - start_date + 1)`.
- Шинээр үүсгэх үед status `pending` эсвэл `in_review` (Workflow эхэлсний дараа).

**State transitions** (`status`):
```
   ┌────────────┐
   │  pending   │  (init үүсэх үе — legacy зориулалт)
   └─────┬──────┘
         │ workflow эхэлбэл шууд in_review
         ▼
   ┌────────────┐    cancelLeaveRequest()    ┌─────────────┐
   │ in_review  │ ─────────────────────────► │  cancelled  │
   └──┬─────┬───┘                            └─────────────┘
      │     │ rejectLeaveStep() (ямар нэг шатанд)
      │     ▼
      │  ┌────────────┐
      │  │  rejected  │
      │  └────────────┘
      │ approveLeaveStep() (сүүлчийн шат)
      ▼
   ┌────────────┐
   │  approved  │
   └────────────┘
```

**Migration**:
```sql
ALTER TABLE leave_requests
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN is_half_day boolean DEFAULT false,
  ADD COLUMN updated_at timestamptz DEFAULT now();

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_status_check
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'cancelled'));

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_date_check
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT leave_requests_half_day_check
    CHECK (NOT is_half_day OR start_date = end_date);

-- duration_days type change
ALTER TABLE leave_requests
  ALTER COLUMN duration_days TYPE numeric(4,1);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_leave_request_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_leave_request_updated_at();
```

---

## 3. `leave_request_processes` (NEW)

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `name` | text | ✓ | — | "2 шаттай ээлжийн чөлөө" |
| `description` | text | — | — | |
| `is_active` | boolean | — | `true` | |
| `created_at` | timestamptz | — | `now()` | |
| `created_by_profile_id` | bigint | — | — | FK → `profile(id)` |

---

## 4. `leave_request_steps` (NEW)

| Багана | Төрөл | NOT NULL | Тайлбар |
|---|---|---|---|
| `id` | bigint | ✓ | PK |
| `process_id` | bigint | ✓ | FK → `leave_request_processes(id)` ON DELETE CASCADE |
| `step_order` | smallint | ✓ | 1-аас эхэлсэн дараалал |
| `name` | text | ✓ | "Шууд удирдагч баталгаажуулна" |
| `description` | text | — | |
| **UNIQUE** | `(process_id, step_order)` | | |

---

## 5. `leave_request_step_roles` (NEW)

| Багана | Төрөл | NOT NULL | Тайлбар |
|---|---|---|---|
| `id` | bigint | ✓ | PK |
| `step_id` | bigint | ✓ | FK → `leave_request_steps(id)` ON DELETE CASCADE |
| `role_id` | bigint | ✓ | FK → `roles(id)` |
| **UNIQUE** | `(step_id, role_id)` | | |

---

## 6. `leave_request_instances` (NEW)

Хүсэлт бүрд **нэг идэвхтэй instance**.

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `leave_request_id` | bigint | ✓ | — | FK → `leave_requests(id)` ON DELETE CASCADE. UNIQUE |
| `process_id` | bigint | ✓ | — | FK → `leave_request_processes(id)` |
| `current_step_order` | smallint | ✓ | `1` | |
| `status` | text | ✓ | `'in_progress'` | CHECK: `IN ('in_progress','completed','rejected','cancelled')` |
| `process_snapshot` | jsonb | ✓ | — | `{steps: [{step_order, name, roles: [role_id]}, ...]}` |
| `started_at` | timestamptz | — | `now()` | |
| `completed_at` | timestamptz | — | `NULL` | |

**Index**: `(current_step_order, status)` — review queue query-д.

---

## 7. `leave_request_step_reviewers` (NEW)

Нэг шатанд хуваарилагдсан reviewer бүрд нэг мөр.

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `instance_id` | bigint | ✓ | — | FK → `leave_request_instances(id)` ON DELETE CASCADE |
| `step_order` | smallint | ✓ | — | |
| `reviewer_profile_id` | bigint | ✓ | — | FK → `profile(id)` |
| `status` | text | ✓ | `'pending'` | CHECK: `IN ('pending','approved','rejected','skipped')` |
| `note` | text | — | — | rejected үед заавал |
| `reviewed_at` | timestamptz | — | — | |
| **UNIQUE** | `(instance_id, step_order, reviewer_profile_id)` | | |

**Index**: `(reviewer_profile_id, status)` — sidebar badge count query-д.

**Application validation**:
- `status = 'rejected'` ⇒ `note IS NOT NULL`.

---

## 8. `leave_request_status_history` (NEW — audit log)

| Багана | Төрөл | NOT NULL | Default | Тайлбар |
|---|---|---|---|---|
| `id` | bigint | ✓ | identity | PK |
| `leave_request_id` | bigint | ✓ | — | FK → `leave_requests(id)` ON DELETE CASCADE |
| `from_status` | text | — | — | NULL=initial |
| `to_status` | text | ✓ | — | |
| `changed_by_profile_id` | bigint | — | — | FK → `profile(id)`. NULL=system (auto-skip etc) |
| `note` | text | — | — | |
| `changed_at` | timestamptz | — | `now()` | |

**Index**: `(leave_request_id, changed_at DESC)`.

---

## RLS Policies

Бүх 6 шинэ + 2 өргөтгөсөн хүснэгтэд RLS асаална.

### `leave_requests` (өөрчлөгдсөн)

```sql
-- Одоо байгаа policies-ыг хадгална (insert own, read own).
-- Шинээр нэмэх:

-- Reviewer өөрт хуваарилагдсан хүсэлтийг харна
CREATE POLICY "Reviewer reads assigned requests"
ON leave_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leave_request_instances inst
    JOIN leave_request_step_reviewers rev ON rev.instance_id = inst.id
    WHERE inst.leave_request_id = leave_requests.id
      AND rev.reviewer_profile_id = public.current_profile_id()
  )
);

-- leave:admin permission-той хэрэглэгч бүгдийг хардаг
CREATE POLICY "Admin reads all leave requests"
ON leave_requests FOR SELECT TO authenticated
USING (public.has_permission('leave', 'admin'));

-- Update: зөвхөн өөрөө cancel + admin
CREATE POLICY "User cancels own pending requests"
ON leave_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin updates any request"
ON leave_requests FOR UPDATE TO authenticated
USING (public.has_permission('leave', 'admin'));
```

### `leave_request_instances`, `leave_request_step_reviewers`, `leave_request_status_history`

```sql
-- read: хүсэлт илгээгч, өөртөө хуваарилагдсан reviewer, admin
-- write: зөвхөн server-side action (no client direct write — но RLS-аар хорьж байх)
ALTER TABLE leave_request_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own/reviewer/admin"
ON leave_request_instances FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leave_requests lr
    WHERE lr.id = leave_request_instances.leave_request_id
      AND lr.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM leave_request_step_reviewers rev
    WHERE rev.instance_id = leave_request_instances.id
      AND rev.reviewer_profile_id = public.current_profile_id()
  )
  OR public.has_permission('leave', 'admin')
);
-- (тус бүр step_reviewers, status_history-д ижил үндэстэй policy)
```

### `leave_request_processes`, `_steps`, `_step_roles`, `leave_types`

```sql
-- Read: authenticated бүгд (нийтлэг lookup)
-- Write: зөвхөн leave:admin
CREATE POLICY "Authenticated reads processes"
ON leave_request_processes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin writes processes"
ON leave_request_processes FOR ALL TO authenticated
USING (public.has_permission('leave', 'admin'))
WITH CHECK (public.has_permission('leave', 'admin'));
```

---

## Permissions Seed Data

Migration-д дараах permission row-уудыг insert хийнэ:

```sql
INSERT INTO permissions (module, action, description) VALUES
  ('leave', 'access', 'Өөрийн чөлөөний хүсэлтийг харах'),
  ('leave', 'create', 'Шинэ чөлөөний хүсэлт илгээх'),
  ('leave', 'review', 'Чөлөөний хүсэлт хянах, баталгаажуулах'),
  ('leave', 'admin', 'Чөлөөний төрөл, workflow удирдах + бүх хүсэлт харах')
ON CONFLICT (module, action) DO NOTHING;
```

Default role grants (admin-ийн зүгээс орчны setup-аас гадуур):
- `super_admin` → бүх 4 permission.
- `hr_emp` → `leave:review`, `leave:access`.
- Бусад authenticated → `leave:access`, `leave:create`.
- `leave:admin` нь super_admin-ээс өөр separate role руу шаардлагатай бол UI-аар оноох.

---

## Indexes (performance)

```sql
CREATE INDEX idx_leave_requests_user_status ON leave_requests(user_id, status);
CREATE INDEX idx_leave_requests_created_at ON leave_requests(created_at DESC);
CREATE INDEX idx_leave_step_reviewers_pending ON leave_request_step_reviewers(reviewer_profile_id, status) WHERE status = 'pending';
CREATE INDEX idx_leave_instances_active ON leave_request_instances(status, current_step_order) WHERE status = 'in_progress';
CREATE INDEX idx_leave_status_history_request ON leave_request_status_history(leave_request_id, changed_at DESC);
```

---

## Migration outline (нэгдсэн)

`supabase/migrations/<timestamp>_leave_requests_workflow.sql`:

1. CREATE TABLE: `leave_request_processes`, `leave_request_steps`, `leave_request_step_roles`, `leave_request_instances`, `leave_request_step_reviewers`, `leave_request_status_history`.
2. ALTER TABLE `leave_types`: ADD `process_id`.
3. ALTER TABLE `leave_requests`: ADD `start_date`, `end_date`, `is_half_day`, `updated_at`; ALTER `duration_days` TYPE numeric; UPDATE CHECK constraints.
4. CREATE FUNCTION + TRIGGER `set_leave_request_updated_at`.
5. ENABLE RLS + CREATE POLICY-ууд (дээрх).
6. INSERT permissions seed.
7. CREATE INDEX-үүд.

Rollback стратеги:
- DROP TRIGGER, DROP FUNCTION.
- DROP POLICY бүгд.
- DROP TABLE 6 шинэ (cascade).
- ALTER TABLE leave_types DROP COLUMN process_id.
- ALTER TABLE leave_requests DROP COLUMN start_date, end_date, is_half_day, updated_at; ALTER duration_days back to int; restore old CHECK.
- DELETE FROM permissions WHERE module='leave'.

---

## `types/db.ts` regeneration

Migration apply-ийн дараа дараах команд (constitution Зарчим II):

```bash
# web (bgs.mn):
npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts

# mobile (bgs-mobile-app):
cd ../bgs-mobile-app && npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts
```

`shared-context/SUPABASE_SCHEMA.md`-д шинэ хүснэгт болон өргөтгөл багана нэмж бүртгэнэ.
