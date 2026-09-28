export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function money(value: number): string {
  return value.toFixed(2);
}

export function orderTransactionId(key: string): string {
  return `OPS-DEMO-${key}`;
}

export function paymentExternalId(key: string): string {
  return `OPS-DEMO-PAY-${key}`;
}
