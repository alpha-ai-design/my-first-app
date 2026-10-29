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
