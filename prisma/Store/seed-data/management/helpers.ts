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

export function decimal(value: number) {
  return value.toFixed(2);
}
