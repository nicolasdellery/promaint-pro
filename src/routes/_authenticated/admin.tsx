import { frError } from "@/lib/errors";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/me";
import { dateFr, eur } from "@/lib/format";
import { ordersQuery } from "./commandes";
import { quotesQuery } from "./devis";
import { Pill, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const adminQuery = queryOptions({
  queryKey: ["admin"],
  queryFn: async () => {
    const [e, a, r, c, p] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("account_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("contract_prices").select("*, account:accounts(name), product:products(sku,name,catalog_price)").order("end_date"),
      supabase.from("products").select("id, sku, name, catalog_price").eq("status", "active").order("sku"),
    ]);
    return { events: e.data ?? [], accounts: a.data ?? [], requests: r.data ?? [], contracts: c.data ?? [], products: p.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Back-office — ProMaint Pro" }, { name: "description", content: "Back-office ProMaint : comptes, prix, devis, commandes." }] }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.role !== "admin") throw redirect({ to: "/catalogue" });
  },
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(adminQuery),
    context.queryClient.ensureQueryData(ordersQuery),
    context.queryClient.ensureQueryData(quotesQuery),
  ]),
  component: Admin,
  errorComponent: ({ error }) => <div role="alert">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div>Introuvable.</div>,
});

const tone = { erp_error: "danger", alert: "warn", erp_attempt: "info", status_change: "neutral" } as const;

function useRpc() {
  const qc = useQueryClient();
  return async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await fn();
    if (error) { toast.error(frError(error)); return false; }
    toast.success(ok);
    await qc.invalidateQueries();
    return true;
  };
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-semibold">{title}{count != null && <Pill tone={count ? "warn" : "neutral"}>{count}</Pill>}</h2>
      <div className="rounded-md border bg-card">{children}</div>
    </section>
  );
}

function Admin() {
  const { events, requests } = useSuspenseQuery(adminQuery).data;
  const orders = useSuspenseQuery(ordersQuery).data;
  const quotes = useSuspenseQuery(quotesQuery).data;
  const run = useRpc();

  const blocked = orders.filter((o) => o.status === "blocked_credit" || (o.status === "validated" && (o.erp_attempts >= 3 || o.erp_blocked_reason)));
  const shippable = orders.filter((o) => o.status === "sent_to_erp" || o.status === "in_preparation");
  const toPrice = quotes.filter((q) => q.status === "requested");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Back-office ProMaint</h1>
      <Accounts />
      <Contracts />

      <Section title="Devis à chiffrer" count={toPrice.length}>
        {toPrice.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun devis à chiffrer.</p>}
        <div className="divide-y">{toPrice.map((q) => <QuotePricing key={q.id} quote={q} />)}</div>
      </Section>

      <Section title="Commandes bloquées" count={blocked.length}>
        <Table>
          <TableBody>
            {blocked.length === 0 && <TableRow><TableCell className="text-sm text-muted-foreground">Aucune commande bloquée.</TableCell></TableRow>}
            {blocked.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{dateFr(o.created_at)}</TableCell>
                <TableCell className="text-sm">{o.account?.name}</TableCell>
                <TableCell className="text-right font-mono">{eur(Number(o.total_ht))}</TableCell>
                <TableCell>
                  {o.status === "blocked_credit" ? <StatusBadge status={o.status} />
                    : o.erp_blocked_reason ? <Pill tone="danger">{o.erp_blocked_reason}</Pill>
                    : <Pill tone="danger">ERP : 3 échecs</Pill>}
                </TableCell>
                <TableCell className="text-right">
                  {o.status === "blocked_credit" && <Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("admin_release_credit", { _order: o.id }), "Commande débloquée")}>Débloquer (dérogation)</Button>}
                  {o.status === "validated" && !o.erp_blocked_reason && <Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("admin_retry_erp", { _order: o.id }), "Transmission ERP relancée")}>Relancer ERP</Button>}
                  {o.erp_blocked_reason && <span className="text-xs text-muted-foreground">Remplacement à faire dans Commandes</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Commandes à expédier" count={shippable.length}>
        <Table>
          <TableBody>
            {shippable.length === 0 && <TableRow><TableCell className="text-sm text-muted-foreground">Aucune commande à expédier.</TableCell></TableRow>}
            {shippable.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{dateFr(o.created_at)}</TableCell>
                <TableCell className="text-sm">{o.account?.name}</TableCell>
                <TableCell className="font-mono text-xs">{o.erp_reference}</TableCell>
                <TableCell className="text-right font-mono">{eur(Number(o.total_ht))}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell className="text-right"><Button size="sm" onClick={() => run(() => supabase.rpc("admin_simulate_shipment", { _order: o.id }), "Expédition simulée, numéro de suivi ajouté")}>Simuler expédition</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Journal d'événements">
          <Table>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{dateFr(e.created_at)}</TableCell>
                  <TableCell><Pill tone={tone[e.type]}>{e.type}</Pill></TableCell>
                  <TableCell className="text-sm">{e.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title="Demandes d'ouverture de compte">
          <Table>
            <TableBody>
              {requests.length === 0 && <TableRow><TableCell className="text-sm text-muted-foreground">Aucune demande.</TableCell></TableRow>}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{dateFr(r.created_at)}</TableCell>
                  <TableCell><div className="text-sm font-medium">{r.company}</div><div className="text-xs text-muted-foreground">{r.contact_name} · {r.email}</div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>
    </div>
  );
}

function Accounts() {
  const { accounts } = useSuspenseQuery(adminQuery).data;
  return (
    <Section title="Comptes clients">
      <Table>
        <TableHeader><TableRow><TableHead>Compte</TableHead><TableHead>Remise %</TableHead><TableHead>Seuil validation €</TableHead><TableHead>Plafond encours €</TableHead><TableHead>Encours actuel €</TableHead><TableHead>Utilisation</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{accounts.map((a) => <AccountRow key={a.id} a={a} />)}</TableBody>
      </Table>
    </Section>
  );
}

function AccountRow({ a }: { a: { id: string; name: string; account_discount: number; approval_threshold: number; credit_limit: number; current_outstanding: number } }) {
  const run = useRpc();
  const [v, setV] = useState({ d: String(a.account_discount), t: String(a.approval_threshold), c: String(a.credit_limit), o: String(a.current_outstanding) });
  const pct = Math.round((Number(v.o) / Number(v.c || 1)) * 100);
  const f = (k: keyof typeof v) => <Input className="h-8 w-28 font-mono" type="number" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />;
  return (
    <TableRow>
      <TableCell className="text-sm">{a.name}</TableCell>
      <TableCell>{f("d")}</TableCell><TableCell>{f("t")}</TableCell><TableCell>{f("c")}</TableCell><TableCell>{f("o")}</TableCell>
      <TableCell><Pill tone={pct > 85 ? "danger" : pct > 60 ? "warn" : "ok"}>{pct} %</Pill></TableCell>
      <TableCell><Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("admin_update_account", { _id: a.id, _discount: Number(v.d), _threshold: Number(v.t), _credit: Number(v.c), _outstanding: Number(v.o) }), `${a.name} mis à jour`)}>Enregistrer</Button></TableCell>
    </TableRow>
  );
}

