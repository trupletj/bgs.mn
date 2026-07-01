-- passenger_assignments дээр Realtime идэвхжсэн (supabase_realtime publication).
-- DELETE/UPDATE realtime үйл явдалд shift_exchange_id filter ажиллахын тулд бүрэн
-- мөрийг WAL-д бичнэ.
alter table bgs_attendance.passenger_assignments replica identity full;
