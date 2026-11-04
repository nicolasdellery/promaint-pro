import { frError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { dateFr, eur } from "@/lib/format";
import { ordersQuery } from "./commandes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/validation")({
  head: () => ({ meta: [{ title: "Espace valideur — ProMaint Pro" }, { name: "description", content: "Commandes en attente de validation." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery),
  component: Validation,
  errorComponent: ({ error }) => <div role="alert">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div>Introuvable.</div>,
});

function Validation() {
  const me = useMe();
  const qc = useQueryClient();
  const pending = useSuspenseQuery(ordersQuery).data.filter((o) => o.status === "pending_approval");
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (me.role !== "approver" && me.role !== "admin")
    return <p className="text-sm text-muted-foreground">Espace réservé aux valideurs.</p>;

  async function decide(id: string, approve: boolean, motif?: string) {
    setBusy(true);
    const { error } = await supabase.rpc("decide_order", { _order: id, _approve: approve, ...(motif ? { _reason: motif } : {}) });
    setBusy(false);
    if (error) { toast.error(frError(error)); return; }
    if (approve) {
      const { data } = await supabase.from("orders").select("status, erp_reference").eq("id", id).maybeSingle();
      if (data?.status === "sent_to_erp") toast.success(`Commande validée et transmise à l'ERP (${data.erp_reference})`);
      else if (data?.status === "blocked_credit") toast.error("Validation impossible : plafond d'encours dépassé. Admin alerté.");
      else toast.warning("Commande validée — transmission ERP en échec, l'administrateur est alerté.");
    } else toast.success("Commande refusée");
    setRefusing(null);
    setReason("");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Espace valideur</h1>
      <p className="text-sm text-muted-foreground">{pending.length} commande{pending.length > 1 ? "s" : ""} à valider</p>
      {pending.length === 0 && <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Aucune commande en attente.</div>}
      <div className="space-y-3">
        {pending.map((o) => (
          <div key={o.id} className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{o.creator?.full_name} · <span className="font-mono text-xs text-muted-foreground">{dateFr(o.created_at)}</span></div>
                {me.role === "admin" && <div className="text-xs text-muted-foreground">{o.account?.name}</div>}
                <div className="mt-1 font-mono text-lg">{eur(Number(o.total_ht))} HT</div>
              </div>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => decide(o.id, true)}>Valider</Button>
                <Button disabled={busy} variant="outline" onClick={() => setRefusing(o.id)}>Refuser</Button>
              </div>
            </div>
            <ul className="mt-3 divide-y text-sm">
              {o.order_lines.map((l) => (
                <li key={l.id} className="flex justify-between py-1">
                  <span><span className="font-mono text-xs">{l.product?.sku}</span> {l.product?.name}</span>
                  <span className="font-mono">{l.quantity} × {eur(Number(l.unit_price_applied))}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Dialog open={!!refusing} onOpenChange={(v) => !v && setRefusing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : budget du trimestre dépassé" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusing(null)}>Annuler</Button>
            <Button disabled={busy || reason.trim().length < 3} onClick={() => refusing && decide(refusing, false, reason)}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
