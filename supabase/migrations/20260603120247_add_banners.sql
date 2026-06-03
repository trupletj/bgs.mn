-- Banner — нүүрний carousel-д зориулсан тусдаа, зурагтай контент.
-- news-ээс бүрэн тусгаар. Дарахад холбоостой мэдээ (news_id) эсвэл URL (link_url) руу очино.

create table if not exists public.banners (
  id bigint generated always as identity primary key,
  title text not null,
  subtitle text,
  tag text,
  image_url text not null,
  link_url text,
  news_id bigint references public.news (id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  published_at timestamptz,
  created_by bigint references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_banners_sort on public.banners (sort_order, created_at desc);

drop trigger if exists set_banners_updated_at on public.banners;
create trigger set_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

alter table public.banners enable row level security;

create policy "Authenticated reads banners" on public.banners
  for select to authenticated using (true);

create policy "Banner create" on public.banners
  for insert to authenticated
  with check (has_permission(auth.uid(), 'banner', 'create'));

create policy "Banner edit" on public.banners
  for update to authenticated
  using (has_permission(auth.uid(), 'banner', 'edit'))
  with check (has_permission(auth.uid(), 'banner', 'edit'));

create policy "Banner delete" on public.banners
  for delete to authenticated
  using (has_permission(auth.uid(), 'banner', 'delete'));

-- Permission тодорхойлолт (super_admin-д автомат; бусад role-д admin оноож болно)
insert into public.permissions (module, action, description)
select v.module, v.action, v.description
from (values
  ('banner', 'read', 'Баннер унших'),
  ('banner', 'create', 'Баннер үүсгэх'),
  ('banner', 'edit', 'Баннер засах'),
  ('banner', 'delete', 'Баннер устгах')
) as v (module, action, description)
where not exists (
  select 1 from public.permissions p
  where p.module = v.module and p.action = v.action
);
