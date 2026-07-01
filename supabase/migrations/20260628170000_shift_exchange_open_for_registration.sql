-- shift_exchanges дээр "бусад компани хүн нэмэх" нээх flag нэмнэ.
-- HR ээлжийг нээснээр /shift-exchange/register-д тухайн ээлж л харагдана
-- (өмнө нь бүх published ээлж харагддаг байсан).
alter table bgs_attendance.shift_exchanges
  add column if not exists open_for_registration boolean not null default false;

comment on column bgs_attendance.shift_exchanges.open_for_registration is
  'HR ээлжийг бусад компанийн төлөөлөгчид зорчигч бүртгэхээр нээсэн эсэх. /shift-exchange/register нь зөвхөн published + open_for_registration=true ээлжийг харуулна.';
