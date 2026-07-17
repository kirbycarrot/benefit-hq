// Plan year effective dates are entered as plain dates (no time-of-day meaning),
// so format in UTC to avoid the browser's local timezone shifting the day.
export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}
