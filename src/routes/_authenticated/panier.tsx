import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { useMe } from "@/lib/me";
import { catalogQuery, toPricingAccount, toPricingProduct } from "@/lib/catalog";
import {
  fees, getUnitPrice, globalDelayDays, lineDelayDays, priceChanged, priceOriginLabel, roundToPack,
  FREE_SHIPPING_HT, MIN_ORDER_HT,
} from "@/lib/pricing";
import { eur } from "@/lib/format";
import { Pill } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/panier")({
  head: () => ({ meta: [{ title: "Panier — ProMaint Pro" }, { name: "description", content: "Votre panier de commande." }] }),
  // Always refetch prices when the cart opens (CL-01).
  loader: ({ context }) => context.queryClient.fetchQuery({ ...catalogQuery, staleTime: 0 }),
  component: Panier,
});

const STATUS_MSG: Record<string, string> = {
  blocked_credit: "Commande bloquée : plafond d'encours dépassé. L'administrateur a été alerté.",
  pending_approval: "Commande en attente de validation. Votre valideur a été notifié.",
  validated: "Commande validée.",
};

function Panier() {
  const lines = useCart();
  const me = useMe();
  const { products, contracts } = useSuspenseQuery(catalogQuery).data;
  const qc = useQueryClient();
  const nav = useNavigate();
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adjusted, setAdjusted] = useState<Record<string, boolean>>({});
  const submitting = useRef(false);
  const requestId = useRef<string>(crypto.randomUUID());

  const account = toPricingAccount(me, contracts);

  const rows = useMemo(
    () =>
      lines.map((l) => {
        const p = products.find((x) => x.id === l.product_id);
        if (!p) return { l, p: undefined, price: null, delay: 0, changed: false };
        const price = getUnitPrice(account, toPricingProduct(p), l.quantity);
        const stock = p.stock as unknown as { quantity: number; restock_delay_days: number } | null;
        return { l, p, price, delay: lineDelayDays(l.quantity, stock), changed: priceChanged(l.unit_price_snapshot, price.price) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, products, contracts],
  );

  // CL-01: remember which lines changed at opening, then store the fresh prices as new snapshot.
  const [updated] = useState(() => new Set(rows.filter((r) => r.changed).map((r) => r.l.product_id)));
  useEffect(() => {
    const fresh: Record<string, number> = {};
    rows.forEach((r) => { if (r.price) fresh[r.l.product_id] = r.price.price; });
    cart.setSnapshots(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = Math.round(rows.reduce((s, r) => s + (r.price ? r.price.price * r.l.quantity : 0), 0) * 100) / 100;
  const f = fees(total);
  const globalDelay = globalDelayDays(rows.map((r) => r.delay));

  function changeQty(id: string, pack: number, raw: number) {
    if (raw <= 0) { cart.setQty(id, 0); return; }
    const r = roundToPack(raw, pack);
    cart.setQty(id, r.quantity);
    setAdjusted((a) => ({ ...a, [id]: r.adjusted }));
  }

  async function submit() {
    if (submitting.current) return; // CL-07 — client guard; server is idempotent on request id
    submitting.current = true;
    setBusy(true);
    const { data: orderId, error } = await supabase.rpc("place_order", {
      _lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      _partial: partial,
      _request_id: requestId.current,
    });
    if (error) {
      submitting.current = false;
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
    cart.clear();
    await qc.invalidateQueries();
    const st = order?.status ?? "validated";
    if (st === "blocked_credit") toast.error(STATUS_MSG[st]); else toast.success(STATUS_MSG[st] ?? "Commande enregistrée");
    nav({ to: "/commandes" });
  }

  if (lines.length === 0)
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Panier</h1>
        <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Panier</h1>
        <div className="overflow-x-auto rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="w-32">Quantité</TableHead>
                <TableHead className="text-right">P.U. HT</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead>Délai</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ l, p, price, delay }) => (
                <TableRow key={l.product_id}>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>
                    <div className="text-sm">{l.name}</div>
                    {updated.has(l.product_id) && <Pill tone="warn">Prix mis à jour</Pill>}
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={1} defaultValue={l.quantity} key={l.quantity} className="h-8 w-24 font-mono" aria-label={`Quantité ${l.sku}`}
                      onBlur={(e) => changeQty(l.product_id, l.pack_size, Number(e.target.value) || 0)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    {l.pack_size > 1 && (
                      <div className={`mt-1 text-[11px] ${adjusted[l.product_id] ? "text-warning-foreground font-medium" : "text-muted-foreground"}`}>
                        {adjusted[l.product_id] ? `Vendu par ${l.pack_size}, quantité ajustée` : `Vendu par ${l.pack_size}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {price ? (
                      <>
                        <div className="font-mono text-sm">{eur(price.price)}</div>
                        <div className="text-[11px] text-muted-foreground">{priceOriginLabel(price)}</div>
                      </>
                    ) : <span className="text-xs text-destructive">Indisponible</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{price ? eur(price.price * l.quantity) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p ? `${delay} j` : "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => cart.setQty(l.product_id, 0)}>Retirer</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-md border bg-card p-4 lg:mt-11">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt>Sous-total HT</dt><dd className="font-mono">{eur(total)}</dd></div>
          <div className="flex justify-between"><dt>Frais de traitement</dt><dd className="font-mono">{eur(f.processing)}</dd></div>
          {f.processing > 0 && (
            <p className="rounded bg-warning/15 px-2 py-1 text-xs text-warning-foreground">
              Minimum {eur(MIN_ORDER_HT)} HT : ajoutez {eur(f.missingForNoProcessing)} pour éviter ces frais.
            </p>
          )}
          <div className="flex justify-between"><dt>Port</dt><dd className="font-mono">{f.shipping ? eur(f.shipping) : "Offert"}</dd></div>
          {f.shipping > 0 && (
            <p className="text-xs text-muted-foreground">Franco à {eur(FREE_SHIPPING_HT)} HT : encore {eur(f.missingForFreeShipping)}.</p>
          )}
          <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total HT</dt><dd className="font-mono">{eur(total + f.processing + f.shipping)}</dd></div>
        </dl>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={partial} onCheckedChange={(v) => setPartial(!!v)} className="mt-0.5" />
          J'accepte une livraison partielle
        </label>
        <p className="text-xs text-muted-foreground">
          {partial
            ? "Les articles disponibles partent sans attendre le reste."
            : <>Livraison en une fois — délai global : <span className="font-mono font-medium text-foreground">{globalDelay} jours</span> (ligne la plus longue).</>}
        </p>

        <Button className="w-full" onClick={submit} disabled={busy || rows.some((r) => !r.price)}>
          {busy ? "Validation…" : "Valider la commande"}
        </Button>
        {me.role === "buyer" && (
          <p className="text-[11px] text-muted-foreground">Au-delà de {eur(Number(me.account?.approval_threshold))} HT, la commande est soumise à votre valideur.</p>
        )}
      </aside>
    </div>
  );
}
