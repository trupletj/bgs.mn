-- Нэг хүн нэг ээлжид зөвхөн нэг автобусын аялалын ахлах байх. Одоо байгаа
-- давхардлыг (хамгийн бага id-тай автобусыг үлдээж бусдыг) null болгож, дараа нь
-- partial unique index нэмнэ. trip_leader_id-г null болгоход trg_sync_bus_trip_leader
-- trigger тухайн автобусны trip_leaders projection мөрийг автоматаар устгана.
with dups as (
  select id,
    row_number() over (partition by shift_exchange_id, trip_leader_id order by id) as rn
  from bgs_attendance.buses
  where trip_leader_id is not null
)
update bgs_attendance.buses b
set trip_leader_id = null
from dups
where dups.id = b.id and dups.rn > 1;

create unique index uq_bus_leader_per_exchange
on bgs_attendance.buses (shift_exchange_id, trip_leader_id)
where trip_leader_id is not null;