function Contracts() {
  const { contracts, accounts, products } = useSuspenseQuery(adminQuery).data;
  const run = useRpc();
  const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const [n, setN] = useState({ account: accounts[0]?.id ?? "", product: products[0]?.id ?? "", price: "", end: nextYear });
  const today = new Date().toISOString().slice(0, 10);
  const sel = "h-8 rounded border bg-background px-2 text-sm";
  return (
    <Section title="Prix contrat">
      <Table>
        <TableHeader><TableRow><TableHead>Compte</TableHead><TableHead>Produit</TableHead><TableHead className="text-right">Catalogue</TableHead><TableHead className="text-right">Prix contrat</TableHead><TableHead>Fin</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm">{c.account?.name}</TableCell>
              <TableCell className="text-sm"><span className="font-mono text-xs">{c.product?.sku}</span> {c.product?.name}</TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">{eur(Number(c.product?.catalog_price))}</TableCell>
              <TableCell className="text-right font-mono">{eur(Number(c.price))}</TableCell>
              <TableCell>{c.end_date < today ? <Pill>Expiré {c.end_date}</Pill> : <span className="font-mono text-xs">{c.end_date}</span>}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => run(() => supabase.rpc("admin_delete_contract_price", { _id: c.id }), "Prix contrat supprimé")}>Supprimer</Button></TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell><select aria-label="Compte" className={sel} value={n.account} onChange={(e) => setN({ ...n, account: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></TableCell>
            <TableCell><select aria-label="Produit" className={`${sel} max-w-64`} value={n.product} onChange={(e) => setN({ ...n, product: e.target.value })}>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></TableCell>
            <TableCell />
            <TableCell><Input aria-label="Prix" className="h-8 w-24 font-mono" type="number" step="0.01" placeholder="Prix" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} /></TableCell>
            <TableCell><Input aria-label="Date de fin" className="h-8 w-36" type="date" value={n.end} onChange={(e) => setN({ ...n, end: e.target.value })} /></TableCell>
            <TableCell className="text-right"><Button size="sm" disabled={!n.price} onClick={async () => { if (await run(() => supabase.rpc("admin_set_contract_price", { _account: n.account, _product: n.product, _price: Number(n.price), _end: n.end }), "Prix contrat enregistré")) setN({ ...n, price: "" }); }}>Ajouter</Button></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Section>
  );
}

type Quote = Awaited<ReturnType<NonNullable<typeof quotesQuery.queryFn>>>[number];

function QuotePricing({ quote }: { quote: Quote }) {
  const run = useRpc();
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(quote.quote_lines.map((l) => [l.product_id, String(l.product?.catalog_price ?? "")])),
  );
  const total = quote.quote_lines.reduce((s, l) => s + l.quantity * Number(prices[l.product_id] || 0), 0);
  return (
    <div className="space-y-2 p-4">
      <div className="text-sm"><span className="font-medium">{quote.account?.name}</span> <span className="font-mono text-xs text-muted-foreground">{dateFr(quote.created_at)}</span></div>
      {quote.quote_lines.map((l) => (
        <div key={l.product_id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-72"><span className="font-mono text-xs">{l.product?.sku}</span> {l.product?.name}</span>
          <span className="font-mono">{l.quantity} ×</span>
          <Input aria-label={`Prix ${l.product?.sku}`} className="h-8 w-28 font-mono" type="number" step="0.01" value={prices[l.product_id]} onChange={(e) => setPrices({ ...prices, [l.product_id]: e.target.value })} />
          <span className="text-xs text-muted-foreground">catalogue {eur(Number(l.product?.catalog_price))}</span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="font-mono">Total {eur(total)} HT</span>
        <Button size="sm" onClick={() => run(() => supabase.rpc("price_quote", { _quote: quote.id, _prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Number(v)])) }), "Devis chiffré, valable 30 jours")}>Chiffrer (valable 30 jours)</Button>
      </div>
    </div>
  );
}
