// client/src/utils/format.ts

export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
