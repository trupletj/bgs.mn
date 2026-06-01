# Quickstart: Чөлөөний хүсэлт хөгжүүлэлт + smoke test

**Branch**: `001-leave-requests` | **Date**: 2026-05-26

Энэ заавар нь хөгжүүлэгчид feature-ыг локал орчинд эхлүүлэх + 3 хэрэглэгчийн persona-аар end-to-end шалгах алхмуудыг агуулна.

---

## 1. Хөгжүүлэлтийн орчин

### Урьдчилсан шалгалт

- Node.js, npm суулгасан.
- Repo cloned, `.env.local`-д `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY` тохирсон.
- Branch `001-leave-requests`-д шилжсэн (`git checkout 001-leave-requests`).

### Зависимостойг суулгах

```bash
npm install
```

---

## 2. Schema migration (constitution Зарчим II — `#supabase-schema`-аар тохирсны дараа)

### 2.1 Migration file

`supabase/migrations/<timestamp>_leave_requests_workflow.sql` — `data-model.md`-ийн "Migration outline" хэсгийн дагуу бэлдэнэ.

### 2.2 Cloud-руу apply

**ХЭЗЭЭ Ч `supabase db push` локал stack-ыг ашиглахгүй**. MCP `apply_migration` ашиглана:

```
mcp__supabase__apply_migration({
  name: "leave_requests_workflow",
  query: <SQL агуулга>
})
```

### 2.3 Type re-generation (web + mobile)

```bash
# bgs.mn (одоо энд байгаа)
npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts

# bgs-mobile-app (тус repo руу шилжих)
cd ../bgs-mobile-app
npx supabase gen types typescript --project-id ljlywyhpxsutvrdeyyla --schema public > types/db.ts
cd -
```

### 2.4 `shared-context` шинэчлэх

`../shared-context/SUPABASE_SCHEMA.md`-д `leave_request_processes`, `_steps`, `_step_roles`, `_instances`, `_step_reviewers`, `_status_history` хүснэгт болон `leave_requests` өргөтгөлийг бүртгэх. Commit-аа `shared-context` repo руу push.

---

## 3. Dev server эхлүүлэх

```bash
npm run dev
# http://localhost:3000
```

---

## 4. Smoke test (3 persona)

### Persona A — Энгийн ажилтан

**Тест өгөгдөл**: `permissions = ['leave:access', 'leave:create']`, role нь reviewer биш.

1. Login (OTP) хийх.
2. Sidebar-д "Чөлөө" харагдаж байгаа эсэхийг шалгах. Sub-цэс: "+ Хүсэлт илгээх" л байх ёстой ("Хяналт" badge байхгүй).
3. `/leave-requests/add`-руу очих.
4. Form-ыг бөглөх:
   - Leave type: "Ээлжийн чөлөө" (process_id-той байх).
   - start_date: маргааш, end_date: 3 хоногийн дараа.
   - description: "Гэр бүлийн ажил".
5. Submit → toast "Хүсэлт амжилттай илгээгдлээ" + redirect `/leave-requests/[id]`.
6. Дэлгэрэнгүй хуудсанд workflow indicator харагдаж, "Шат 1" нь pending, reviewer-уудын нэрс жагсаасан байх.
7. `/leave-requests`-руу буцаж, хүсэлт `in_review` статустай харагдах эсэх шалгах.
8. Хүсэлтийг нээж "Цуцлах" → AlertDialog → confirm → статус `cancelled` болох эсэх.

### Persona B — Reviewer (HR / Manager)

**Тест өгөгдөл**: `permissions = ['leave:access', 'leave:create', 'leave:review']`, role нь process step 1-д тохирсон.

1. Login.
2. Sidebar "Чөлөө" > "Хяналт" дээр badge `[N]` харагдах (Persona A илгээсэн хүсэлтийн тоо).
3. `/leave-requests/review` → "Хүлээгдэж буй" tab → Persona A-ийн хүсэлт жагсаалтад орсон.
4. Card дээр "Дэлгэрэнгүй" → `/leave-requests/[id]`.
5. Action panel-д `[Зөвшөөрөх]` / `[Татгалзах]` товчнууд харагдах.
6. "Татгалзах" дарж → AlertDialog → тайлбаргүй → "Илгээх" → fieldError харагдах эсэхийг шалгах.
7. Тайлбар "Огноо нь нягтлан бодохчтой давхцаж байна" гэж бичээд → confirm → toast "Татгалзлаа" + хүсэлтийн статус `rejected` болсон.
8. Sidebar badge буурсан эсэх шалгах (cache refresh).
9. Persona A-аар буцаад login → Дэлгэрэнгүй хуудсанд status `rejected`, history дотор reviewer-ийн тайлбар харагдах.

### Persona B (extension) — Multi-step approval

Process нь 2 шаттай байх ёстой (`leave:admin` Persona C тохируулна).

1. Persona A шинэ хүсэлт илгээх.
2. Persona B (Step 1 reviewer) "Зөвшөөрөх" дарах → status `in_review` хэвээр, instance-ын `current_step_order = 2` болсон.
3. Persona D (Step 2 reviewer — өөр role) → `/leave-requests/review` → шинэ pending харагдах.
4. Persona D зөвшөөрөх → request status `approved` болж, instance `completed`.

### Persona C — Admin

**Тест өгөгдөл**: `role = super_admin` эсвэл `permissions = ['leave:admin']`.

1. Login.
2. Sidebar "Чөлөө" > "Чөлөөний төрөл".
3. `/leave-request-processes` → шинэ process үүсгэх:
   - Name: "Энгийн чөлөөний процесс"
   - Step 1: "HR баталгаажуулна", role = `hr_emp`.
   - Step 2: "Захирал зөвшөөрнө", role = `director`.
4. Save → жагсаалтад харагдах.
5. Leave type-уудын CRUD: шинэ type үүсгэх ба process_id-г энэ шинэ process-руу set.
6. Persona A-аар хүсэлт илгээ → шинэ workflow ажиллаж байгаа эсэхийг шалгах.

---

## 5. Edge case smoke

| Тохиолдол | Шалгах арга |
|---|---|
| `end_date < start_date` | Form-д warning гарах + submit дисэйбл болох |
| Half-day toggle | `start_date != end_date` бол toggle disabled |
| Файл 11MB | Frontend reject + sonner toast |
| Файл `.exe` | Frontend reject + sonner toast |
| Self-review skip | HR ажилтан өөрөө хүсэлт илгээх → step 1 auto-skipped, status дараагийн шат руу шилжсэн эсэх |
| Process удаах оролдлого (referenced) | Admin "Deactivate" товч л байх, физик delete биш |
| Concurrent approve (race) | DevTools-аас 2 reviewer нэг зэрэг submit хийх → давтан INSERT/status алдаа гарахгүй (advisory lock) |

---

## 6. Verification commands

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build production
npm run build
```

Бүгд amжилттай дуусах ёстой.

---

## 7. Rollback

Хэрвээ migration буруу гарвал:
1. `supabase/migrations/<timestamp>_leave_requests_workflow.sql`-ийн rollback хэсгийг (`data-model.md` дотор) тусдаа `<timestamp>_revert_leave_requests_workflow.sql` гэж бэлдэх.
2. MCP `apply_migration`-аар apply.
3. Type-ыг dahin gen хийх (web + mobile).
4. Git branch буцаах: `git revert <commit>` эсвэл шинээр fix-commit.
