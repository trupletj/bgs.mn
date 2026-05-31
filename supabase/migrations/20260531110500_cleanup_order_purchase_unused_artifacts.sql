drop table if exists public.order_purchase_line_movements;

alter table public.order_purchase_quotes
  drop column if exists status;
