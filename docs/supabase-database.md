# Supabase өгөгдлийн сангийн бүтэц

Шинэчилсэн огноо: 2026-05-01

Энэ баримт нь Supabase MCP-ээр уншсан одоогийн database metadata болон `supabase/migrations/` дахь migration түүх дээр тулгуурласан. Мөрийн тоо нь PostgreSQL-ийн estimated row count тул яг live `count(*)` биш.

## Товч зураглал

- Үндсэн application schema: `public`
- Legacy/source sync schema: `target`
- Storage buckets: `order-item-bucket` public, `leave-attachments` private
- Custom enum: `eelj_request_status`, `meal_type_enum`
- Нийт public table: 50 орчим
- Анхаарах зүйл: `public` schema-ийн олон table дээр RLS идэвхгүй байна. Supabase Data API-д ил байвал access control-ийг service action эсвэл RLS policy-оор тусад нь баталгаажуулах шаардлагатай.

## Бүлэг 1: Хэрэглэгч, profile, auth, эрх

Энэ бүлэг нь Supabase Auth user, байгууллагын ажилтан, profile, role/permission-г холбодог.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `users` | BTEG/source ажилтны үндсэн бүртгэл; `auth.users`-тай `auth_user_id`-аар холбогдоно | `id` | 2789 | Off |
| `profile` | App дотор ашиглах profile; `auth_user_id`, `phone` unique | `id` | 10 | Off |
| `roles` | Role master data | `id` | 2 | Off |
| `roles_profiles` | Profile-role assignment | `id` | 8 | Off |
| `permissions` | Permission master data | `id` | 1 | Off |
| `role_permissions` | Role-permission assignment | `id` | 1 | Off |

Гол холбоосууд:

- `users.auth_user_id -> auth.users.id`
- `profile.auth_user_id -> auth.users.id`
- `roles_profiles.profile_id -> profile.id`
- `roles_profiles.role_id -> roles.id`
- `role_permissions.role_id -> roles.id`
- `role_permissions.permission_id -> permissions.id`

Холбогдох function/trigger:

- `link_auth_user_to_public_user()` шинэ Auth user-ийг `users.phone`-оор холбодог.
- `create_profile_from_auth_user()` Auth user үүсэхэд `profile` үүсгэнэ/шинэчилнэ.
- `delete_profile_on_auth_user_delete()` Auth user устахад profile устгана.
- `current_profile_id()` одоогийн Auth user-ийн profile id-г буцаана.
- `has_permission(p_user_id, p_module, p_action)` permission шалгана.

## Бүлэг 2: Байгууллагын бүтэц, хүний нөөцийн лавлах

Энэ бүлэг нь байгууллага, газар, хэлтэс/алба, албан тушаалын лавлах өгөгдөл.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `organization` | Байгууллага | `id` | 0 | Off |
| `gazar` | Газар | `id` | 0 | On |
| `heltes` | Хэлтэс | `id` | 54 | Off |
| `alba` | Алба/нэгж | `id` | 111 | Off |
| `job_position` | Албан тушаал | `id` | 1025 | Off |
| `job_description` | Албан тушаалын тодорхойлолт | `id` | 0 | Off |

Гол холбоосууд:

- `gazar.organization_id -> organization.bteg_id`
- `heltes.organization_id -> organization.bteg_id`
- `heltes.gazar_id -> gazar.bteg_id`
- `alba.organization_id -> organization.bteg_id`
- `alba.gazar_id -> gazar.bteg_id`
- `alba.heltes_id -> heltes.bteg_id`
- `job_position.organization_id/gazar_id/heltes_id/alba_id -> ...bteg_id`
- `users.organization_id/heltes_id/department_id -> organization/heltes/alba.bteg_id`

Legacy sync:

- `target.g_organization`, `target.g_gazar`, `target.g_heltes`, `target.g_department`, `target.g_job_position` table-үүдээс `public` schema руу trigger-ээр sync хийдэг.

## Бүлэг 3: Захиалга, workflow, reviewer

