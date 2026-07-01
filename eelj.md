# Ээлж Солилцооны Систем — Системийн Дизайн Баримт бичиг

**Төсөл:** BGS Shift Exchange (`bgs_attendance` schema)  
**Admin Panel:** bgs-mn  
**Огноо:** 2026-06-27  
**Хувилбар:** v1.1

---

## 1. Системийн Ерөнхий Тоймлол

### 1.1 Зорилго

Хүний нөөцийн ажилтан ажилчдыг нутаг чиглэлийн автобуснуудад хуваарилж, ажилчид автобусандаа суусан баталгаажуулалтыг бүртгэх системийг бүрэн цахим болгох.

> **Тэмдэглэл:** QR уншуулалтын сканнер хэсэг нь энэ төсөлд хамаарахгүй — тусдаа mini service болгон хөгжүүлэгдэнэ. Харин уншуулалтын мэдээлэл хадгалах талбарыг схемд тусгасан.

### 1.2 Гол Оролцогч Талууд (Actors)

| Дүр                   | Тайлбар                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| **HR Admin**          | Хүний нөөцийн ажилтан — хуваарь үүсгэх, ажилчид хуваарилах, тайлан харах     |
| **Trip Leader**       | Аялалын ахлах — өөрийн автобусны жагсаалт харах, ирцийн баталгаажуулалт хийх |
| **External Operator** | Гадаад компанийн оператор — өөрийн компанийн ажилчдын мэдээллийг оруулах     |
| **System Admin**      | Систем удирдагч — автобус, чиглэл, хэрэглэгч тохируулах, хянах мөн бүх эрх   |

---

## 2. Өгөгдлийн Сангийн Схем

### 2.1 Схемийн Бүтэц

```
public schema          →  users, profile, roles_profiles, ...  (mcp supabase хандан бүгдийг хараарай)
bgs_attendance schema  →  доорх шинэ хүснэгтүүд
```

`public.users` хүснэгтэд нэмэгдэх нэмэлт талбар:

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_route_id bigint
    REFERENCES bgs_attendance.routes(id) ON DELETE SET NULL;
