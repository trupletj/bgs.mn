# Autobus sync reconciliation (target.h_autobus ↔ bgs_attendance)

Status as of 2026-07-07: **all DB migrations applied to live Supabase, TS touch-ups in bgs.mn done.** This doc exists so the work survives a crash (a prior session was lost to a WSL crash mid-implementation) — read this first if picking the work back up.

## What this is

The Shift Exchange module (`bgs_attendance` schema, admin panel in this repo under `app/(protected)/shift-exchange`) used to generate its own `buses` internally via `auto_distribute_pool` ("Ухаалаг хуваарилах" button). A legacy intranet system feeds a read-only mirror (`target.h_autobus`, `target.h_user_autobus_address`) with real bus/driver/seat data. This work wires the two together.

## Decisions

1. **`auto_distribute_pool` no longer creates buses.** It only assigns pooled passengers into existing active buses with spare capacity in their direction. Overflow stays pooled until the external system provides more buses (via `target.h_autobus` sync).
2. **Hybrid `bus_id` assignment, external wins on conflict.** Both HR (via any of the shift-exchange RPCs) and the external system (`target.h_user_autobus_address.autobus_id`) can set a passenger's bus. When they disagree, the external assignment wins. Tracked via `passenger_assignments.bus_assigned_externally` + a generic trigger reading a transaction-local GUC (`bgs_attendance.sync_write`) — see migration `20260707150500`.

## Migrations applied (in order, all live)

| Migration | What |
|---|---|
| `20260707012730`–`20260707012925` | 5 migrations applied in a prior (lost) session — written to disk now for repo parity, NOT re-applied. Added `h_autobus_*` columns to `buses`, `h_user_autobus_address` enrichment columns + `legacy_synced_at` etc. to `passenger_assignments`, the two sync triggers, and the address-only backfill. |
| `20260707150000_fix_h_autobus_sync_capacity_bug` | Bug fix: capacity now from `h_autobus.number_person` (was hardcoded 45); `capacity` was also missing from the trigger's `ON CONFLICT DO UPDATE SET`, so it never updated after first insert — fixed. |
| `20260707150500_add_bus_assignment_source_tracking` | `bus_assigned_externally` column + `track_bus_assignment_source()` generic trigger. |
| `20260707151000_h_user_autobus_address_sync_bus_id_resolution` | Extends the address-sync trigger to resolve and set `bus_id` from `autobus_id → buses.h_autobus_id`, external-wins, never clobbers when unresolved, reverts to pool (`bus_id = NULL`) on delete. |
| `20260707151500_backfill_h_autobus_to_buses` | One-time backfill of historical `target.h_autobus` rows into `buses` (117 landed, matched via `shift_exchanges.eelj_id`), set-based trip-leader resolution, `bus_routes` backfill. |
| `20260707152000_backfill_bus_id_external_wins` | One-time backfill resolving `bus_id` on existing `passenger_assignments` from `h_user_autobus_address.autobus_id`. Result: 4039 rows flagged `bus_assigned_externally = true`. |
| `20260707152500_synthetic_bus_overlap_report` | Read-only view `bgs_attendance.synthetic_bus_overlap_report` — surfaces synthetic buses overlapping a real bus in the same exchange+direction, for manual HR merge. **Non-empty right now** — shift_exchange 23 has 6 synthetic buses overlapping 3 real ones; needs manual HR reconciliation (see Open Questions). |
| `20260707153000_auto_distribute_pool_no_synthetic_buses` | Removes the bus-creation branch from `auto_distribute_pool`. `buses_created` always returns 0 now. |
| `20260707153500_guard_delete_bus_against_synced_buses` | `delete_bus()` now raises an exception if the bus has `h_autobus_id IS NOT NULL`. |

## TS touch-ups done (this repo)

- `types/shift-exchange.ts`: `Bus` extended with `hAutobusId`/`hAutobusNumber`/driver fields; `AutoDistributeResult.busesCreated` commented as always-0.
- `actions/shift-exchange.ts`: `mapBus()` maps the new columns through.
- `components/shift-exchange/smart-assign-button.tsx`: dialog/toast copy no longer promises bus creation.
- `components/shift-exchange/bus-card-actions.tsx` + `bus-grid.tsx`: delete disabled (with tooltip) for synced buses; bus card shows plate number + driver name when present.
- `npx tsc --noEmit` passes clean.

