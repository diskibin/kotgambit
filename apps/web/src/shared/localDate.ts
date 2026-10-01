/** The learner's calendar day as YYYY-MM-DD, in their own timezone: it decides what "today" is for the goal and the streak. */
export function localDateKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
