import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { catalogQuery } from "@/lib/catalog";
import { cart } from "@/lib/cart";
import { availability, getUnitPrice, roundToPack, priceOriginLabel, type Availability, type PricingAccount } from "@/lib/pricing";
import { eur } from "@/lib/format";
import { Pill } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/catalogue")({
  head: () => ({ meta: [{ title: "Catalogue — ProMaint Pro" }, { name: "description", content: "Catalogue et tarifs client." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Catalogue,
});

type Product = Awaited<ReturnType<NonNullable<typeof catalogQuery.queryFn>>>["products"][number];
type StockRow = { quantity: number; restock_delay_days: number } | null;
type AvailFilter = "all" | Availability | "quote_only";

const toneFor = { in_stock: "ok", low: "warn", backorder: "neutral" } as const;

function AvailabilityPill({ p }: { p: Product }) {
  if (p.status === "discontinued") return <Pill>Produit arrêté</Pill>;
  if (p.status === "quote_only") return <Pill tone="info">Sur devis</Pill>;
  const a = availability(p.stock as unknown as StockRow);
  return <Pill tone={toneFor[a.key]}>{a.label}</Pill>;
}

function Catalogue() {
  const me = useMe();
  const { products, contracts } = useSuspenseQuery(catalogQuery).data;
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("Toutes");
  const [avail, setAvail] = useState<AvailFilter>("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const isAdmin = me.role === "admin";
  const families = ["Toutes", ...Array.from(new Set(products.map((p) => p.family)))];

  const account: PricingAccount = {
    id: me.account_id ?? "",
    account_discount: Number(me.account?.account_discount ?? 0),
    contract_prices: contracts
      .filter((c) => c.account_id === me.account_id)
      .map((c) => ({ product_id: c.product_id, price: Number(c.price), end_date: c.end_date })),
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (family !== "Toutes" && p.family !== family) return false;
      if (needle && !p.sku.toLowerCase().includes(needle) && !p.name.toLowerCase().includes(needle)) return false;
      if (avail === "all") return true;
      if (avail === "quote_only") return p.status === "quote_only";
      return p.status === "active" && availability(p.stock as unknown as StockRow).key === avail;
    });
  }, [products, family, q, avail]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Catalogue</h1>
        <Input placeholder="Référence ou nom…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56" />
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{families.map((f) => <SelectItem key={f} value={f}>{f === "Toutes" ? "Toutes les familles" : f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={avail} onValueChange={(v) => setAvail(v as AvailFilter)}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute disponibilité</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
            <SelectItem value="backorder">Sur commande</SelectItem>
            <SelectItem value="quote_only">Sur devis</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{rows.length} réf.</span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Réf.</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead className="text-center">Cond.</TableHead>
              <TableHead>Disponibilité</TableHead>
              <TableHead className="text-right">{isAdmin ? "Catalogue HT" : "Votre prix HT"}</TableHead>
              {!isAdmin && <TableHead className="w-52" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Aucun produit ne correspond.</TableCell></TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id} className={p.status === "discontinued" ? "opacity-60" : ""}>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell>
                  <button type="button" onClick={() => setSelected(p)} className="text-left hover:text-primary hover:underline">
                    <div className="font-medium">{p.name}</div>
                  </button>
                  <div className="text-xs text-muted-foreground">{p.family}</div>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">{p.pack_size > 1 ? `lot ×${p.pack_size}` : "unité"}</TableCell>
                <TableCell><AvailabilityPill p={p} /></TableCell>
                <TableCell className="text-right">
                  <PriceCell account={account} p={p} qty={p.pack_size} isAdmin={isAdmin} />
                </TableCell>
                {!isAdmin && <TableCell><BuyControls p={p} me={me} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && <ProductSheet p={selected} account={account} isAdmin={isAdmin} me={me} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceCell({ account, p, qty, isAdmin }: { account: PricingAccount; p: Product; qty: number; isAdmin: boolean }) {
  if (isAdmin) return <span className="font-mono text-sm">{eur(Number(p.catalog_price))}</span>;
  if (p.status === "quote_only") return <span className="text-xs text-muted-foreground">Prix sur devis</span>;
  if (p.status === "discontinued") return <span className="text-muted-foreground">—</span>;
  const r = getUnitPrice(account, { id: p.id, catalog_price: Number(p.catalog_price), tier_prices: p.tier_prices.map((t) => ({ min_quantity: t.min_quantity, discount_percent: Number(t.discount_percent) })) }, qty);
  return (
    <div>
      <div className="font-mono text-sm font-semibold">{eur(r.price)}</div>
      <div className="text-[11px] text-muted-foreground">{priceOriginLabel(r)}</div>
    </div>
  );
}

type Me = ReturnType<typeof useMe>;

function BuyControls({ p, me, unitPrice }: { p: Product; me: Me; unitPrice?: number }) {
  const [qty, setQty] = useState(p.pack_size);
  if (p.status === "discontinued") return null;
  if (p.status === "quote_only") return <QuoteButton productId={p.id} accountId={me.account_id!} userId={me.id} />;
  const pack = p.pack_size;
  return (
    <div className="flex gap-1">
      <Input type="number" min={1} value={qty} className="h-8 w-20 font-mono" aria-label="Quantité"
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        onBlur={() => { const r = roundToPack(qty, pack); if (r.adjusted) { setQty(r.quantity); toast.info(`Vendu par ${pack}, quantité ajustée`); } }} />
      <Button size="sm" onClick={() => {
        const r = roundToPack(qty, pack);
        setQty(r.quantity);
        cart.add({ product_id: p.id, sku: p.sku, name: p.name, pack_size: pack, quantity: r.quantity, unit_price_snapshot: unitPrice });
        if (r.adjusted) toast.info(`Vendu par ${pack}, quantité ajustée à ${r.quantity}`);
        toast.success(`${p.sku} ajouté au panier`);
      }}>Ajouter au panier</Button>
    </div>
  );
}

function ProductSheet({ p, account, isAdmin, me }: { p: Product; account: PricingAccount; isAdmin: boolean; me: Me }) {
  const attrs = Object.entries((p.technical_attributes ?? {}) as Record<string, unknown>);
  const tiers = [...p.tier_prices].sort((a, b) => a.min_quantity - b.min_quantity);
  return (
    <>
      <DialogHeader>
        <p className="font-mono text-xs text-muted-foreground">{p.sku} · {p.family}</p>
        <DialogTitle>{p.name}</DialogTitle>
        <DialogDescription asChild><div><AvailabilityPill p={p} /></div></DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
        {attrs.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
            <dd className="font-mono">{String(v)}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Conditionnement</dt>
        <dd className="font-mono">{p.pack_size > 1 ? `Lot de ${p.pack_size} — commande par multiple de ${p.pack_size}` : "À l'unité"}</dd>
      </dl>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Catalogue {eur(Number(p.catalog_price))} HT</div>
          <PriceCell account={account} p={p} qty={p.pack_size} isAdmin={isAdmin} />
        </div>
        {!isAdmin && <BuyControls p={p} me={me} />}
      </div>
      {tiers.length > 0 && p.status === "active" && (
        <p className="text-xs text-muted-foreground">
          Paliers : {tiers.map((t) => `−${Number(t.discount_percent)} % dès ${t.min_quantity}`).join(" · ")} (non cumulables avec la remise compte)
        </p>
      )}
    </>
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
