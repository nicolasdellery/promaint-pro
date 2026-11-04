import { describe, expect, it } from "vitest";
import { computePrice } from "@/lib/pricing";

const tiers = [
  { min_quantity: 10, discount_percent: 5 },
  { min_quantity: 50, discount_percent: 10 },
];

describe("pricing", () => {
  it("contract price wins over everything", () => {
    expect(computePrice({ catalogPrice: 100, accountDiscount: 12, contractPrice: 70, tiers, quantity: 60 })).toEqual({ unit: 70, origin: "contract" });
  });
  it("tier discount applies when larger than account discount", () => {
    expect(computePrice({ catalogPrice: 100, accountDiscount: 8, tiers, quantity: 50 })).toEqual({ unit: 90, origin: "tier" });
  });
  it("account discount applies when larger than tier", () => {
    expect(computePrice({ catalogPrice: 100, accountDiscount: 8, tiers, quantity: 10 })).toEqual({ unit: 92, origin: "account_discount" });
  });
  it("catalog price with no discount", () => {
    expect(computePrice({ catalogPrice: 100, accountDiscount: 0, tiers: [], quantity: 1 })).toEqual({ unit: 100, origin: "catalog" });
  });
});
