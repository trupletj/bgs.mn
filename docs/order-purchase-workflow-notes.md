# Order Purchase Workflow Notes

Last updated: 2026-05-31

This note records the current state of the `/orders/[id]/imp` purchase workflow so the next Codex can continue without rediscovering the same context.

## User Intent

- `/orders/91/imp` and similar order implementation pages are the main purchase process screen.
- Purchase should start from price quotes, then a quote chosen inside the purchase modal can be linked to a purchase record.
- Purchase records must support:
  - supplier company;
  - invoice date and invoice files;
  - payment paid date and payment receipt files;
  - multiple files per invoice/payment section;
  - currency selection such as `MNT`, `USD`, `CNY`, `RUB`, `EUR`;
  - searchable and scrollable item selection;
  - checkbox-based item selection;
  - reportable supplier purchase history.
- User explicitly does not want a new `order_purchase_line_lots` table or unnecessary extra tables.
- Item status movement should follow the existing `order_fulfillment` and `fulfillment_status_history` pattern, similar in spirit to `order_status_history`.

## Current Data Model Direction

Do not create `order_purchase_line_lots`.

Use existing tables as follows:

- `order_purchase_batches`: one purchase registration, linked to supplier and optionally to the quote used for that purchase.
- `order_purchase_lines`: items purchased in that batch.
- `order_fulfillment`: current quantity/status chunks for purchase lines.
- `fulfillment_status_history`: audit/history of each fulfillment chunk status movement.

The only new schema link needed for the status chunks is:

```sql
alter table public.order_fulfillment
  add column if not exists purchase_line_id bigint
  references public.order_purchase_lines(id) on delete cascade;
```

This is implemented in:

- `supabase/migrations/20260531091110_link_fulfillment_to_purchase_lines.sql`

That migration also backfills existing `order_purchase_lines` into `order_fulfillment` rows with status `purchased`, and inserts initial `fulfillment_status_history` rows when missing.

## Status Chunk Behavior

When a purchase line has quantity `4`, it initially creates one `order_fulfillment` row:

- `quantity = 4`
- `status = purchased`
- `purchase_line_id = order_purchase_lines.id`

If the user moves `2` to `at_warehouse`:

- the original row remains `purchased` but quantity becomes `2`;
- a new `order_fulfillment` row is inserted with quantity `2`, status `at_warehouse`, same `order_item_id`, same `purchase_line_id`;
- a `fulfillment_status_history` row is inserted for the new chunk with `old_status = purchased`, `new_status = at_warehouse`.

This prevents invalid movement such as sending `3` to delivery when only `2` has reached warehouse. Each chunk continues independently.

Allowed movement sequence in code:

- `purchased` -> `at_warehouse`
- `at_warehouse` -> `in_delivery`
- `in_delivery` -> `at_mine`
- `at_mine` -> `completed`
- any active status can also be cancelled where the server action allows it.

## Important Files

- `app/(protected)/orders/[id]/imp/page.tsx`
  - now mostly composes smaller purchase components;
  - loads order items, purchase batches, and purchase quotes.
- `actions/order-purchases.ts`
  - server actions for suppliers, quotes, purchase batches, files, and fulfillment chunk transitions.
- `components/orders/purchase/purchase-quote-manager.tsx`
  - quote registration modal and quote list.
- `components/orders/purchase/purchase-batch-form.tsx`
  - purchase registration modal.
  - when a quote is chosen in the modal, supplier and quote lines are filled from that quote.
  - non-quote items are not selected.
  - unit price and currency are locked in quote-linked mode.
  - purchase quantity remains editable.
- `components/orders/purchase/purchase-batch-list.tsx`
  - displays registered purchase batches as a simple purchase summary: item, quantity, unit price, and total price.
  - does not expose fulfillment/status transition controls inside registered purchases.
- `components/orders/purchase/types.ts`
  - shared UI types.
- `components/orders/purchase/utils.ts`
  - labels, currency options, format helpers.
- `app/(protected)/orders/purchase/page.tsx`
  - purchase list status aggregation updated to consider purchase lines and fulfillment chunks.

## Migrations Added

- `supabase/migrations/20260530175917_add_order_purchase_batches.sql`
  - suppliers, purchase batches, purchase documents, purchase lines, storage bucket/policies.
  - currently edited so it does not create `order_purchase_line_movements`.
  - currently edited so it does not include `price_reason`.
- `supabase/migrations/20260530204031_add_order_purchase_quotes.sql`
  - purchase quote tables and quote file storage.
- `supabase/migrations/20260530210813_link_purchase_batches_to_quotes.sql`
  - adds `quote_id` to purchase batches.
- `supabase/migrations/20260531091110_link_fulfillment_to_purchase_lines.sql`
  - adds `order_fulfillment.purchase_line_id` and backfills fulfillment/history rows.
- `supabase/migrations/20260531110500_cleanup_order_purchase_unused_artifacts.sql`
  - drops unused `order_purchase_line_movements`;
  - drops `order_purchase_quotes.status` now that quote selection is local to the purchase modal.

Removed/avoided:

- `order_purchase_line_lots` migration was deleted after user rejected the extra table.
- Code no longer references `order_purchase_line_lots`, `order_purchase_line_movements`, or lot naming.
- Persistent quote selection via `order_purchase_quotes.status` was removed; purchase batches keep the real quote link through `order_purchase_batches.quote_id`.

## UI Decisions Already Applied

- Quote has one date: `quote_date`. The extra date was removed from UI usage.
- Purchase record shows invoice date next to invoice files and paid date next to payment receipt files.
- Supplier create form hides after selecting an existing supplier.
- Item list in purchase and quote forms is searchable and scrollable.
- Item selection uses checkboxes.
- Currency is selected from fixed options.
- Quote registration and purchase registration are both opened from modal buttons to keep `/orders/[id]/imp` less crowded.
- Quote selection for purchase happens only inside the purchase registration modal.
- Registered purchase cards intentionally do not show item status tracking controls; they only show what was purchased and attached documents.
- The old `Үнийн тайлбар` field/column usage was removed from UI and code.
- Quantity `0` is not submitted as a selected line. User wanted checkbox selection to prevent accidental zero item lines.

## Validation Notes

After the latest code changes:

```bash
npx eslint actions/order-purchases.ts components/orders/purchase/purchase-batch-list.tsx components/orders/purchase/purchase-batch-form.tsx components/orders/purchase/purchase-quote-manager.tsx components/orders/purchase/utils.ts components/orders/purchase/types.ts 'app/(protected)/orders/purchase/page.tsx'
npx tsc --noEmit --pretty false
```

Both passed.

`npm run build` was attempted but failed because sandboxed network access could not fetch Google Fonts:

```text
Failed to fetch `Montserrat` from Google Fonts.
```

The user interrupted the escalated build approval, so production build is not verified yet.

## Known Caution For Next Codex

- Do not add new purchase status tables without first checking existing `order_fulfillment` and `fulfillment_status_history`.
- If the database already has `price_reason` from an earlier migration run, the current code ignores it. Dropping it is also a separate cleanup decision.
- For the 121-item over-remaining error: the bug was caused by double counting purchase line quantity plus generated fulfillment quantity. Current code calculates purchase remaining from `order_purchase_lines` only, avoiding that double count.
