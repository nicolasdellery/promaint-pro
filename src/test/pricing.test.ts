import { describe, expect, it } from "vitest";
import { availability, getUnitPrice, priceOriginLabel, type PricingAccount, type PricingProduct } from "@/lib/pricing";

const TODAY = "2026-11-04";
const product: PricingProduct = {
  id: "p1",
  catalog_price: 100,
  tier_prices: [
    { min_quantity: 10, discount_percent: 5 },
    { min_quantity: 50, discount_percent: 10 },
  ],
};
const acc = (discount: number, contracts: PricingAccount["contract_prices"] = []): PricingAccount => ({
  id: "a1",
  account_discount: discount,
  contract_prices: contracts,
});

describe("RG-03 — remise compte et prix contrat", () => {
  it("applies the account discount to the catalog price", () => {
    const r = getUnitPrice(acc(8), { ...product, tier_prices: [] }, 1, TODAY);
    expect(r).toEqual({ price: 92, origin: "account_discount", discountPercent: 8 });
    expect(priceOriginLabel(r)).toBe("Remise compte −8 %");
  });
  it("returns the catalog price when the account has no discount", () => {
    expect(getUnitPrice(acc(0), product, 1, TODAY)).toEqual({ price: 100, origin: "catalog", discountPercent: null });
  });
  it("a valid contract price wins over account discount and tiers", () => {
    const r = getUnitPrice(acc(12, [{ product_id: "p1", price: 95, end_date: "2026-12-31" }]), product, 60, TODAY);
    expect(r).toEqual({ price: 95, origin: "contract", discountPercent: null });
  });
  it("ignores an expired contract", () => {
    const r = getUnitPrice(acc(8, [{ product_id: "p1", price: 70, end_date: "2026-11-03" }]), product, 1, TODAY);
    expect(r.origin).toBe("account_discount");
  });
  it("ignores a contract for another product", () => {
    const r = getUnitPrice(acc(0, [{ product_id: "p2", price: 70, end_date: "2026-12-31" }]), product, 1, TODAY);
    expect(r.origin).toBe("catalog");
  });
});

describe("RG-04 / CL-10 — meilleure remise entre palier et compte, jamais le cumul", () => {
  it("tier wins when larger than the account discount", () => {
    const r = getUnitPrice(acc(8), product, 50, TODAY);
    expect(r).toEqual({ price: 90, origin: "tier", discountPercent: 10 });
  });
  it("account discount wins when larger than the tier", () => {
    expect(getUnitPrice(acc(8), product, 10, TODAY)).toEqual({ price: 92, origin: "account_discount", discountPercent: 8 });
  });
  it("never stacks tier and account discount (12 % + 10 % → 12 %, not 20.8 %)", () => {
    expect(getUnitPrice(acc(12), product, 50, TODAY).price).toBe(88);
  });
  it("uses the highest reached tier only", () => {
    expect(getUnitPrice(acc(0), product, 49, TODAY)).toEqual({ price: 95, origin: "tier", discountPercent: 5 });
  });
  it("below the first tier, falls back to account discount", () => {
    expect(getUnitPrice(acc(8), product, 9, TODAY).origin).toBe("account_discount");
  });
});

describe("RG-10 — affichage du stock", () => {
  it("labels without exact quantity", () => {
    expect(availability({ quantity: 120, restock_delay_days: 2 }).label).toBe("En stock");
    expect(availability({ quantity: 9, restock_delay_days: 2 }).label).toBe("Stock faible");
    expect(availability({ quantity: 0, restock_delay_days: 10 }).label).toBe("Sur commande — délai 10 jours");
  });
});
