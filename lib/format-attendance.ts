const DAY_NAMES = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

export function formatTime(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${month}-${day}`;
}

export function getDayName(dateStr: string): string {
  return DAY_NAMES[new Date(dateStr).getDay()];
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ц ${m}м`;
}

export function isToday(dateStr: string): boolean {
  return new Date().toISOString().slice(0, 10) === dateStr.slice(0, 10);
}
