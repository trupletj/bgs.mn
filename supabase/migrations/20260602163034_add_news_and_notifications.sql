-- Мэдээ (broadcast) ба Мэдэгдэл (хэрэглэгч тус бүрт) хүснэгтүүд + RLS + permission.
-- Mobile superapp болон bgs.mn admin хоёул эдгээрийг ашиглана.

-- ─────────────────────────────────────────────────────────────
-- news: компанийн нийтэд зориулсан мэдээ / зарлал
-- ─────────────────────────────────────────────────────────────
create table if not exists public.news (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null,
  body text,
  image_url text,
  likes integer not null default 0,
  is_active boolean not null default true,
  published_at timestamptz,
  created_by bigint references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_published_at on public.news (published_at desc);

drop trigger if exists set_news_updated_at on public.news;
create trigger set_news_updated_at
  before update on public.news
  for each row execute function public.set_updated_at();

alter table public.news enable row level security;

create policy "Authenticated reads news" on public.news
  for select to authenticated using (true);

create policy "News create" on public.news
  for insert to authenticated
  with check (has_permission(auth.uid(), 'news', 'create'));

create policy "News edit" on public.news
  for update to authenticated
  using (has_permission(auth.uid(), 'news', 'edit'))
  with check (has_permission(auth.uid(), 'news', 'edit'));

create policy "News delete" on public.news
  for delete to authenticated
  using (has_permission(auth.uid(), 'news', 'delete'));

-- ─────────────────────────────────────────────────────────────
-- notifications: хэрэглэгч тус бүрт чиглэсэн мэдэгдэл
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  profile_id bigint not null references public.profile (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'success')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_profile_created
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

-- Хэрэглэгч өөрийн мэдэгдлийг, илгээх эрхтэй (admin) бүгдийг харна.
create policy "Read own or sender notifications" on public.notifications
  for select to authenticated
  using (
    profile_id = current_profile_id()
    or has_permission(auth.uid(), 'notification', 'create')
  );

create policy "Notification create" on public.notifications
  for insert to authenticated
  with check (has_permission(auth.uid(), 'notification', 'create'));

-- Зөвхөн өөрийн мэдэгдлийг "уншсан" болгож тэмдэглэнэ.
create policy "Mark own notification read" on public.notifications
  for update to authenticated
  using (profile_id = current_profile_id())
  with check (profile_id = current_profile_id());

-- ─────────────────────────────────────────────────────────────
-- broadcast RPC: бүх хэрэглэгчид нэг мэдэгдэл (atomic + permission)
-- ─────────────────────────────────────────────────────────────
create or replace function public.broadcast_notification(
  p_title text,
  p_message text,
  p_type text default 'info'
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_count integer;
begin
  if not has_permission(auth.uid(), 'notification', 'create') then
    raise exception 'permission denied';
  end if;

  insert into public.notifications (profile_id, title, message, type)
  select id, p_title, p_message, coalesce(p_type, 'info')
  from public.profile;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- SECURITY DEFINER функцийг зөвхөн authenticated дуудаж болохоор хязгаарлана.
revoke execute on function public.broadcast_notification(text, text, text) from public;
revoke execute on function public.broadcast_notification(text, text, text) from anon;
grant execute on function public.broadcast_notification(text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Permission тодорхойлолт (super_admin-д автомат; бусад role-д admin оноож болно)
-- ─────────────────────────────────────────────────────────────
insert into public.permissions (module, action, description)
select v.module, v.action, v.description
from (values
  ('news', 'read', 'Мэдээ унших'),
  ('news', 'create', 'Мэдээ үүсгэх'),
  ('news', 'edit', 'Мэдээ засах'),
  ('news', 'delete', 'Мэдээ устгах'),
  ('notification', 'read', 'Мэдэгдэл унших'),
  ('notification', 'create', 'Мэдэгдэл илгээх')
) as v (module, action, description)
where not exists (
  select 1 from public.permissions p
  where p.module = v.module and p.action = v.action
);