```

> Тухайн ажилтны **тогтмол чиглэл** (Сэлэнгэ, Улаанбаатар, Дархан гэх мэт). Хуваарь үүсгэхэд энэ чиглэлийн бүх автобусанд тухайн ажилчдыг автоматаар хуваарилах үндэс болно.

---

### 2.2 Хүснэгтүүд

#### `routes` — Чиглэлүүд

```sql
CREATE TABLE bgs_attendance.routes (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,        -- "Сэлэнгэ", "Улаанбаатар", "Дархан"
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

---

#### `buses` — Автобуснууд

```sql
CREATE TABLE bgs_attendance.buses (
  id           bigserial PRIMARY KEY,
  route_id     bigint NOT NULL REFERENCES bgs_attendance.routes(id),
  name         text NOT NULL,       -- "Сэлэнгэ 1", "УБ 2", "Дархан 1"
  capacity     int NOT NULL DEFAULT 45,
  plate_number text,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
```

---

#### `external_companies` — Гадаад компаниуд

```sql
CREATE TABLE bgs_attendance.external_companies (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

---

#### `external_operators` — Гадаад компанийн операторууд

```sql
CREATE TABLE bgs_attendance.external_operators (
  id          bigserial PRIMARY KEY,
  company_id  bigint NOT NULL REFERENCES bgs_attendance.external_companies(id),
  profile_id  bigint REFERENCES public.profile(id),  -- системд бүртгэлтэй бол
  name        text NOT NULL,
  phone       text,
  email       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

---

#### `external_passengers` — Гадаад компанийн буух ажилчид

```sql
CREATE TABLE bgs_attendance.external_passengers (
  id              bigserial PRIMARY KEY,
  company_id      bigint NOT NULL REFERENCES bgs_attendance.external_companies(id),
  submitted_by    bigint REFERENCES bgs_attendance.external_operators(id),
  full_name       text NOT NULL,
  phone           text,
  id_card_number  text,
  home_address    text,             -- чиглэл тодорхойлоход лавлагаа болно
  notes           text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz
);
```

> Гадаад ажилчдын тогтмол чиглэлийг `home_address` болон HR Admin-ийн хуваарилалтаар тодорхойлно. `default_route_id` нь зөвхөн `public.users`-т байна.

---

#### `shift_schedules` — Ээлжийн хуваарь

```sql
CREATE TABLE bgs_attendance.shift_schedules (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,        -- "2026-07 1-р ээлж"
  shift_date      date NOT NULL,        -- буух өдөр
  departure_time  time,                 -- явах цаг
  status          text NOT NULL DEFAULT 'draft',
                  -- draft | published | in_progress | completed | cancelled
  created_by      uuid REFERENCES public.users(id),
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz
);
```

**Status state machine:**

```
draft ──► published ──► in_progress ──► completed
               │
               ▼
           cancelled
```

| Төлөв         | Тайлбар                                        |
| ------------- | ---------------------------------------------- |
| `draft`       | Засаж болно, нийтэд харагдахгүй                |
| `published`   | Аялалын ахлах харж болно, засах хязгаарлагдмал |
| `in_progress` | Буулт эхэлсэн                                  |
| `completed`   | Хаагдсан, зөвхөн харах                         |
| `cancelled`   | Цуцлагдсан                                     |

---

#### `bus_assignments` — Автобусны хуваарилалт

```sql
CREATE TABLE bgs_attendance.bus_assignments (
  id              bigserial PRIMARY KEY,
  schedule_id     bigint NOT NULL REFERENCES bgs_attendance.shift_schedules(id) ON DELETE CASCADE,
  bus_id          bigint NOT NULL REFERENCES bgs_attendance.buses(id),
  trip_leader_id  uuid REFERENCES public.users(id),   -- аялалын ахлах
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (schedule_id, bus_id)
);
```

---

#### `passenger_assignments` — Ажилчдын хуваарилалт автобусанд

```sql
CREATE TABLE bgs_attendance.passenger_assignments (
  id                      bigserial PRIMARY KEY,
  schedule_id             bigint NOT NULL
    REFERENCES bgs_attendance.shift_schedules(id) ON DELETE CASCADE,
  bus_assignment_id       bigint NOT NULL
    REFERENCES bgs_attendance.bus_assignments(id) ON DELETE CASCADE,

  -- Дотоод ажилтан ЭСВЭЛ Гадаад ажилтан — нэг л утгатай байна
  internal_user_id        uuid REFERENCES public.users(id),
  external_passenger_id   bigint REFERENCES bgs_attendance.external_passengers(id),

  seat_number             int,

  -- QR уншуулалтын мэдээлэл (mini service-ээс бичигдэнэ)
  is_confirmed            boolean DEFAULT false,
  confirmed_at            timestamptz,
  confirmed_by            uuid REFERENCES public.users(id),  -- аялалын ахлах

  notes                   text,
  created_at              timestamptz DEFAULT now(),

  CONSTRAINT chk_one_passenger CHECK (
    (internal_user_id IS NOT NULL AND external_passenger_id IS NULL) OR
    (internal_user_id IS NULL AND external_passenger_id IS NOT NULL)
  )
);

CREATE INDEX idx_pa_schedule    ON bgs_attendance.passenger_assignments(schedule_id);
CREATE INDEX idx_pa_bus         ON bgs_attendance.passenger_assignments(bus_assignment_id);
CREATE INDEX idx_pa_internal    ON bgs_attendance.passenger_assignments(internal_user_id);
CREATE INDEX idx_pa_external    ON bgs_attendance.passenger_assignments(external_passenger_id);
CREATE INDEX idx_pa_confirmed   ON bgs_attendance.passenger_assignments(is_confirmed);
```

> `is_confirmed`, `confirmed_at`, `confirmed_by` талбарууд нь mini service QR сканнераас шинэчлэгдэнэ. Admin panel дээр зөвхөн харах (read-only) байна.

---

#### `attendance_logs` — Ирцийн аудит бүртгэл

```sql
CREATE TABLE bgs_attendance.attendance_logs (
  id                        bigserial PRIMARY KEY,
  passenger_assignment_id   bigint NOT NULL
    REFERENCES bgs_attendance.passenger_assignments(id),
  scanned_by                uuid NOT NULL REFERENCES public.users(id),
  scanned_at                timestamptz NOT NULL DEFAULT now(),
  device_info               text,
  location_lat              numeric,
  location_lng              numeric,
  notes                     text
);
```

> Устгахгүй, зөвхөн нэмнэ — маргааны баримт болно.

---

### 2.3 ER Диаграм

```
public.users
  │  default_route_id ──────────────────────────────┐
  │                                                  │
  ├── (trip_leader_id) ───► bus_assignments          │
  ├── (internal_user_id) ──► passenger_assignments   │
  └── (created_by) ────────► shift_schedules         │
                                                     ▼
routes ◄──────────────────────────────────────── routes
  │
  └──► buses ──► bus_assignments ──► shift_schedules
                      │
                      └──► passenger_assignments
                                │
                    ┌───────────┴──────────────┐
                    ▼                          ▼
            internal_user_id        external_passenger_id
           (public.users)          (external_passengers)
                                          │
                               external_companies
                                    │
                             external_operators
                          (submitted_by → external_passengers)
```

---

## 3. Тогтмол Чиглэлийн Автоматжуулалт

### 3.1 Зарчим

```
users.default_route_id = "Сэлэнгэ" (route_id)

Шинэ хуваарь үүсгэхэд:
  1. Тухайн чиглэлийн бүх идэвхтэй ажилчдыг цуглуулна
  2. Чиглэлийн автобусуудыг дарааллаар дүүргэнэ
     (Сэлэнгэ 1: 45 хүн → дүүрвэл Сэлэнгэ 2 → дүүрвэл Сэлэнгэ 3)
  3. HR Admin зөвхөн өөрчлөлт орсон, шинэ, эсвэл онцгой хүмүүсийг засна
```

### 3.2 Автобус дүүрэхэд (Capacity Guard)

Server-side RPC-аар capacity шалгана — UI-д зөвхөн дохио харуулна:

```sql
-- passenger_assignments COUNT <= buses.capacity
-- Хэтрэхэд insert блоклогдоно, дараагийн автобус санал болгоно
```

---

## 4. Хэрэглэгчийн Ажлын Урсгал

### 4.1 Ерөнхий Урсгал

```
[1] HR Admin → Shift Schedule үүсгэнэ (draft)
      │
[2] External Operator → өөрийн компанийн ажилчдын жагсаалт оруулна
      │
[3] HR Admin → Нийт жагсаалтыг автобусанд хуваарилна
      │         (default_route_id-аар автоматаар, засвар хийнэ)
      │
[4] HR Admin → Schedule "published" болгоно
      │         (Аялалын ахлахад мэдэгдэл явна)
      │
[5] Буулт болно — QR баталгаажуулалт (mini service, тусдаа)
      │
[6] HR Admin / System Admin → ирцийн тайлан харна, Excel export
```

### 4.2 HR Admin — Schedule Үүсгэх UX

```
/attendance/schedules/new
  └─► Ээлжийн мэдээлэл (нэр, огноо, явах цаг)
      └─► "Автоматаар хуваарилах" товч
          └─► default_route_id-аар ажилчид автобусанд орно
              └─► Харах, засах, нэмэх, шилжүүлэх
                  └─► Аялалын ахлах оноох автобус бүрт
                      └─► "Publish"
```

### 4.3 External Operator — Ажилчид Оруулах UX

```
/attendance/external/passengers
  └─► Идэвхтэй хуваарийг харах
      └─► Нэмэх: нэг нэгээр ЭСВЭЛ Excel import
          (Template татах → бөглөх → upload → preview → confirm)
          └─► HR Admin-д мэдэгдэл → нийт жагсаалтад нэмэгдэнэ
```

### 4.4 Trip Leader — Жагсаалт Харах UX

```
/attendance/scan (mobile-optimized)
  └─► Өнөөдрийн хуваарь автоматаар нээгдэнэ
      └─► Өөрийн автобусны ажилчдын жагсаалт
          (баталгаажсан / баталгаажаагүй хуваагдана)
          └─► QR баталгаажуулалт → mini service хариуцна
```

---

## 5. Admin Panel Хуудсуудын Бүтэц

```
/attendance
  /attendance/schedules                →  Бүх хуваарийн жагсаалт
  /attendance/schedules/new            →  Шинэ хуваарь үүсгэх
  /attendance/schedules/[id]           →  Хуваарийн дэлгэрэнгүй
  /attendance/schedules/[id]/assign    →  Ажилчид хуваарилах

/attendance/buses                      →  Автобусны тохиргоо
/attendance/routes                     →  Чиглэлийн тохиргоо

/attendance/external-companies         →  Гадаад компаниуд
/attendance/external-companies/[id]    →  Компанийн операторууд
/attendance/external/passengers        →  Гадаад ажилчдын жагсаалт

/attendance/reports                    →  Ирцийн тайлан, Excel export
```

---

## 6. RLS (Row Level Security) Бодлого

```sql
-- HR Admin: бүх мэдээлэл харах, засах
-- Trip Leader: зөвхөн өөрийн bus_assignment-н жагсаалт харах (read-only)
-- External Operator: зөвхөн өөрийн company_id-тай external_passengers

CREATE POLICY "external_operator_own_passengers"
  ON bgs_attendance.external_passengers
  FOR ALL
  USING (
    company_id IN (
      SELECT eo.company_id
      FROM bgs_attendance.external_operators eo
      JOIN public.profile p ON p.id = eo.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "trip_leader_own_bus"
  ON bgs_attendance.passenger_assignments
  FOR SELECT
  USING (
    bus_assignment_id IN (
      SELECT id FROM bgs_attendance.bus_assignments
      WHERE trip_leader_id = (
        SELECT id FROM public.users WHERE auth_user_id = auth.uid()
      )
    )
  );
```

---

## 7. Excel Тайлангийн Бүтэц

```
Хуваарь: 2026-07-15  |  Нийт: 127 хүн  |  Ирсэн: 119 (94%)
┌────────────┬──────────────┬─────────────────┬────────────┬──────────────┐
│ Автобус    │ Аялалын ахлах│ Ажилтан         │ Компани    │ Ирсэн        │
├────────────┼──────────────┼─────────────────┼────────────┼──────────────┤
│ Сэлэнгэ 1  │ Б.Батаа      │ Д.Дорж          │ BGS        │ ✅ 08:15     │
│ Сэлэнгэ 1  │ Б.Батаа      │ Н.Номин         │ XYZ Corp   │ ❌           │
│ Сэлэнгэ 2  │ О.Оюун       │ Г.Ганболд       │ BGS        │ ✅ 08:22     │
└────────────┴──────────────┴─────────────────┴────────────┴──────────────┘
```

---

## 8. Best Practices

### Тогтмол чиглэл (`default_route_id`) — Үндсэн зарчим

Гэрийн хаяг ховор өөрчлөгддөг тул `users.default_route_id` нь хамгийн тогтвортой суурь. Шинэ хуваарь үүсгэх болгонд HR Admin зөвхөн **зөрүүтэй хүмүүсийг** засна — нийт хуваарилалтыг дахин хийхгүй.

### Soft Delete

Бүх хүснэгтэд `is_active boolean` — өгөгдөл устгахгүй, архивлана.

### Capacity Guard (Server-side)

UI-д progress bar харуулна, гэхдээ хязгаарыг заавал RPC-аар server-side шалгана. UI-г тойрч insert хийхэд ч capacity хамгаалагдана.

### Audit Trail

`attendance_logs` зөвхөн INSERT — UPDATE, DELETE байхгүй. Маргааны баримт болно.

### Excel Import (External Operator)

```
Template татах → Бөглөх → Upload → Алдаа мөр тус бүрт тайлбартай → Preview → Confirm
```

### Mini Service Интеграци

QR сканнер mini service нь зөвхөн `passenger_assignments` дээр UPDATE хийнэ:

```
is_confirmed = true
confirmed_at = now()
confirmed_by = trip_leader user id
```

мөн `attendance_logs`-т INSERT хийнэ. Энэ хоёр л эрх хэрэгтэй — тусгаарлагдсан байна.

### Notification (Publish үед)

Schedule publish болоход аялалын ахлахуудад:

- SMS (`users.phone`-р) эсвэл
- In-app notification (Supabase Realtime)

---

## 9. Хэрэгжүүлэлтийн Ээлж

### Phase 1 — Суурь (2 долоо хоног)

- [ ] `bgs_attendance` schema + бүх хүснэгт үүсгэх
- [ ] `public.users`-д `default_route_id` нэмэх
- [ ] Routes, Buses CRUD
- [ ] Shift Schedule үүсгэх, статус шилжүүлэх
- [ ] Тогтмол чиглэлээр автоматаар хуваарилах логик (RPC)
- [ ] HR Admin хуваарилах хуудас (assign)

### Phase 2 — Гадаад компани (1 долоо хоног)

- [ ] External companies, operators бүртгэл
- [ ] External passengers нэмэх (нэг нэгээр + Excel import)
- [ ] HR Admin-д нэгтгэх хуудас

### Phase 3 — Тайлан (1 долоо хоног)

- [ ] Ирцийн тайлан хуудас (filter: огноо, чиглэл, автобус, компани)
- [ ] Excel export (хуваарь + ирцийн мэдээлэл)
- [ ] Trip Leader жагсаалт харах хуудас (read-only, mobile-optimized)

### Phase 4 — Нарийвчлал (1 долоо хоног)

- [ ] Notification (publish үед)
- [ ] Capacity guard RPC
- [ ] RLS policy бүрэн тохируулах
- [ ] Mini service-тэй интеграцийн endpoint бэлтгэх

---

## 10. Хурдан Эхлэх SQL

```sql
-- 1. Schema
CREATE SCHEMA IF NOT EXISTS bgs_attendance;

-- 2. Routes
CREATE TABLE bgs_attendance.routes (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Buses
CREATE TABLE bgs_attendance.buses (
  id bigserial PRIMARY KEY,
  route_id bigint NOT NULL REFERENCES bgs_attendance.routes(id),
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 45,
  plate_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. public.users-д default_route_id нэмэх
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_route_id bigint
  REFERENCES bgs_attendance.routes(id) ON DELETE SET NULL;

-- 5. External companies
CREATE TABLE bgs_attendance.external_companies (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 6. External operators
CREATE TABLE bgs_attendance.external_operators (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES bgs_attendance.external_companies(id),
  profile_id bigint REFERENCES public.profile(id),
  name text NOT NULL,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 7. External passengers
CREATE TABLE bgs_attendance.external_passengers (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES bgs_attendance.external_companies(id),
  submitted_by bigint REFERENCES bgs_attendance.external_operators(id),
  full_name text NOT NULL,
  phone text,
  id_card_number text,
  home_address text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- 8. Shift schedules
CREATE TABLE bgs_attendance.shift_schedules (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  shift_date date NOT NULL,
  departure_time time,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- 9. Bus assignments
CREATE TABLE bgs_attendance.bus_assignments (
  id bigserial PRIMARY KEY,
  schedule_id bigint NOT NULL REFERENCES bgs_attendance.shift_schedules(id) ON DELETE CASCADE,
  bus_id bigint NOT NULL REFERENCES bgs_attendance.buses(id),
  trip_leader_id uuid REFERENCES public.users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (schedule_id, bus_id)
);

-- 10. Passenger assignments
CREATE TABLE bgs_attendance.passenger_assignments (
  id bigserial PRIMARY KEY,
  schedule_id bigint NOT NULL REFERENCES bgs_attendance.shift_schedules(id) ON DELETE CASCADE,
  bus_assignment_id bigint NOT NULL REFERENCES bgs_attendance.bus_assignments(id) ON DELETE CASCADE,
  internal_user_id uuid REFERENCES public.users(id),
  external_passenger_id bigint REFERENCES bgs_attendance.external_passengers(id),
  seat_number int,
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_one_passenger CHECK (
    (internal_user_id IS NOT NULL AND external_passenger_id IS NULL) OR
    (internal_user_id IS NULL AND external_passenger_id IS NOT NULL)
  )
);

CREATE INDEX idx_pa_schedule  ON bgs_attendance.passenger_assignments(schedule_id);
CREATE INDEX idx_pa_bus       ON bgs_attendance.passenger_assignments(bus_assignment_id);
CREATE INDEX idx_pa_internal  ON bgs_attendance.passenger_assignments(internal_user_id);
CREATE INDEX idx_pa_external  ON bgs_attendance.passenger_assignments(external_passenger_id);
CREATE INDEX idx_pa_confirmed ON bgs_attendance.passenger_assignments(is_confirmed);

-- 11. Attendance logs
CREATE TABLE bgs_attendance.attendance_logs (
  id bigserial PRIMARY KEY,
  passenger_assignment_id bigint NOT NULL
    REFERENCES bgs_attendance.passenger_assignments(id),
  scanned_by uuid NOT NULL REFERENCES public.users(id),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  device_info text,
  location_lat numeric,
  location_lng numeric,
  notes text
);
```

---

_Баримт бичгийг BGS shift exchange системийн хөгжүүлэлтийн гарын авлага болгон ашиглана._  
_QR сканнер mini service-ийн дизайн тусдаа баримт бичигт тусгагдана._
