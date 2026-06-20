import { Bus, CalendarClock, Crown, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MockUnaaCard {
  dayDate: string;
  isCome: boolean;
  autobusNumber: string;
  directionName: string;
  driverName: string;
  driverPhone: string;
  leaderName: string;
  isMyAssignment: boolean;
}

const MOCK_CARDS: MockUnaaCard[] = [
  {
    dayDate: "2026-06-04",
    isCome: true,
    autobusNumber: "1234 УБА",
    directionName: "Налайх → Уурхай",
    driverName: "Б. Батбаяр",
    driverPhone: "9911-2233",
    leaderName: "Д. Дорж",
    isMyAssignment: true,
  },
  {
    dayDate: "2026-06-11",
    isCome: false,
    autobusNumber: "5678 УБЕ",
    directionName: "Уурхай → Налайх",
    driverName: "Г. Ганбат",
    driverPhone: "8822-4455",
    leaderName: "С. Сүхбат",
    isMyAssignment: false,
  },
  {
    dayDate: "2026-06-18",
    isCome: true,
    autobusNumber: "9012 УБВ",
    directionName: "Налайх → Уурхай",
    driverName: "М. Мөнхбат",
    driverPhone: "9933-7788",
    leaderName: "Б. Болд",
    isMyAssignment: false,
  },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

function UnaaCard({ card }: { card: MockUnaaCard }) {
  return (
    <Card
      className={
        card.isMyAssignment
          ? "gap-3 border-primary/40 px-4 py-4 ring-1 ring-primary/10"
          : "gap-3 px-4 py-4"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold tabular-nums text-foreground">
            {card.dayDate}
          </span>
          {card.isCome ? (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
              Ирэх
            </Badge>
          ) : (
            <Badge className="border-transparent bg-indigo-100 text-indigo-700">
              Буух
            </Badge>
          )}
          {card.isMyAssignment && (
            <Badge variant="outline" className="text-[11px]">
              Миний хуваарь
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
        <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">Аяллын ахлах</p>
          <p className="truncate text-sm font-medium text-foreground">
            {card.leaderName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Ээлж солилцооны хот аймаг" value={card.directionName} />
        <Field
          label="Автобусны дугаар"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Bus className="h-3.5 w-3.5 text-primary" />
              {card.autobusNumber}
            </span>
          }
        />
        <Field
          label="Жолоочийн нэр"
          value={
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {card.driverName}
            </span>
          }
        />
        <Field
          label="Жолоочийн дугаар"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {card.driverPhone}
            </span>
          }
        />
      </div>
    </Card>
  );
}

export function EeljMockSection() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Тээврийн хуваарь
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Ээлж солилцоо
        </h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bus className="h-4 w-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Унаа</h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {MOCK_CARDS.map((card) => (
            <UnaaCard key={`${card.dayDate}-${card.autobusNumber}`} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
