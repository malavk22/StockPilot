// server/src/utils/money.ts

// price * currentStock in plain JS floats can produce artifacts like
// 249.89999999999998 — round to cents since this is money.
export function roundToCents(n: number): number {
  return Math.round(n * 100) / 100;
}
