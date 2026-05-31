alter table public.order_purchase_batches
  add column if not exists quote_id bigint references public.order_purchase_quotes(id);

create index if not exists idx_order_purchase_batches_quote
  on public.order_purchase_batches(quote_id);
