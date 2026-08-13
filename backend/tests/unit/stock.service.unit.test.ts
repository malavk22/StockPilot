import { describe, it, expect } from "vitest";
import { computeSignedQuantity } from "../../src/services/stock.service.js";

describe("computeSignedQuantity", () => {
  it("keeps IN quantities positive", () => {
    expect(computeSignedQuantity("IN", 10)).toBe(10);
  });

  it("negates OUT quantities", () => {
    expect(computeSignedQuantity("OUT", 10)).toBe(-10);
  });

  it("passes ADJUSTMENT quantities through unchanged (already signed by the caller)", () => {
    expect(computeSignedQuantity("ADJUSTMENT", -3)).toBe(-3);
    expect(computeSignedQuantity("ADJUSTMENT", 3)).toBe(3);
  });
});
