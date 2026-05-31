alter table public.order_fulfillment
  add column if not exists purchase_line_id bigint references public.order_purchase_lines(id) on delete cascade;

create index if not exists idx_order_fulfillment_purchase_line
  on public.order_fulfillment(purchase_line_id);

insert into public.order_fulfillment (
  order_item_id,
  purchase_line_id,
  quantity,
  status,
  created_at,
  notes
)
select
  line.order_item_id,
  line.id,
  line.quantity,
  'purchased',
  line.created_at,
  'Худалдан авалт бүртгэв'
from public.order_purchase_lines line
where not exists (
  select 1
  from public.order_fulfillment fulfillment
  where fulfillment.purchase_line_id = line.id
);

insert into public.fulfillment_status_history (
  fulfillment_id,
  old_status,
  new_status,
  reason,
  created_at
)
select
  fulfillment.id,
  null,
  fulfillment.status,
  'Худалдан авалт бүртгэв',
  fulfillment.created_at
from public.order_fulfillment fulfillment
where fulfillment.purchase_line_id is not null
  and not exists (
    select 1
    from public.fulfillment_status_history history
    where history.fulfillment_id = fulfillment.id
  );
