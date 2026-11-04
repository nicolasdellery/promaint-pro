import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/lib/me";
import { cart } from "@/lib/cart";
import { catalogQuery, toPricingAccount, toPricingProduct } from "@/lib/catalog";
import { getUnitPrice, priceOriginLabel, roundToPack } from "@/lib/pricing";
import { habitualReferences } from "@/lib/habits";
import { ordersQuery } from "./commandes";
import { dateFr, eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/references")({
  head: () => ({ meta: [{ title: "Mes références habituelles — ProMaint Pro" }, { name: "description", content: "Vos produits commandés régulièrement." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(ordersQuery), context.queryClient.ensureQueryData(catalogQuery)]),
  component: References,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Introuvable.</div>,
});

function References() {
  const me = useMe();
  const orders = useSuspenseQuery(ordersQuery).data;
  const { products, contracts } = useSuspenseQuery(catalogQuery).data;
  const account = toPricingAccount(me, contracts);
  const refs = habitualReferences(
    orders.flatMap((o) => o.order_lines.map((l) => ({ order_id: o.id, created_at: o.created_at, status: o.status, product_id: l.product_id, quantity: l.quantity }))),
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mes références habituelles</h1>
        <p className="text-sm text-muted-foreground">Produits commandés au moins 2 fois sur les 12 derniers mois, du plus fréquent au moins fréquent.</p>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead className="text-right">Commandé</TableHead>
              <TableHead>Dernière commande</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {refs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Pas encore de référence habituelle.</TableCell></TableRow>}
            {refs.map((r) => {
              const p = byId.get(r.product_id);
              if (!p) return null;
              const qty = roundToPack(r.lastQuantity, p.pack_size).quantity;
              const price = getUnitPrice(account, toPricingProduct(p), qty);
              const orderable = p.status === "active";
              return (
                <TableRow key={r.product_id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right font-mono">{r.count}×</TableCell>
                  <TableCell className="text-xs">{dateFr(r.lastOrderedAt)} · qté {r.lastQuantity}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono">{eur(price.price)}</div>
                    <div className="text-[11px] text-muted-foreground">{priceOriginLabel(price)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" disabled={!orderable} onClick={() => {
                      cart.add({ product_id: p.id, sku: p.sku, name: p.name, pack_size: p.pack_size, quantity: qty, unit_price_snapshot: price.price });
                      toast.success(`${p.sku} × ${qty} ajouté au panier`);
                    }}>{orderable ? `Ajouter ${qty}` : "Indisponible"}</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