Захиалга үүсгэх, item, workflow, review step, fulfillment-тэй холбоотой үндсэн module.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `orders` | Захиалгын толгой мэдээлэл | `id` | 1 | Off |
| `order_items` | Захиалгын бараа/сэлбэгийн мөр | `id` | 3 | Off |
| `sub_order_item` | Дэд item/reviewer assignment | `id` | 0 | Off |
| `order_workflow` | Status шилжилтийн log | `id` | 0 | Off |
| `order_status_history` | Status history | `id` | 0 | Off |
| `order_processes` | Захиалгын процесс template | `id` | 1 | Off |
| `order_steps` | Процессийн алхам | `id` | 4 | Off |
| `order_step_roles` | Алхамд зөвшөөрөгдөх role | `id` | 4 | Off |
| `order_step_reviewers` | Алхамын reviewer | `id` | 1 | Off |
| `order_instances` | Захиалга дээрх process instance | `id` | 1 | Off |
| `order_fulfillment` | Item fulfillment мэдээлэл | `id` | 2 | Off |
| `fulfillment_status_history` | Fulfillment status history | `id` | 3 | Off |

Гол холбоосууд:

- `orders.created_profile -> profile.id`
- `orders.auth_user_id -> auth.users.id`
- `orders.order_process_id -> order_processes.id`
- `order_items.order_id -> orders.id`
- `sub_order_item.order_id -> orders.id`
- `sub_order_item.order_item_id -> order_items.id`
- `sub_order_item.created_by/reviewer_profile_id -> profile.id`
- `order_workflow.order_id -> orders.id`
- `order_workflow.changed_by -> users.id`
- `order_instances.order_id -> orders.id`
- `order_fulfillment.order_item_id -> order_items.id`

Холбогдох function/trigger:

- `generate_order_number()` болон `set_order_number()` захиалгын дугаар үүсгэнэ.
- `trigger_set_order_number` нь `orders` дээр `BEFORE INSERT`.
- `transition_order_status(...)` захиалгын төлөв шилжүүлнэ.

## Бүлэг 4: Хоол, хоолны танхим, kiosk

Ажилтны хоолны тохиргоо, хоол идсэн log, kiosk, тогооч, өдөр тутмын summary.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `dining_hall` | Хоолны танхим | `id` | 0 | On |
| `chefs` | Тогооч/оператор | `id` | 6 | On |
| `kiosks` | Kiosk төхөөрөмжийн бүртгэл | `id` | 12 | On |
| `meal_logs` | Хоол идсэн бүртгэл | `id` | 42684 | On |
| `meal_time_slots` | Хоолны цагийн тохиргоо | `id` | 15 | Off |
| `user_meal_configs` | Ажилтны хоолны байрлал/тохиргоо | `id` | 1886 | On |
| `meal_location_overrides` | Байршлын түр override | `id` | 6 | On |
| `daily_meal_summary` | Өдрийн нэгтгэл | `id` | 60 | Off |
| `sub_employee_for_food` | Дэд/түр ажилтны хоолны бүртгэл | `id` | 7 | Off |
| `sub_employee_meal_plans` | Дэд ажилтны хоолны төлөвлөгөө | `id` | 1 | Off |

Гол холбоосууд:

- `chefs.dining_hall_id -> dining_hall.id`
- `kiosks.dining_hall_id -> dining_hall.id`
- `meal_logs.user_id -> users.id`
- `meal_logs.sub_employee_id -> sub_employee_for_food.id`
- `user_meal_configs.user_id -> users.id`
- `user_meal_configs.*_location -> dining_hall.id`
- `meal_location_overrides.user_id -> users.id`
- `daily_meal_summary.dining_hall_id -> dining_hall.id`

RLS policy тойм:

- `dining_hall`: public SELECT, authenticated INSERT/UPDATE/DELETE.
- `chefs`, `kiosks`: public SELECT/INSERT/UPDATE, authenticated ALL.
- `meal_logs`: public SELECT/INSERT, authenticated ALL.
- `user_meal_configs`: public SELECT, authenticated ALL.
- `meal_location_overrides`: public SELECT/INSERT/UPDATE/DELETE.

Холбогдох function/view:

- `users_with_stats` view нь `get_users_with_stats()` RPC-г view болгон харуулдаг.
- `get_meal_breakdown_by_org(...)`, `get_meal_expected_vs_actual(...)`, `get_meal_employee_details(...)`
- `refresh_daily_meal_summary()`
- `sync_meal_config_bteg_id()` нь `user_meal_configs` insert дээр `bteg_id` бөглөнө.

## Бүлэг 5: Төхөөрөмж, asset, хүсэлт

