import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { dateFr, eur, PRICE_ORIGIN } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, account:accounts(name), creator:users!orders_created_by_fkey(full_name), order_lines(*, product:products(sku,name))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/commandes")({
  head: () => ({ meta: [{ title: "Commandes — ProMaint Pro" }, { name: "description", content: "Suivi des commandes." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery),
  component: Commandes,
});

function Commandes() {
  const me = useMe();
  const orders = useSuspenseQuery(ordersQuery).data;
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const canApprove = me.role === "approver" || me.role === "admin";

  async function decide(id: string, approve: boolean) {
    const { error } = await supabase.rpc("approve_order", { _order: id, _approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Commande validée" : "Commande refusée");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Commandes</h1>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              {me.role === "admin" && <TableHead>Compte</TableHead>}
              <TableHead>Créée par</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total HT</TableHead>
              <TableHead className="text-right">Frais</TableHead>
              <TableHead>ERP / Suivi</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Aucune commande.</TableCell></TableRow>
            )}
            {orders.map((o) => (
              <Fragment key={o.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === o.id ? null : o.id)}>
                  <TableCell>{open === o.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{dateFr(o.created_at)}</TableCell>
                  {me.role === "admin" && <TableCell className="text-sm">{o.account?.name}</TableCell>}
                  <TableCell className="text-sm">{o.creator?.full_name}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right font-mono text-sm">{eur(Number(o.total_ht))}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{eur(Number(o.processing_fee) + Number(o.shipping_fee))}</TableCell>
                  <TableCell className="font-mono text-xs">{o.erp_reference ?? "—"}{o.tracking_number ? ` · ${o.tracking_number}` : ""}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canApprove && o.status === "pending_approval" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => decide(o.id, true)}>Valider</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(o.id, false)}>Refuser</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {open === o.id && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell />
                    <TableCell colSpan={8}>
                      <table className="w-full text-sm">
                        <tbody>
                          {o.order_lines.map((l) => (
                            <tr key={l.id} className="border-b last:border-0">
                              <td className="py-1 font-mono text-xs">{l.product?.sku}</td>
                              <td className="py-1">{l.product?.name}</td>
                              <td className="py-1 text-right font-mono">{l.quantity} × {eur(Number(l.unit_price_applied))}</td>
                              <td className="py-1 pl-4 text-xs text-muted-foreground">{PRICE_ORIGIN[l.price_origin]}</td>
                              <td className="py-1 text-right font-mono">{eur(l.quantity * Number(l.unit_price_applied))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-muted-foreground">
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
