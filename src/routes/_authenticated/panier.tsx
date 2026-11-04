import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/panier")({
  head: () => ({ meta: [{ title: "Panier — ProMaint Pro" }, { name: "description", content: "Votre panier de commande." }] }),
  component: Panier,
});

function Panier() {
  const lines = useCart();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("place_order", {
      _lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      _partial: partial,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    cart.clear();
    await qc.invalidateQueries();
    toast.success("Commande enregistrée");
    nav({ to: "/commandes" });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Panier</h1>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
      ) : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Réf.</TableHead><TableHead>Désignation</TableHead><TableHead className="w-40">Quantité</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.product_id}>
                    <TableCell className="font-mono text-xs">{l.sku}</TableCell>
                    <TableCell>{l.name}{l.pack_size > 1 && <span className="ml-2 text-xs text-muted-foreground">lot de {l.pack_size}</span>}</TableCell>
                    <TableCell>
                      <Input type="number" min={l.pack_size} step={l.pack_size} value={l.quantity} className="h-8 w-24 font-mono"
                        onChange={(e) => cart.setQty(l.product_id, Number(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => cart.setQty(l.product_id, 0)}>Retirer</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-card p-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={partial} onCheckedChange={(v) => setPartial(!!v)} /> Livraison partielle acceptée
            </label>
            <div className="text-right text-xs text-muted-foreground">
              Prix appliqués et frais calculés à la validation.{" "}
              {me.role === "buyer" && <>Au-delà de {Number(me.account?.approval_threshold)} € HT, la commande part en validation.</>}
            </div>
            <Button onClick={submit} disabled={busy}>{busy ? "Envoi…" : "Passer la commande"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
