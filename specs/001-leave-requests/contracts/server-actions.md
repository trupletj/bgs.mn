# Server Actions Contract: Чөлөөний хүсэлт

**Branch**: `001-leave-requests` | **Date**: 2026-05-26

Бүх Server Action нь `"use server"` директивтэй. Return shape constitution Зарчим III-ийн дагуу:
```ts
type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
```

---

## Файл: `actions/leave-requests.ts`

### `createLeaveRequestWithInstance(input)`

**Input** (zod):
```ts
const CreateLeaveRequestSchema = z.object({
  leave_type_id: z.number().int().positive(),
  start_date: z.string().date(),              // YYYY-MM-DD
  end_date: z.string().date(),
  is_half_day: z.boolean().default(false),
  description: z.string().max(2000).optional(),
  file: z.instanceof(File).optional()         // Frontend нь FormData-ээр илгээнэ
    .refine(f => !f || f.size <= 10 * 1024 * 1024, "Файл 10MB-аас ихгүй")
    .refine(f => !f || ["application/pdf","image/jpeg","image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(f.type), "Зөвхөн PDF/JPG/PNG/DOCX зөвшөөрөгдөнө")
}).refine(d => d.start_date <= d.end_date, {
  message: "end_date нь start_date-ээс өмнө байж болохгүй", path: ["end_date"]
}).refine(d => !d.is_half_day || d.start_date === d.end_date, {
  message: "Хагас өдөр сонгосон үед эхлэх/дуусах огноо адил байх", path: ["is_half_day"]
});
```

**Output**: `ActionResult<{ id: number }>`

**Logic**:
1. `createClient()`-ээс session/user_id.
2. Validate `hasPermission("leave", "create")`. Хэрвээ үгүй бол `{ ok: false, error: "Эрх хүрэхгүй" }`.
3. `duration_days` тооцоо: `is_half_day ? 0.5 : (end_date - start_date + 1)`.
4. File upload (хэрвээ бий) → `leave-attachments` bucket → `file_url`, `file_name`.
5. `leave_types.process_id`-г татах. NULL бол → legacy mode (status = `pending` шууд, instance үүсгэхгүй).
6. **Transaction**:
   - INSERT `leave_requests` (status = `in_review` хэрэв process бий, эс бөгөөс `pending`).
   - INSERT `leave_request_instances` + `process_snapshot` (steps + step_roles-г JSON болгож).
   - Step 1 reviewer-уудыг тогтоох:
     - `roles_profiles`-ээс step 1-ийн `step_roles.role_id`-той бүх profile.
     - `reviewer_profile_id != user_id` filter (self-skip).
     - INSERT `leave_request_step_reviewers` (status = pending).
     - Хэрвээ reviewer 0 → шатыг шууд skip болгож дараагийн руу шилжүүлэх (recursive auto-advance).
   - INSERT `leave_request_status_history` (`NULL → pending` эсвэл `NULL → in_review`).
7. `revalidatePath("/leave-requests")` + `revalidatePath("/leave-requests/review")`.
8. Return `{ ok: true, data: { id } }`.

**Side effects**: Storage upload, 4-5 INSERT, cache invalidation.

---

### `getMyLeaveRequests(options?)`

**Input**: `{ status?: LeaveStatus[], page?: number, pageSize?: number }`

**Output**: `ActionResult<{ items: LeaveRequestRow[], total: number }>`

**Logic**:
- SELECT `leave_requests` WHERE `user_id = auth.uid()` (RLS-аар enforce).
- JOIN `leave_types(name)`, latest `leave_request_instances(current_step_order, status)`.
- ORDER BY `created_at DESC`.
- Pagination + filter.

---

### `getAwaitingLeaveRequests(profile_id, type: "pending" | "reviewed")`

**Input**: `profile_id: bigint`, `type: "pending" | "reviewed"`

**Output**: `ActionResult<AwaitingLeaveRequest[]>` (`{ request_id, type_name, user_name, start_date, end_date, duration_days, step_order, status }`)

**Logic**:
- SELECT `leave_request_step_reviewers` WHERE `reviewer_profile_id = profile_id`.
- `type = "pending"`: status = `pending`, `instance.current_step_order = reviewer.step_order` (зөвхөн идэвхтэй шатанд).
- `type = "reviewed"`: status `IN ('approved','rejected','skipped')`.
- JOIN `leave_requests`, `leave_types`, `profile(name)`.
- Return шинэ нь дээр.

---

### `getLeaveRequestWithDetail(request_id)`

**Output**: `ActionResult<{ request, profile, leave_type, instance, reviewers, history }>`

**Logic**:
- RLS-аар auto-filter (өөрийн / reviewer / admin).
- Single query: `leave_requests` + JOIN-ууд.
- `reviewers` нь `step_order`-ээр grouped.
- `history` нь `changed_at DESC`.

---

### `approveLeaveStep(input)`

**Input** (zod):
```ts
{ request_id: z.number().int(), note: z.string().max(2000).optional() }
```

**Output**: `ActionResult<{ new_status: LeaveStatus }>`

