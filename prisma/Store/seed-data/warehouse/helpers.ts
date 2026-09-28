export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function startOfMonth(offsetMonths = 0) {
  const date = new Date();
  date.setMonth(date.getMonth() + offsetMonths, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfMonth(offsetMonths = 0) {
  const date = startOfMonth(offsetMonths + 1);
  date.setMilliseconds(date.getMilliseconds() - 1);
  return date;
}

export function money(value: number) {
  return value.toFixed(2);
}

export function snapshotDate(days = 0) {
  const date = daysAgo(days);
  date.setHours(0, 0, 0, 0);
  return date;
}