Компьютер, монитор, бусад төхөөрөмжийн бүртгэл, шилжилт, засвар, хүсэлт.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `devices` | Төхөөрөмжийн үндсэн бүртгэл | `id` | 229 | Off |
| `device_assignments` | Төхөөрөмж-хэрэглэгч assignment | `id` | 175 | Off |
| `device_history` | Төхөөрөмжийн өөрчлөлтийн түүх | `id` | 380 | Off |
| `device_maintenance` | Засвар үйлчилгээ | `id` | 0 | Off |
| `device_requests` | Шинэ, солих, шилжүүлэх, актлах, засварын хүсэлт | `id` | 19 | Off |
| `device_request_comments` | Хүсэлтийн comment | `id` | 0 | Off |
| `device_request_status_history` | Хүсэлтийн status history | `id` | 1 | Off |

Гол холбоосууд:

- `devices.organization_id -> organization.id`
- `devices.heltes_id -> heltes.id`
- `devices.alba_id -> alba.id`
- `devices.created_by -> profile.id`
- `devices.paired_with_device_id -> devices.id`
- `device_assignments.device_id -> devices.id`
- `device_assignments.user_id -> users.id`
- `device_requests.old_device_id -> devices.id`
- `device_requests.created_by/assigned_to -> profile.id`
- `device_requests.parent_request_id/fulfilled_by_request_id -> device_requests.id`
- `device_request_comments.request_id -> device_requests.id`
- `device_request_status_history.request_id -> device_requests.id`

Check constraint тойм:

- `device_requests.request_type`: `new`, `replace`, `transfer`, `decommission`, `repair`
- `device_requests.status`: `pending`, `approved`, `rejected`
- `device_requests.priority`: `urgent`, `normal`, `low`

Trigger:

- `devices_updated_at` нь `devices` update бүрт `updated_at` шинэчилнэ.

## Бүлэг 6: Автобус, ээлж, ирц

Энэ module нь `target` schema дахь legacy ээлж/автобус өгөгдлийг app-д уншуулах RPC болон request schema-гаар бүрдсэн.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `user_autobus_request` | Хэрэглэгчийн автобус/ээлжийн суудлын хүсэлт | `id` | 0 | On |
| `target.h_autobus` | Legacy автобус | `id` | 7191 | Off |
| `target.h_eelj_soliltsoo` | Legacy ээлж солилцоо | `id` | 1745 | Off |
| `target.h_user_autobus_address` | Legacy хэрэглэгч-автобус-хаяг | `id` | 47935 | Off |
| `target.vw_worker_day_log_14d` | Сүүлийн 14 хоногийн ирцийн materialized/derived table маягийн эх сурвалж | - | 23290 | Off |

Custom enum:

- `eelj_request_status`: `requested`, `approved`, `force_approved`, `rejected`

Холбогдох RPC:

- `get_my_attendance()`
- `get_worker_attendance(p_worker_id)`
- `get_upcoming_eelj(p_limit)`
- `get_my_eelj_assignments()`
- `get_requestable_autobuses(p_limit)`
- `request_autobus_seat(p_eelj_id, p_autobus_id, p_comment)`
- `get_my_eelj_requests()`
- `get_pending_requests_for_my_autobuses()`
- `approve_autobus_request(p_request_id, p_force)`
- `reject_autobus_request(p_request_id, p_reason)`
- `get_my_led_autobus_roster()`
- `get_my_eelj_cards()`

Trigger:

- `user_autobus_request_updated_at` нь `user_autobus_request.updated_at` шинэчилнэ.

## Бүлэг 7: Бодлого, ажлын байрны тодорхойлолт, үнэлгээ

Энэ бүлэг нь policy document, section/clause, job position linkage, rating session-тэй холбоотой.

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `policy` | Бодлогын баримтын толгой | `id` | 0 | Off |
| `section` | Policy section | `id` | 0 | Off |
| `clause` | Section доторх заалт | `id` | 0 | Off |
| `clause_job_position` | Заалт-албан тушаалын холбоос | `id` | 1 | Off |
| `rating_session` | Үнэлгээний session | `id` | 0 | Off |
| `rating` | Үнэлгээний мөр | `id` | 0 | Off |

Гол холбоосууд:

- `section.policy_id -> policy.id`
- `clause.policy_id -> policy.id`
- `clause.section_id -> section.id`
- `clause.parent_id -> clause.id`
- `clause_job_position.clause_id -> clause.id`
- `clause_job_position.job_position_id -> job_position.id`
- `rating.rating_session_id -> rating_session.id`
- `rating.clause_job_position_id -> clause_job_position.id`

