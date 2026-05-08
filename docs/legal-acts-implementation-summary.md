# Эрх Зүйн Акт Implementation Summary

## Хийгдсэн зүйлс

`Журам` module дотор даргын 03 болон 04 тушаалыг бүртгэх “Эрх зүйн акт” хэсэг нэмсэн.

- Sidebar-ийн `Журам` хэсэгт `Эрх зүйн акт` болон `+ Эрх зүйн акт нэмэх` холбоос нэмсэн.
- `/policy/legal-acts` дээр 03/04 тушаалын жагсаалт гарна.
- `/policy/legal-acts/new` дээр шинэ эрх зүйн акт үүсгэнэ.
- `/policy/legal-acts/[id]` дээр актын дэлгэрэнгүй, хавсралт, холбоотой журмын шинэчлэлүүд харагдана.
- 03 тушаал одоогоор registry-only буюу тушаалын бүртгэл хэлбэрээр ажиллана.
- 04 тушаал policy/section/clause target-той revision үүсгэнэ.
- Файл хавсралт private Supabase Storage bucket-д хадгалагдаж, signed URL-аар үзэгдэнэ.
- `/policy/[policy_id]` detail дээр 04 тушаалаар шинэчлэгдсэн section/clause badge/link харагдана.
- `docs/legal-acts-implementation-plan.md` файлд анхны ажлын төлөвлөгөөг хадгалсан.
- `docs/supabase-database.md` файлд шинэ table болон bucket-ийн тайлбар нэмсэн.

## Өөрчлөгдсөн гол файлууд

- `supabase/migrations/20260508120000_add_policy_legal_acts.sql`
- `actions/policy-legal-acts.ts`
- `app/api/policy/legal-acts/route.ts`
- `app/api/policy/legal-acts/[id]/attachments/[attachmentId]/route.ts`
- `app/(protected)/policy/legal-acts/page.tsx`
- `app/(protected)/policy/legal-acts/new/page.tsx`
- `app/(protected)/policy/legal-acts/[id]/page.tsx`
- `components/policy/legal-acts/legal-act-form.tsx`
- `app/(protected)/policy/[policy_id]/page.tsx`
- `components/policy/policy-detail-content.tsx`
- `components/policy/SingleClause.tsx`
- `actions/nav.ts`
- `docs/supabase-database.md`
- `docs/legal-acts-implementation-plan.md`

## Өгөгдлийн сангийн зохион байгуулалт

Шинэ feature-ийн үндсэн table нь `legal_acts`.

### `legal_acts`

Даргын тушаалын үндсэн бүртгэл.

Гол талбарууд:

- `act_type`: `03` эсвэл `04`.
- `act_number`: тушаалын дугаар.
- `act_date`: тушаалын огноо.
- `title`: тушаалын гарчиг.
- `body_text`: гараар оруулсан тушаалын текст.
- `notes`: дотоод тэмдэглэл.
- `created_by`: бүртгэсэн profile.
- `is_deleted`: soft delete.

03 болон 04 тушаал хоёулаа эхлээд энэ table-д нэг мөр болж хадгалагдана.

### `legal_act_attachments`

Тушаалд хавсаргасан файлын metadata хадгална.

Холбоо:

- `legal_act_attachments.legal_act_id -> legal_acts.id`

Файл өөрөө database-д хадгалагдахгүй. Supabase Storage-ийн `policy-legal-acts` private bucket-д хадгалагдана. Энэ table зөвхөн `bucket`, `storage_path`, `file_name`, `mime_type`, `file_size` зэрэг мэдээллийг хадгална.

Хэрэглэгч attachment нээхэд app:

1. `legal_act_attachments`-оос bucket/path уншина.
2. Supabase Storage-оос 5 минутын signed URL үүсгэнэ.
3. Хэрэглэгчийг signed URL руу redirect хийнэ.

### `policy_revisions`

04 тушаалын журмын шинэчлэлийн үндсэн record.

Холбоо:

- `policy_revisions.legal_act_id -> legal_acts.id`
- `policy_revisions.policy_id -> policy.id`

Нэг 04 тушаал нэг policy revision үүсгэнэ. Энэ record нь “энэ 04 тушаал энэ журмыг шинэчилсэн” гэсэн үндсэн холбоос.

### `policy_revision_targets`

04 тушаал тухайн журмын яг аль хэсгийг шинэчилснийг хадгална.

Холбоо:

