import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PricingAccount, PricingProduct } from "@/lib/pricing";

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*, stock(*), tier_prices(*)").order("sku"),
      supabase.from("contract_prices").select("*"),
    ]);
    if (p.error) throw p.error;
    return { products: p.data, contracts: c.data ?? [] };
  },
});

type Data = Awaited<ReturnType<NonNullable<typeof catalogQuery.queryFn>>>;
export type CatalogProduct = Data["products"][number];

export function toPricingProduct(p: CatalogProduct): PricingProduct {
  return {
    id: p.id,
    catalog_price: Number(p.catalog_price),
    tier_prices: p.tier_prices.map((t) => ({ min_quantity: t.min_quantity, discount_percent: Number(t.discount_percent) })),
  };
}

export function toPricingAccount(
  me: { account_id: string | null; account: { account_discount: number } | null },
  contracts: Data["contracts"],
): PricingAccount {
  return {
    id: me.account_id ?? "",
    account_discount: Number(me.account?.account_discount ?? 0),
    contract_prices: contracts
      .filter((c) => c.account_id === me.account_id)
      .map((c) => ({ product_id: c.product_id, price: Number(c.price), end_date: c.end_date })),
  };
}
