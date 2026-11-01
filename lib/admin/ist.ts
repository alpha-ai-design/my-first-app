// Everything on the owner's screen is shown in Indian time, whatever the phone is set to.
const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000; // UTC+5:30, no daylight saving

export function formatTimeIST(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateTimeIST(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Midnight today in IST, as a real instant.
export function startOfTodayIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}

// The next 6:00 am IST: tomorrow morning, or this morning if it's after midnight but before 6.
export function next6amIST(now = new Date()): Date {
  const sixToday = new Date(startOfTodayIST(now).getTime() + 6 * 3600_000);
  return sixToday > now ? sixToday : new Date(sixToday.getTime() + 24 * 3600_000);
}

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

// "Sun 1 Nov, 11:59 pm" (IST).
export function formatDayTimeIST(iso: string | Date): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${formatTimeIST(d)}`;
}

// Today's date in India as "YYYY-MM-DD" (for date inputs).
export function todayISTString(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Midnight IST at the start of a "YYYY-MM-DD" day.
export function startOfDayIST(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

// 11:59 pm IST at the end of a "YYYY-MM-DD" day (one millisecond before the next midnight).
export function endOfDayIST(ymd: string): Date {
  return new Date(startOfDayIST(ymd).getTime() + 24 * 3600_000 - 1);
}

// "YYYY-MM-DD" n days after a "YYYY-MM-DD" day.
export function addDays(ymd: string, n: number): string {
  return new Date(startOfDayIST(ymd).getTime() + IST_OFFSET_MS + n * 24 * 3600_000).toISOString().slice(0, 10);
}

// Day of the week in India: 0 = Sunday … 6 = Saturday.
export function weekdayIST(now = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCDay();
}

// "2 days 4 h", "5 h 20 min", "45 min".
export function formatDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return hours ? `${days} ${days === 1 ? "day" : "days"} ${hours} h` : `${days} ${days === 1 ? "day" : "days"}`;
  if (hours > 0) return m ? `${hours} h ${m} min` : `${hours} h`;
  return `${m} min`;
}
