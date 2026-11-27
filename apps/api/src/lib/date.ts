/** Today's calendar date in Asia/Jakarta (UTC+7, no daylight saving). */
export function jakartaToday(now = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
