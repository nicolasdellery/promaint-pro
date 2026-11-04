import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { cart } from "@/lib/cart";
import { computePrice } from "@/lib/pricing";
import { eur, PRICE_ORIGIN } from "@/lib/format";
import { Pill } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const [p, t, c] = await Promise.all([
      supabase.from("products").select("*, stock(*)").order("sku"),
      supabase.from("tier_prices").select("*"),
      supabase.from("contract_prices").select("*").gte("end_date", new Date().toISOString().slice(0, 10)),
    ]);
    if (p.error) throw p.error;
    return { products: p.data, tiers: t.data ?? [], contracts: c.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/catalogue")({
  head: () => ({ meta: [{ title: "Catalogue — ProMaint Pro" }, { name: "description", content: "Catalogue et tarifs client." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Catalogue,
});

function Catalogue() {
  const me = useMe();
  const { products, tiers, contracts } = useSuspenseQuery(catalogQuery).data;
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("Toutes");
  const [qty, setQty] = useState<Record<string, number>>({});
  const families = ["Toutes", ...Array.from(new Set(products.map((p) => p.family)))];
  const isAdmin = me.role === "admin";

  const rows = useMemo(
    () =>
      products.filter(
        (p) =>
          (family === "Toutes" || p.family === family) &&
          (q === "" || `${p.sku} ${p.name}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [products, family, q],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-xl font-semibold">Catalogue</h1>
        {families.map((f) => (
          <Button key={f} size="sm" variant={f === family ? "default" : "outline"} onClick={() => setFamily(f)}>{f}</Button>
        ))}
        <Input placeholder="Réf. ou désignation…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto h-8 w-64" />
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Réf.</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Caractéristiques</TableHead>
              <TableHead className="text-right">Catalogue HT</TableHead>
              {!isAdmin && <TableHead className="text-right">Votre prix HT</TableHead>}
              <TableHead className="text-center">Lot</TableHead>
              <TableHead>Stock</TableHead>
              {!isAdmin && <TableHead className="w-44">Quantité</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const pack = p.pack_size;
              const qn = qty[p.id] ?? pack;
              const contract = contracts.find((c) => c.product_id === p.id && c.account_id === me.account_id);
              const price = computePrice({
                catalogPrice: Number(p.catalog_price),
                accountDiscount: Number(me.account?.account_discount ?? 0),
                contractPrice: contract ? Number(contract.price) : null,
                tiers: tiers.filter((t) => t.product_id === p.id).map((t) => ({ min_quantity: t.min_quantity, discount_percent: Number(t.discount_percent) })),
                quantity: qn,
              });
              const stock = p.stock as unknown as { quantity: number; restock_delay_days: number } | null;
              const attrs = Object.entries((p.technical_attributes ?? {}) as Record<string, unknown>);
              return (
                <TableRow key={p.id} className={p.status === "discontinued" ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.family}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{attrs.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{eur(Number(p.catalog_price))}</TableCell>
                  {!isAdmin && (
                    <TableCell className="text-right">
                      {p.status === "active" ? (
                        <>
                          <div className="font-mono text-sm font-semibold">{eur(price.unit)}</div>
                          <div className="text-[11px] text-muted-foreground">{PRICE_ORIGIN[price.origin]}</div>
                        </>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-center font-mono text-xs">{pack > 1 ? `×${pack}` : "1"}</TableCell>
                  <TableCell>
                    {p.status === "discontinued" ? <Pill>Arrêté</Pill>
                      : p.status === "quote_only" ? <Pill tone="info">Sur devis</Pill>
                      : stock && stock.quantity > 0 ? <Pill tone="ok">{stock.quantity} dispo</Pill>
                      : <Pill tone="warn">Réappro. {stock?.restock_delay_days ?? "?"} j</Pill>}
                  </TableCell>
                  {!isAdmin && (
                    <TableCell>
                      {p.status === "active" ? (
                        <div className="flex gap-1">
                          <Input type="number" min={pack} step={pack} value={qn} className="h-8 w-20 font-mono"
                            onChange={(e) => setQty({ ...qty, [p.id]: Math.max(pack, Number(e.target.value) || pack) })} />
                          <Button size="sm" onClick={() => {
                            if (qn % pack !== 0) { toast.error(`Quantité multiple de ${pack} requise`); return; }
                            cart.add({ product_id: p.id, sku: p.sku, name: p.name, pack_size: pack, quantity: qn });
                            toast.success(`${p.sku} ajouté au panier`);
                          }}>Ajouter</Button>
                        </div>
                      ) : p.status === "quote_only" ? (
                        <QuoteButton productId={p.id} accountId={me.account_id!} userId={me.id} />
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function QuoteButton({ productId, accountId, userId }: { productId: string; accountId: string; userId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true);
      const id = crypto.randomUUID();
      const { error } = await supabase.from("quotes").insert({ id, account_id: accountId, requested_by: userId });
      const l = error ? error : (await supabase.from("quote_lines").insert({ quote_id: id, product_id: productId, quantity: 1 })).error;
      setBusy(false);
      if (l) { toast.error("Demande de devis impossible"); return; }
      toast.success("Demande de devis envoyée");
    }}>Demander un devis</Button>
  );
}
