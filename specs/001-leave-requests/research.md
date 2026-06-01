# Phase 0 Research: Чөлөөний хүсэлт (Leave Requests)

**Branch**: `001-leave-requests` | **Date**: 2026-05-26

Энэ файлд spec шатнаас үлдсэн design judgment-ыг баримтжуулсан. Бүх `NEEDS CLARIFICATION` спек шатанд аль хэдийн шийдэгдсэн (multi-step workflow, start+end date + half-day, балансгүй v1).

---

## 1. Workflow шилжих логикийг хаана хадгалах вэ — DB trigger уу, Server Action уу?

**Decision**: **Server Action** дотор үлдэх. Status шилжилт болон reviewer томилгоог `actions/leave-requests.ts`-ийн `approveLeaveStep`, `rejectLeaveStep` доторх transaction-ыг ашиглан хийнэ.

**Rationale**:
- Orders module нь яг ижил логикийг `actions/orders.ts` дотор хадгалдаг (`createOrderWithInstace`, reviewer auto-томилгоо). Тогтсон pattern-ыг дагах нь maintainability-д хамгийн чухал.
- DB trigger нь "magic" хэт ихэсгэх, debugging хүндрүүлдэг. Constitution-ы YAGNI зарчмыг зөрчинө.
- Server action транзакц нь Postgres `transaction` (Supabase RPC + tx) ашиглах боломжтой; хэрвээ Action давхар race condition үүсгэвэл advisory lock эсвэл `pg_advisory_xact_lock`-ыг тухайн action дотор нэмж болно.

**Alternatives considered**:
- `BEFORE UPDATE` trigger дээр шилжилт хийх — orders pattern зөрчигдөнө.
- `security definer` RPC дотор шилжилт хийх — constitution зарчим IV-ийн дагуу `set search_path = public` шаардлагатай ба `current_profile_id()`-г ашиглана. Илүү код, ашиг тус нь маргаантай. Хэрвээ ирээдүйд race condition асуудал гарвал энэ хувилбар руу шилжих боломжтой.

---

## 2. `is_half_day` UX

**Decision**: Хагас өдрийг **энгийн toggle**-аар v1-д хэрэгжүүлнэ (AM/PM сонголтгүй). `is_half_day = true` бол `duration_days = 0.5` (нэг өдрийн хүсэлт). Олон өдрийн хагас өдөр (start-ын өглөө + end-ийн оройн хагас) v1-ийн scope-оос гадуур.

**Rationale**:
- HR-ын одоогийн практикт хагас өдөр гэдгээ "тэр өдөр өглөөнөөс/үдээс хойш гарна" гэдгийг хүний амьдан тохирдог. Системийн нарийвчлал шаардлагагүй.
- Form-ын төвөгшил буурна. Хэрэглэгчийн төөрөгдөл багасна.

**Alternatives considered**:
- AM/PM сонголт нэмэх (`half_day_period: 'AM' | 'PM'`) — UX илүү нарийвчлалтай, гэхдээ v1-ийн хэрэгцээгүй.
- Цагаар оруулах (`hours_off`) — энэ нь "цаг тооцолт" гэсэн өөр feature болж хувирна. Scope-оос гадуур.

**Validation rule**:
- `is_half_day = true` бол `start_date = end_date` заавал.
- `duration_days` нь auto-calc: `is_half_day ? 0.5 : (end_date - start_date + 1)`.

---

## 3. Файл хавсралтын валидация

**Decision**: **Client + Server хоёрдмол шалгалт**. Client-side нь `react-hook-form` + `zod`-аар instant feedback өгнө. Server-side action нь `formData.get("file")` болсон Blob/File-ийн MIME type болон size-ыг дахин шалгана. Supabase Storage upload болгох өмнө reject хийнэ.

**Rationale**:
- Client-only шалгалт нь "trust the browser" — DevTools-оос тойрч болно.
- Constitution III: action нь mutation бүрд `{ ok: false, error }`-аар буцаах ёстой.

