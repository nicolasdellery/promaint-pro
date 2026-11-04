import { describe, expect, it } from "vitest";
import { habitualReferences, type HistoryLine } from "@/lib/habits";

const now = new Date("2026-11-04T00:00:00Z");
const l = (order_id: string, product_id: string, created_at: string, quantity = 1, status = "delivered"): HistoryLine => ({ order_id, product_id, created_at, quantity, status });

describe("RG-16 habitual references", () => {
  it("keeps only products ordered at least 2 times", () => {
    const r = habitualReferences([l("o1", "A", "2026-10-01"), l("o2", "A", "2026-09-01"), l("o1", "B", "2026-10-01")], now);
    expect(r.map((x) => x.product_id)).toEqual(["A"]);
  });
  it("ignores orders older than 12 months and cancelled orders", () => {
    const r = habitualReferences([l("o1", "A", "2026-10-01"), l("o2", "A", "2025-10-01"), l("o3", "A", "2026-08-01", 1, "cancelled")], now);
    expect(r).toEqual([]);
  });
  it("sorts by frequency and returns the last quantity", () => {
    const r = habitualReferences([
      l("o1", "A", "2026-06-01", 5), l("o2", "A", "2026-07-01", 8),
      l("o1", "B", "2026-06-01"), l("o2", "B", "2026-07-01"), l("o3", "B", "2026-08-01", 24),
    ], now);
    expect(r.map((x) => [x.product_id, x.count, x.lastQuantity])).toEqual([["B", 3, 24], ["A", 2, 8]]);
  });
});

import { needsQuote, quoteAcceptable } from "@/lib/pricing";
describe("RG-12 / RG-13 quotes", () => {
  it("asks for a quote only above 5000 € HT", () => {
    expect(needsQuote(5000)).toBe(false);
    expect(needsQuote(5000.01)).toBe(true);
  });
  it("an expired quote cannot be accepted", () => {
    expect(quoteAcceptable({ status: "priced", valid_until: "2026-11-03" }, "2026-11-04")).toBe(false);
    expect(quoteAcceptable({ status: "priced", valid_until: "2026-11-04" }, "2026-11-04")).toBe(true);
    expect(quoteAcceptable({ status: "requested", valid_until: null }, "2026-11-04")).toBe(false);
  });
});
