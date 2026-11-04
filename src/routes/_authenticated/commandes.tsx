import { frError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { dateFr, eur, PRICE_ORIGIN } from "@/lib/format";
import { Pill, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { catalogQuery } from "@/lib/catalog";

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, account:accounts(name), creator:users!orders_created_by_fkey(full_name), order_lines(*, product:products(sku,name,status,family))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

// RG-15 lifecycle
const CYCLE = [
  ["draft", "Brouillon"],
  ["pending_approval", "En attente de validation"],
  ["validated", "Validée"],
  ["sent_to_erp", "Transmise ERP"],
  ["in_preparation", "En préparation"],
  ["shipped", "Expédiée"],
  ["delivered", "Livrée"],
] as const;
const CANCELLABLE = ["draft", "pending_approval", "blocked_credit", "validated", "sent_to_erp"];

export const Route = createFileRoute("/_authenticated/commandes")({
  head: () => ({ meta: [{ title: "Mes commandes — ProMaint Pro" }, { name: "description", content: "Suivi du statut de vos commandes." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery),
  component: Commandes,
  errorComponent: ({ error }) => <div role="alert">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div>Introuvable.</div>,
});

function OrderStatus({ status, attempts, admin, blocked }: { status: string; attempts: number; admin: boolean; blocked: string | null }) {
  if (status === "validated" && blocked) return <Pill tone="danger">Bloquée — référence arrêtée</Pill>;
  // CL-08: while ERP transmission is failing, the client only sees "En cours de transmission"
  if (status === "validated" && attempts > 0) {
    return admin ? <Pill tone="warn">Validée · ERP {attempts}/3 échec{attempts > 1 ? "s" : ""}</Pill> : <Pill tone="info">En cours de transmission</Pill>;
  }
  return <StatusBadge status={status} />;
}

function Stepper({ status }: { status: string }) {
  const idx = CYCLE.findIndex(([s]) => s === status);
  if (idx < 0) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {CYCLE.map(([s, label], i) => (
        <li key={s} className="flex items-center gap-1">
          <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5", i < idx && "text-success", i === idx && "bg-primary text-primary-foreground", i > idx && "text-muted-foreground")}>
            {i < idx && <Check className="h-3 w-3" />}{label}
          </span>
          {i < CYCLE.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function Commandes() {
  const me = useMe();
  const orders = useSuspenseQuery(ordersQuery).data;
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const isAdmin = me.role === "admin";

  async function cancel(id: string) {
    if (!confirm("Annuler cette commande ?")) return;
    const { error } = await supabase.rpc("cancel_order", { _order: id });
    if (error) { toast.error(frError(error)); return; }
    toast.success("Commande annulée");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{isAdmin ? "Commandes" : "Mes commandes"}</h1>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              {isAdmin && <TableHead>Compte</TableHead>}
              <TableHead>Créée par</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total HT</TableHead>
              <TableHead>Réf. ERP / Suivi</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Aucune commande.</TableCell></TableRow>
            )}
            {orders.map((o) => (
              <Fragment key={o.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === o.id ? null : o.id)}>
                  <TableCell>{open === o.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{dateFr(o.created_at)}</TableCell>
                  {isAdmin && <TableCell className="text-sm">{o.account?.name}</TableCell>}
                  <TableCell className="text-sm">{o.creator?.full_name}</TableCell>
                  <TableCell><OrderStatus status={o.status} attempts={o.erp_attempts} admin={isAdmin} blocked={o.erp_blocked_reason} /></TableCell>
                  <TableCell className="text-right font-mono text-sm">{eur(Number(o.total_ht))}</TableCell>
                  <TableCell className="font-mono text-xs">{o.erp_reference ?? "—"}{o.tracking_number ? ` · ${o.tracking_number}` : ""}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {o.status === "cancelled" ? null : CANCELLABLE.includes(o.status) ? (
                      <Button size="sm" variant="outline" onClick={() => cancel(o.id)}>Annuler</Button>
                    ) : (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`mailto:service-client@promaint.example?subject=Commande ${o.erp_reference ?? o.id}`}>Contacter le service client</a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {open === o.id && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell />
                    <TableCell colSpan={7} className="space-y-3">
                      <Stepper status={o.status} />
                      {o.erp_blocked_reason && o.status === "validated" && <p className="text-sm text-destructive">Transmission ERP bloquée jusqu'au remplacement de la référence arrêtée.</p>}
                      {o.rejection_reason && <p className="text-sm text-destructive">Refusée — motif : {o.rejection_reason}</p>}
                      <table className="w-full text-sm">
                        <tbody>
                          {o.order_lines.map((l) => (
                            <tr key={l.id} className="border-b last:border-0">
                              <td className="py-1 font-mono text-xs">{l.product?.sku}</td>
                              <td className="py-1">
                                {l.product?.name}
                                {l.product?.status === "discontinued" && (
                                  <span className="ml-2 inline-flex items-center gap-2">
                                    <Pill tone="danger">Référence arrêtée</Pill>
                                    {o.status === "validated" && <ReplaceLine lineId={l.id} family={l.product.family} />}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 text-right font-mono">{l.quantity} × {eur(Number(l.unit_price_applied))}</td>
                              <td className="py-1 pl-4 text-xs text-muted-foreground">{PRICE_ORIGIN[l.price_origin]}</td>
                              <td className="py-1 text-right font-mono">{eur(l.quantity * Number(l.unit_price_applied))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-muted-foreground">
                        Frais de traitement {eur(Number(o.processing_fee))} · Port {eur(Number(o.shipping_fee))} · Livraison partielle {o.partial_delivery_allowed ? "oui" : "non"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReplaceLine({ lineId, family }: { lineId: string; family: string }) {
  const { products } = useSuspenseQuery(catalogQuery).data;
  const qc = useQueryClient();
  const options = products.filter((p) => p.family === family && p.status === "active");
  return (
    <select
      aria-label="Remplacer par"
      className="h-7 rounded border bg-background px-1 text-xs"
      defaultValue=""
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        if (!e.target.value) return;
        const { error } = await supabase.rpc("replace_order_line", { _line: lineId, _product: e.target.value });
        if (error) { toast.error(frError(error)); return; }
        toast.success("Référence remplacée — transmission ERP relancée");
        qc.invalidateQueries();
      }}
    >
      <option value="">Remplacer par…</option>
      {options.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
    </select>
  );
}
