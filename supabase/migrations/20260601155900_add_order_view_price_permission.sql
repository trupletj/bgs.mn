insert into public.permissions (description, module, action)
select
  'Захиалгын барааны үнэ болон худалдан авалтын үнийн дүн харах эрх',
  'order',
  'view_price'
where not exists (
  select 1
  from public.permissions
  where module = 'order'
    and action = 'view_price'
);

insert into public.role_permissions (role_id, permission_id)
select distinct purchase_roles.role_id, view_price_permission.id
from public.role_permissions purchase_roles
join public.permissions purchase_permission
  on purchase_permission.id = purchase_roles.permission_id
join public.permissions view_price_permission
  on view_price_permission.module = 'order'
 and view_price_permission.action = 'view_price'
where purchase_permission.module = 'order'
  and purchase_permission.action = 'purchase'
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role_id = purchase_roles.role_id
      and existing.permission_id = view_price_permission.id
  );