**Logic**:
1. Current user profile_id татах.
2. `leave_request_step_reviewers`-ээс өөрийн `pending` мөрийг олох — байхгүй бол `{ ok: false, error: "Танд хянах эрх алга" }`.
3. **Transaction + advisory lock** (`pg_advisory_xact_lock(request_id::bigint)`):
   - UPDATE өөрийн мөрийг `approved` + `note`, `reviewed_at = now()`.
   - Тухайн шатны бүх reviewer-ийн статусыг шалгах:
     - Хэрвээ бүгд `approved` эсвэл `skipped`:
       - `process_snapshot`-аас дараагийн шат байгаа эсэхийг шалгах.
       - **Бий**: `instance.current_step_order++`, дараагийн шатны reviewer-уудыг INSERT (self-skip filter). Reviewer 0 → дахин recursive advance.
       - **Үгүй (сүүлчийн шат)**: `instance.status = 'completed'`, `instance.completed_at = now()`, `leave_requests.status = 'approved'`. INSERT status_history.
     - Бусад тохиолдолд: юу ч хийхгүй (бусад reviewer-ыг хүлээнэ).
4. `revalidatePath("/leave-requests")`, `/review`, `/leave-requests/${id}`.

---

### `rejectLeaveStep(input)`

**Input** (zod):
```ts
{ request_id: z.number().int(), note: z.string().min(3).max(2000) }  // note required
```

**Output**: `ActionResult`

**Logic**:
1. Self reviewer мөр шалгах.
2. Transaction:
   - UPDATE өөрийн мөрийг `rejected` + `note`, `reviewed_at = now()`.
   - UPDATE бусад `pending` reviewer-уудыг `skipped` (тухайн болон цаашдын шат).
   - UPDATE `instance.status = 'rejected'`, `completed_at = now()`.
   - UPDATE `leave_requests.status = 'rejected'`.
   - INSERT status_history.
3. `revalidatePath`.

---

### `cancelLeaveRequest(request_id)`

**Output**: `ActionResult`

**Logic**:
1. Validate: `user_id = auth.uid()` (RLS-аар) + status `IN ('pending','in_review')`.
2. Transaction:
   - UPDATE `leave_requests.status = 'cancelled'`.
   - UPDATE active instance.status = `cancelled`.
   - UPDATE all `pending` reviewer мөрүүдийг `skipped`.
   - INSERT status_history.
3. `revalidatePath`.

---

### `getPendingLeaveReviewCountForCurrentUser()`

**Output**: `ActionResult<number>`

**Logic**:
- Profile_id татах.
- `SELECT count(*) FROM leave_request_step_reviewers WHERE reviewer_profile_id = ? AND status = 'pending'`.
- Index `idx_leave_step_reviewers_pending`-ыг ашиглана.

---

## Файл: `actions/leave-processes.ts`

### `getLeaveTypesWithProcess()`

**Output**: `ActionResult<Array<{ id, name, process_id, process_name, is_active }>>`

### `createLeaveType(input)` / `updateLeaveType(id, input)` / `deactivateLeaveType(id)`
**Permission**: `leave:admin`.

### `createLeaveProcess(input)`
**Input**: `{ name, description?, steps: Array<{ name, role_ids: number[] }> }`
**Logic**: Transaction-аар process + steps + step_roles INSERT.

### `updateLeaveProcess(id, input)` / `deactivateLeaveProcess(id)`

### `getLeaveProcessWithSteps(id)`
**Output**: Process + steps + step_roles bundle.

### `assignProcessToLeaveType(leave_type_id, process_id)`
Set `leave_types.process_id`.

---

## Файл: `actions/nav.ts` (өөрчлөлт)

```ts
// Шинээр нэмэх
const hasLeaveAccess = await hasPermission("leave", "access");
const hasLeaveCreate = await hasPermission("leave", "create");
const hasLeaveReview = await hasPermission("leave", "review");
const hasLeaveAdmin = await hasPermission("leave", "admin");
const pendingLeaveReviewCount = hasLeaveReview
  ? await getPendingLeaveReviewCountForCurrentUser()
  : 0;

const leaveItems: NavSubItem[] = [];
if (hasLeaveReview) {
  leaveItems.push({
    title: "Хяналт",
    url: "/leave-requests/review",
    badgeCount: pendingLeaveReviewCount,
  });
}
if (hasLeaveAdmin) {
  leaveItems.push({ title: "Чөлөөний төрөл", url: "/leave-request-processes" });
}
if (hasLeaveCreate) {
  leaveItems.push({ title: "+ Хүсэлт илгээх", url: "/leave-requests/add" });
}
if (hasLeaveAccess || hasLeaveCreate || leaveItems.length > 0) {
  services.push({
    key: "leave",
    title: "Чөлөө",
    url: "/leave-requests",
    basePaths: ["/leave-requests", "/leave-request-processes"],
    items: leaveItems,
    badgeCount: pendingLeaveReviewCount,
  });
}
```

---

## Алдааны хариу stand-table

| Тохиолдол | `error` мессеж |
|---|---|
| Permission denied | "Танд энэ үйлдлийн эрх алга" |
| Validation fail | zod-ийн `fieldErrors` |
| Reviewer not found | "Танд энэ хүсэлтийг хянах эрх алга" |
| Already reviewed | "Та аль хэдийн шийдвэр гаргасан байна" |
| Invalid status transition | "Хүсэлтийн төлөв энэ үйлдлийг зөвшөөрөхгүй" |
| Storage upload fail | "Файл хадгалах үед алдаа гарлаа" |
| Internal | `error.message` шууд (logging-д) |