- `policy_revision_targets.policy_revision_id -> policy_revisions.id`
- `policy_revision_targets.policy_id -> policy.id`
- `policy_revision_targets.section_id -> section.id`
- `policy_revision_targets.clause_id -> clause.id`

`target_type` нь 3 утгатай:

- `policy`: журмын нэр эсвэл ерөнхий мэдээлэл шинэчлэгдсэн.
- `section`: тодорхой бүлэг шинэчлэгдсэн.
- `clause`: тодорхой заалт шинэчлэгдсэн.

`change_note` дээр тухайн target хэрхэн шинэчлэгдсэн тухай товч тайлбар хадгалагдана.

## Data flow

03 тушаал үүсгэх үед:

1. `legal_acts` дээр `act_type = '03'` мөр үүснэ.
2. Хавсралт байвал Storage-д файл upload хийгдэнэ.
3. `legal_act_attachments` дээр metadata хадгалагдана.
4. `policy_revisions` болон `policy_revision_targets` үүсэхгүй.

04 тушаал үүсгэх үед:

1. `legal_acts` дээр `act_type = '04'` мөр үүснэ.
2. Хавсралт байвал Storage-д файл upload хийгдэнэ.
3. `legal_act_attachments` дээр metadata хадгалагдана.
4. `policy_revisions` дээр холбоотой policy-ийн revision record үүснэ.
5. Сонгосон policy/section/clause бүрээр `policy_revision_targets` дээр мөрүүд үүснэ.
6. Policy detail унших үед app `policy_revisions` болон `policy_revision_targets`-оос тухайн журмын 04 тушаалуудыг уншиж section/clause дээр badge харуулна.

## Permission ба security

Одоогийн RBAC permission-уудыг ашигласан:

- Унших: `policy.access`
- Үүсгэх: `policy.create`
- Засах target одоогоор UI-д хийгдээгүй, migration policy нь `policy.edit`-д бэлэн.
- Устгах: `policy.delete`

Шинэ table-ууд дээр RLS enabled:

- `legal_acts`
- `legal_act_attachments`
- `policy_revisions`
- `policy_revision_targets`

Storage bucket:

- `policy-legal-acts`
- private bucket
- public URL байхгүй
- signed URL-аар үзнэ

## Шалгалт

Ажиллуулсан шалгалтууд:

- Focused ESLint changed files дээр амжилттай.
- `npx tsc --noEmit --pretty false` амжилттай.

Dev server:

- Sandbox дотор `npm run dev` эхлүүлэхэд `EPERM: listen 0.0.0.0:3000` гарсан.
- Escalated run дээр 3000 port ашиглагдаж байсан тул 3001 рүү шилжих гэж оролдсон.
- `.next/dev/lock` байгаа тул Next dev server дахин эхлээгүй.
- Одоо байгаа lock/process-ийг устгаагүй.

## Цаашид хийх зүйлс

1. Migration-ийг target Supabase database дээр apply хийх.
2. Migration apply хийсний дараа Supabase advisors дахин ажиллуулах.
3. `/policy/legal-acts/new` дээр 03 тушаал үүсгэж шалгах.
4. `/policy/legal-acts/new` дээр 04 тушаал үүсгэж policy/section/clause target сонгон шалгах.
5. `/policy/[policy_id]` detail дээр 04 revision badge/link зөв харагдаж байгаа эсэхийг browser дээр шалгах.
6. File upload болон signed URL redirect production bucket дээр ажиллаж байгаа эсэхийг шалгах.
7. Legal act edit UI нэмэх.
8. Attachment delete/replace UI нэмэх.
9. 03 сахилгын тушаалыг ажилтантай холбох workflow хэрэгтэй эсэхийг дараагийн phase-д шийдэх.
10. Хэрэв legalinfo.mn шиг илүү нарийн түүх хэрэгтэй бол full before/after diff model нэмэх эсэхийг тусад нь төлөвлөх.

## Анхаарах үлдсэн эрсдэл

- Одоогийн project дээр хуучин олон public table RLS disabled хэвээр байгаа. Энэ feature-ийн шинэ table-ууд RLS-тэй боловч хуучин `policy`, `section`, `clause` table-ууд өөрсдөө RLS disabled хэвээр байна.
- `has_permission` function дээр Supabase advisor `search_path` warning өгч байгаа. Шинэ RLS policy-ууд энэ function-ийг ашиглаж байгаа тул цаашид `has_permission` function-д `set search_path` нэмэх migration хийх нь зүйтэй.
- `policy_revisions` одоогоор full diff хадгалахгүй. Зөвхөн source act + target + note хадгална.