## bgs-platform hand-off list (NOT edited directly — hand to the owning engineer)

1. **`apps/attendance/actions/shift-exchange.ts`, `getMyBusAssignments()`** (~line 47/91) — extend the `buses` select and `MyBusInfo.bus` return shape with `h_autobus_number`, `h_autobus_driver_name`, `h_autobus_driver_phone`, `h_autobus_extra_driver_name`, `h_autobus_extra_driver_phone`, `h_autobus_apart_position`.
2. **`apps/attendance/types/shift-exchange.ts`** — extend `MyBusInfo.bus` (and `LedBus` if the leader view should show it too) with the same fields.
3. **`apps/attendance/components/shift-exchange/bus-info-card.tsx`** — render the new driver/plate fields, fall back gracefully when null.
4. No change needed to realtime handlers in `passenger-view.tsx`/`leader-view.tsx` — both already `router.refresh()` on any `bus_id` change, which transparently covers the case where external sync overwrites an HR assignment mid-session.
5. QA flag (no code change): `getMyBusAssignments()` filters buses to `departure_time` within ±3 days; a synced bus with `h_autobus.day_date IS NULL` stays silently hidden from the passenger view, same as before this work.
6. `apps/mobile/stores/auth-store.ts:222` reads `eelj_groups.bteg_id` — that column was renamed to `sf_guard_group_id` by the `rename_target_sync_bteg_id_columns` migration (2026-07-06). Unrelated to this project but flagged as a likely-broken stale reference found during research.

## Verification already run (live, all passed)

- `handle_h_autobus_sync` source confirmed to contain `capacity = EXCLUDED.capacity`.
- `buses`: 117 rows now have `h_autobus_id` set (141 total incl. 24 pre-existing synthetic); zero capacity mismatches vs `number_person`; zero duplicate trip-leader-per-exchange violations.
- `passenger_assignments`: `bus_assigned_externally` true for 4039 / 5748 rows after the backfill; zero rows with the flag true and `bus_id` null (no contradictions).
- `synthetic_bus_overlap_report` returns 12 rows (6 synthetic buses × their overlapping real buses) for shift_exchange 23.
- `auto_distribute_pool` source confirmed to no longer contain a bus-creation branch.
- `delete_bus` source confirmed to contain the `h_autobus_id IS NOT NULL` guard.
- **Not yet verified**: actual RPC behavior end-to-end as an authenticated admin user in the running app (raw SQL console calls fail with "Permission denied" since `has_permission(auth.uid(), ...)` needs a real session) — see Manual QA below.

## Manual QA still needed (in the running bgs.mn admin UI)

- Open shift_exchange 23 (has both synthetic and newly-synced real buses); confirm synced bus cards show driver/plate and the delete option is disabled with a tooltip.
- Click "Ухаалаг хуваарилах"; confirm updated copy, confirm no new bus rows appear, confirm `still_pooled` is accurate.
- Review `select * from bgs_attendance.synthetic_bus_overlap_report;` with HR and manually merge/delete the 6 synthetic buses on exchange 23 once passengers are moved over (existing "Устгах" flow works for non-synced buses).
- Simulate (or wait for) an external `h_user_autobus_address` change that conflicts with an HR assignment; confirm external wins and `bus_assigned_externally` flips to true.
- Simulate a soft-delete of a `h_user_autobus_address` row; confirm the passenger reverts to pool.

## Open questions for a domain/product owner

1. `zam_tsag` (existing) vs `approved_zam_tsag` (new, from `h_user_autobus_address`) — same concept or genuinely different (route schedule vs individually-approved time)?
2. Who owns the manual merge decision for `synthetic_bus_overlap_report` overlaps — is the raw view enough, or does it need a small admin UI?
3. For `h_autobus` rows lacking `number_person` (~2113/7375), is 45 still the right default capacity?
4. Only ~117/7375 `h_autobus` rows matched an existing `shift_exchanges` row (via `eelj_id`) — most legacy eelj events aren't onboarded yet. Separate follow-up to expand `handle_h_eelj_soliltsoo_sync` eligibility, or intentionally manual per-exchange onboarding?