**Allowed types**: `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
**Max size**: 10 MB.

**Alternatives considered**:
- Зөвхөн client-side шалгалт — security risk.
- Supabase Storage-д policy-аар enforce — RLS policy дотор MIME шалгах боломжгүй. File listing-аар хязгаарлахаас өөр гарц алга.

---

## 4. Mobile flat-status хүсэлтүүдийн нийцтэй байдал

**Decision**: Backward compatibility-ийг **schema-ийн дизайнаар** хадгална:
- `leave_requests.status` CHECK constraint-ийг өргөтгөж `pending | in_review | approved | rejected | cancelled` болгоно.
- `start_date`, `end_date`, `is_half_day` багана **NULL зөвшөөрөхүйц** болгож нэмнэ (хуучин мөрүүд NULL хэвээр үлдэнэ).
- Шинэ хүсэлт `start_date IS NOT NULL`-ийг application layer-аас баталгаажуулна (zod). Хүсвэл cleanup migration-аар хуучин мөрд `created_at::date`-ыг back-fill хийж болно (Phase 2 task).
- `leave_request_instances` шинэ хүснэгт — хуучин мөр instance-гүй үлдэх ба mobile-аас уншиж буй `status` талбар хэвээр ажиллана.

**Rationale**:
- Цоо шинэ schema хийвэл mobile апп тэр даруй эвдэрнэ.
- NULL зөвшөөрөл нь хуучин өгөгдлийг алдалгүй, шинэ workflow-г паралельаар ажиллуулна.
- Хуучин мөрүүдийг "legacy" гэж зориудаар үлдээж, HR хяналтаар хаана.

**Alternatives considered**:
- Хуучин мөрүүдийг бүгдийг "default workflow process"-руу буцаан угсрах migration — risky, өгөгдлийн алдагдал болох магадлалтай.
- `is_legacy boolean` баганаар тэмдэглэх — нэмэлт complexity, real ашиг тус багa.

---

## 5. Cancellation policy

**Decision**: Зөвхөн **хүсэлт илгээгч өөрөө**, статус нь `pending` эсвэл `in_review` байх үед цуцлах боломжтой. Action: `cancelLeaveRequest(id)`:
- RLS: `auth.uid() = leave_requests.user_id`.
- Application validation: `status IN ('pending', 'in_review')`.
- Status `cancelled` болгож, идэвхтэй `leave_request_step_reviewers` мөрүүдийг `skipped` болгоно.
- `leave_request_status_history`-д бүртгэнэ.

**Rationale**:
- Approved хүсэлтийг цуцалбал HR-ын төлөвлөгөө эвдэрнэ; admin зөвхөн backend-аас нөхөн шийднэ.
- Reviewer-ын шийдсэн `approved`/`rejected` мөрүүдийг алдалгүй log-д үлдээнэ.

**Alternatives considered**:
- HR-ын зүгээс хүсэлтийг "revoke" хийх — v1-ийн scope-оос гадуур (`leave:admin`-аар admin шууд DB засах боломжтой).
- Approved хүсэлтийг "request to cancel" workflow-руу буцаах — over-engineering, YAGNI зөрчинө.

---

## 6. Reviewer auto-skip (self-review prevention)

**Decision**: `createLeaveRequestWithInstance` action нь reviewer мөрүүдийг insert хийхдээ `reviewer_profile_id != leave_request.user_id`-ийг filter хийнэ. Хэрвээ нэг ч reviewer үлдээгүй бол тухайн шатыг automatically pass хийж (`status = 'skipped'`), дараагийн шат руу шилжинэ. Хэрвээ бүх шат skip болвол хүсэлтийн статус `approved` болно (auto-approval).

**Rationale**:
- Spec-ийн edge case-д тусгасан.
- HR-ийн ажилтан өөрийн чөлөөгөө илгээх үед өөрийгөө хянахгүй гэдэг ёс зүйн зарчмыг хангана.
- "Бүх шат skip → auto-approve" хувилбар нь жижиг organization (1-2 HR ажилтан) дээр эвдрэлгүй ажиллана.

**Alternatives considered**:
- Self-review-ийг өгсөнгүй гэдэг алдаа гаргах ба админ гар аргаар оноох — workflow зогсооно, муу UX.
- Reviewer багасахад auto-skip-ын оронд "fallback reviewer" тогтоох — process schema-ыг нарийсгана. Хожим Phase 3-д нэмж болно.

---

## 7. Notification channel

**Decision**: v1-д **зөвхөн sidebar nav badge** ашиглана (orders-той ижил). Email/push notification v2-руу хойшлуулна.

**Rationale**:
- Орчинд push notification infrastructure (notification service, SMTP credentials) одоо тогтсонгүй.
- Sidebar badge нь хэрэглэгчийн ажлын урсгалд дээд багаар нийцнэ — login хийсэн үед шууд харагдана.
- Hard scope-оос гадуурх complexity-ыг хязгаарлана.

**Alternatives considered**:
- Email notification (Supabase Edge Function + Resend/SendGrid) — нэмэлт credentials, нэмэлт зардал.
- Browser push notification — service-worker setup, permission UX-ийн төвөг.

---

## 8. Process snapshot (workflow change resilience)

**Decision**: `leave_request_instances`-д **`process_snapshot jsonb`** багана нэмэх. Хүсэлт үүсэх үед тухайн process-ын steps + step roles-ыг snapshot хийж хадгалдаг. Process бараа дундуур засагдсан ч (admin шинэ шат нэмэх г.м) одоогийн идэвхтэй instance нь хуучин snapshot-аа дагаж дуусна.

**Rationale**:
- Spec-ийн edge case-д тусгасан.
- Orders module нь snapshot хэрэгжүүлээгүй (live process-ыг дагадаг), гэхдээ leave-ын business logic-д "хүсэлт илгээсэн үеийн дүрэм" нь chuluu policy-той илүү тохирно.
- JSON snapshot нь хуучин workflow-г replay-ийн зориулалттай — DB layer-ын retroactive өөрчлөлтөөс хамгаална.

**Alternatives considered**:
- Snapshot хэрэггүй (live process-ыг дагах) — orders pattern. Гэхдээ leave-ын аудит хатуу шаардаж байвал эрсдэлтэй.
- Тусдаа `process_version` ширхэглэх — over-engineering. JSON snapshot нь хамгийн хялбар.

---

## Шийдвэрүүдийн нэгдсэн товч хүснэгт

| № | Сэдэв | Шийдэл |
|---|---|---|
| 1 | Workflow transition logic | Server Action (orders pattern) |
| 2 | Хагас өдрийн UX | Энгийн toggle, `start = end`, `duration = 0.5` |
| 3 | File validation | Client + server, 10MB, PDF/JPG/PNG/DOCX |
| 4 | Mobile backward compat | NULL-зөвшөөрөхүй огнооны багана + status өргөтгөл |
| 5 | Cancellation | Зөвхөн өөрийн `pending|in_review` хүсэлт |
| 6 | Self-review prevention | Auto-skip filter, бүгд skip бол auto-approve |
| 7 | Notification | Sidebar badge зөвхөн v1 |
| 8 | Process change resilience | `process_snapshot jsonb` instance дотор |

Бүх `NEEDS CLARIFICATION` шийдсэн. Phase 1-руу шилжих бэлэн.