## Бүлэг 8: Чөлөөний хүсэлт

| Table | Гол үүрэг | PK | Rows | RLS |
| --- | --- | --- | ---: | --- |
| `leave_types` | Чөлөөний төрөл | `id` | 0 | On |
| `leave_requests` | Хэрэглэгчийн чөлөөний хүсэлт | `id` | 0 | On |

RLS policy:

- `leave_types`: authenticated SELECT.
- `leave_requests`: authenticated user өөрийн хүсэлтийг INSERT/SELECT хийх policy-тэй.

Storage:

- `leave-attachments`: private bucket.

## Бүлэг 9: Legacy `target` schema

`target` schema нь гаднын/хуучин системээс ирсэн өгөгдөл болон sync trigger-үүдийн эх сурвалж байна. App-ийн үндсэн query ихэвчлэн `public` schema-г ашиглах боловч автобус/ээлж, ажилтан, байгууллагын sync нь `target` дээр тулгуурлаж байна.

| Table | Гол үүрэг | Rows |
| --- | --- | ---: |
| `target.sf_guard_user` | Legacy user master | 5567 |
| `target.g_job_position` | Legacy албан тушаал | 4 |
| `target.h_autobus` | Автобус master | 7191 |
| `target.h_eelj_soliltsoo` | Ээлжийн өгөгдөл | 1745 |
| `target.h_user_autobus_address` | Хэрэглэгчийн автобус/хаяг | 47935 |
| `target.vw_worker_day_log_14d` | Ирцийн 14 хоногийн өгөгдөл | 23290 |
| `target.application_service*` | Legacy service/role metadata | 2-128 |

Sync trigger тойм:

- `target.g_organization -> public.organization`
- `target.g_gazar -> public.gazar`
- `target.g_heltes -> public.heltes`
- `target.g_department -> public.alba`
- `target.g_job_position -> public.job_position`
- `target.sf_guard_user -> public.users`

## Storage buckets

| Bucket | Public | File size limit | Ашиглалт |
| --- | --- | ---: | --- |
| `order-item-bucket` | Yes | 5 MB | Захиалгын item image upload |
| `leave-attachments` | No | - | Чөлөөний хүсэлтийн хавсралт |

## Migration түүх

Одоогоор Supabase migration history-д дараах migration-ууд бүртгэлтэй байна.

| Version | Name |
| --- | --- |
| `20250922102435` | `remote_schema` |
| `20260213172442` | `create_chefs_table` |
| `20260213172454` | `create_kiosks_table` |
| `20260213172502` | `create_meal_logs_table` |
| `20260213172507` | `add_anon_select_on_user_meal_configs` |
| `20260215142225` | `create_meal_location_overrides` |
| `20260428210721` | `create_devices_module` |
| `20260428221629` | `devices_add_org_fk_columns` |
| `20260429202023` | `create_device_requests` |
| `20260429215620` | `expand_device_requests_with_5_types_and_comments` |
| `20260430125727` | `device_pairing_monitors_to_computers` |
| `20260430181511` | `current_profile_id_helper` |
| `20260430202356` | `current_bteg_id_helper` |
| `20260430202415` | `get_my_attendance_wrapper` |
| `20260430204817` | `eelj_phase1_read_helpers` |
| `20260430205453` | `eelj_phase2_request_schema` |
| `20260430205557` | `eelj_phase2_request_rpcs` |
| `20260430213737` | `eelj_phase2_my_cards_rpc` |

## Security/RLS тэмдэглэл

- `public.users`, `profile`, `orders`, `devices`, `device_requests`, байгууллагын зарим лавлах table дээр RLS идэвхгүй байна.
- Харин `dining_hall`, `chefs`, `kiosks`, `meal_logs`, `user_meal_configs`, `meal_location_overrides`, `leave_*`, `gazar`, `user_autobus_request` дээр RLS идэвхтэй байна.
- Зарим RLS policy `public` role-д `SELECT`, `INSERT`, `UPDATE`, `DELETE`-ийг `true` нөхцөлтэй өгсөн байна. Энэ нь kiosk/meal flow-д зориулагдсан байж болох ч Data API-д нээлттэй эсэхийг production security review-д заавал шалгах хэрэгтэй.
- Олон `SECURITY DEFINER` function `public` schema-д байна. Supabase public exposed schema дээр privilege boundary-г тогтмол audit хийх шаардлагатай.

