# Эрх Зүйн Акт Нэмэх Ажлын Төлөвлөгөө

## Зорилго

`Журам` module дотор “Эрх зүйн акт” хэсэг нэмнэ. Үүнд даргын 03 болон 04 тушаалууд бүртгэгдэнэ.

- `03`: Сахилгын шийтгэлийн тушаал. Эхний хувилбарт зөвхөн актын бүртгэл байна.
- `04`: Журам шинэчлэх тушаал. Журмын нэр, бүлэг, заалттай холбогдож, тухайн хэсэг ямар тушаалаар шинэчлэгдсэнийг харуулна.
- Тушаалыг гараар текстээр оруулах болон файл хавсаргах боломжтой байна.
- Файл private Supabase Storage bucket-д хадгалагдаж, нэвтэрсэн хэрэглэгч signed URL-ээр үзнэ.

## Хэрэгжүүлэлтийн явц

1. Database migration нэмэх.
2. Legal act унших/үүсгэх server actions нэмэх.
3. File upload болон signed URL API route нэмэх.
4. Sidebar болон `/policy/legal-acts` route-ууд нэмэх.
5. Policy detail дээр 04 revision history болон clause badge харуулах.
6. Focused lint/type check ажиллуулах.

## Database

Шинэ хүснэгтүүд:

- `legal_acts`: даргын тушаалын үндсэн бүртгэл.
- `legal_act_attachments`: тушаалын хавсралт файлын metadata.
- `policy_revisions`: 04 тушаалаар үүссэн журмын шинэчлэлийн бүртгэл.
- `policy_revision_targets`: 04 тушаал яг ямар policy/section/clause шинэчилснийг хадгална.

Storage:

- `policy-legal-acts` private bucket.
- PDF, image, Word document төрлийн file зөвшөөрнө.
- Файлыг public URL-аар биш signed URL-аар үзүүлнэ.

## UI

- `/policy/legal-acts`: 03/04 тушаалын жагсаалт.
- `/policy/legal-acts/new`: шинэ тушаал бүртгэх form.
- `/policy/legal-acts/[id]`: тушаалын дэлгэрэнгүй.
- `/policy/[policy_id]`: эрх зүйн актын шинэчлэлийн түүх, clause-level badge.

## Анхаарах зүйл

- Эхний хувилбарт 03 тушаал ажилтантай холбогдох сахилгын workflow хийхгүй.
- 04 тушаал full text diff хадгалахгүй. Зөвхөн ямар policy/section/clause шинэчлэгдсэнийг target + note байдлаар хадгална.
- Шинэ legal act хүснэгтүүд дээр RLS enabled, тодорхой policy-той байна.
- Одоогийн repo-д олон хуучин public table дээр RLS disabled хэвээр байгаа. Энэ feature тэр асуудлыг томруулахгүй, харин шинэ table-уудыг хамгаалалттай үүсгэнэ.
