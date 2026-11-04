// Mirrors public.compute_price in the database (the database is authoritative at order time).
export type Origin = "contract" | "tier" | "account_discount" | "catalog";

export function computePrice(args: {
  catalogPrice: number;
  accountDiscount: number;
  contractPrice?: number | null;
  tiers: { min_quantity: number; discount_percent: number }[];
  quantity: number;
}): { unit: number; origin: Origin } {
  const { catalogPrice, accountDiscount, contractPrice, tiers, quantity } = args;
  const r = (n: number) => Math.round(n * 100) / 100;
  if (contractPrice != null) return { unit: Number(contractPrice), origin: "contract" };
  const tier = tiers
    .filter((t) => t.min_quantity <= quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0];
  const d = Number(accountDiscount) || 0;
  if (tier && Number(tier.discount_percent) >= d)
    return { unit: r(catalogPrice * (1 - Number(tier.discount_percent) / 100)), origin: "tier" };
  if (d > 0) return { unit: r(catalogPrice * (1 - d / 100)), origin: "account_discount" };
  return { unit: Number(catalogPrice), origin: "catalog" };
}

export function fees(totalHt: number) {
  return { processing: totalHt < 150 ? 15 : 0, shipping: totalHt >= 500 ? 0 : 25 };
}
