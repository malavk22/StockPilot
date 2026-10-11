// client/src/constants/movement-type-filters.ts
//
// Options for the "filter by movement type" dropdowns on the Ledger and
// product detail pages.

import type { MovementType } from "../types";

export const TYPE_FILTERS: Array<{ value: MovementType | "ALL"; label: string }> = [
  { value: "ALL", label: "All types" },
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
];
