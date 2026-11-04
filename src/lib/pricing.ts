// Pricing rules (mirrored by public.compute_price in the database, authoritative at order time).
// RG-03: catalog × (1 − account discount), unless a valid contract price exists → contract wins.
// RG-04 / CL-10: when a quantity tier applies, take the BEST of tier vs account discount, never both.
export type Origin = "contract" | "tier" | "account_discount" | "catalog";

export type PricingAccount = {
  id: string;
  account_discount: number;
  contract_prices: { product_id: string; price: number; end_date: string }[];
};
export type PricingProduct = {
  id: string;
  catalog_price: number;
  tier_prices: { min_quantity: number; discount_percent: number }[];
};
export type UnitPrice = { price: number; origin: Origin; discountPercent: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getUnitPrice(
  account: PricingAccount,
  product: PricingProduct,
  quantity: number,
  today: string = new Date().toISOString().slice(0, 10),
): UnitPrice {
  const catalog = Number(product.catalog_price);

  const contracts = account.contract_prices
    .filter((c) => c.product_id === product.id && c.end_date >= today)
    .map((c) => Number(c.price));
  if (contracts.length) return { price: Math.min(...contracts), origin: "contract", discountPercent: null };

  const accountPct = Number(account.account_discount) || 0;
  const tier = product.tier_prices
    .filter((t) => t.min_quantity <= quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0];
  const tierPct = tier ? Number(tier.discount_percent) : 0;

  if (tier && tierPct >= accountPct && tierPct > 0)
    return { price: round2(catalog * (1 - tierPct / 100)), origin: "tier", discountPercent: tierPct };
  if (accountPct > 0)
    return { price: round2(catalog * (1 - accountPct / 100)), origin: "account_discount", discountPercent: accountPct };
  return { price: catalog, origin: "catalog", discountPercent: null };
}

const pct = (n: number) => `−${Number.isInteger(n) ? n : n.toFixed(1)} %`;
export function priceOriginLabel(p: UnitPrice): string {
  switch (p.origin) {
    case "contract": return "Prix contrat";
    case "tier": return `Remise palier ${pct(p.discountPercent!)}`;
    case "account_discount": return `Remise compte ${pct(p.discountPercent!)}`;
    default: return "Prix catalogue";
  }
}

// RG-10: never expose exact stock quantity.
export type Availability = "in_stock" | "low" | "backorder";
export const LOW_STOCK_THRESHOLD = 10;
export function availability(stock: { quantity: number; restock_delay_days: number } | null | undefined): {
  key: Availability;
  label: string;
} {
  const q = stock?.quantity ?? 0;
  if (q <= 0) return { key: "backorder", label: `Sur commande — délai ${stock?.restock_delay_days ?? "?"} jours` };
  if (q < LOW_STOCK_THRESHOLD) return { key: "low", label: "Stock faible" };
  return { key: "in_stock", label: "En stock" };
}

// RG-07 / CL-04: lots are rounded UP to the next multiple.
export function roundToPack(quantity: number, packSize: number): { quantity: number; adjusted: boolean } {
  const q = Math.max(1, Math.floor(Number(quantity) || 0));
  const rounded = Math.ceil(q / packSize) * packSize;
  return { quantity: rounded, adjusted: rounded !== q };
}

export const MIN_ORDER_HT = 150;
export const PROCESSING_FEE = 15;
export const FREE_SHIPPING_HT = 400;
export const SHIPPING_FEE = 19;

// RG-05 / CL-11 and RG-06 (mirrored by place_order).
export function fees(totalHt: number) {
  const processing = totalHt < MIN_ORDER_HT ? PROCESSING_FEE : 0;
  const shipping = totalHt >= FREE_SHIPPING_HT ? 0 : SHIPPING_FEE;
  return {
    processing,
    shipping,
    missingForNoProcessing: processing ? Math.round((MIN_ORDER_HT - totalHt) * 100) / 100 : 0,
    missingForFreeShipping: shipping ? Math.round((FREE_SHIPPING_HT - totalHt) * 100) / 100 : 0,
  };
}

// RG-14 / CL-05: delivery delay of a line, and global delay = longest line.
export const STANDARD_DELIVERY_DAYS = 2;
export function lineDelayDays(quantity: number, stock: { quantity: number; restock_delay_days: number } | null | undefined) {
  if (stock && stock.quantity >= quantity) return STANDARD_DELIVERY_DAYS;
  return Math.max(STANDARD_DELIVERY_DAYS, stock?.restock_delay_days ?? STANDARD_DELIVERY_DAYS);
}
export function globalDelayDays(lineDelays: number[]) {
  return lineDelays.length ? Math.max(...lineDelays) : 0;
}

// CL-01: price changed since the line was added?
export function priceChanged(snapshot: number | undefined, current: number) {
  return snapshot != null && Math.round(snapshot * 100) !== Math.round(current * 100);
}
