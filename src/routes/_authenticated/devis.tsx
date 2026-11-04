import { PageError, PageNotFound } from "@/components/PageState";
import { frError } from "@/lib/errors";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { dateFr, eur } from "@/lib/format";
import { quoteAcceptable } from "@/lib/pricing";
import { Pill } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const quotesQuery = queryOptions({
  queryKey: ["quotes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("quotes")
      .select("*, account:accounts(name), quote_lines(*, product:products(sku,name,status,catalog_price))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export function quoteState(q: { status: string; valid_until: string | null }) {
  if (q.status === "priced" && !quoteAcceptable(q)) return { label: "Expiré", tone: "neutral" as const };
  return ({
    requested: { label: "À chiffrer", tone: "warn" as const },
    priced: { label: "Chiffré", tone: "info" as const },
    accepted: { label: "Accepté", tone: "ok" as const },
    expired: { label: "Expiré", tone: "neutral" as const },
  } as const)[q.status as "requested"] ?? { label: q.status, tone: "neutral" as const };
}

export const Route = createFileRoute("/_authenticated/devis")({
  head: () => ({ meta: [{ title: "Devis — ProMaint Pro" }, { name: "description", content: "Suivi des demandes de devis." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery),
  component: Devis,
  errorComponent: PageError,
  notFoundComponent: PageNotFound,
});

function Devis() {
  const me = useMe();
  const quotes = useSuspenseQuery(quotesQuery).data;
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(id: string) {
    setBusy(id);
    const { data, error } = await supabase.rpc("accept_quote", { _quote: id });
    setBusy(null);
    await qc.invalidateQueries();
    if (error) { toast.error(frError(error)); return; }
    if (!data) { toast.error("Devis expiré : il ne peut plus être accepté."); return; }
    toast.success("Devis accepté : la commande est créée aux prix du devis.");
    nav({ to: "/commandes" });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Devis</h1>
        <p className="text-sm text-muted-foreground">Devis chiffrés par ProMaint, valables 30 jours. Un devis accepté devient une commande aux prix du devis.</p>
      </div>
      {quotes.length === 0 && <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Aucun devis.</div>}
      <div className="space-y-3">
        {quotes.map((q) => {
          const s = quoteState(q);
          const canAccept = me.role !== "admin" && quoteAcceptable(q);
          return (
            <div key={q.id} className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><Pill tone={s.tone}>{s.label}</Pill><span className="font-mono text-xs text-muted-foreground">{dateFr(q.created_at)}</span></div>
                  {me.role === "admin" && <div className="mt-1 text-xs text-muted-foreground">{q.account?.name}</div>}
                  <div className="mt-1 text-sm">
                    {q.total_ht != null ? <span className="font-mono text-lg">{eur(Number(q.total_ht))} HT</span> : <span className="text-muted-foreground">En attente de chiffrage</span>}
                    {q.valid_until && <span className="ml-2 text-xs text-muted-foreground">valable jusqu'au {new Date(q.valid_until).toLocaleDateString("fr-FR")}</span>}
                  </div>
                </div>
                {canAccept && <Button disabled={busy === q.id} onClick={() => accept(q.id)}>Accepter le devis</Button>}
              </div>
              <ul className="mt-3 divide-y text-sm">
                {q.quote_lines.map((l) => (
                  <li key={l.product_id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                    <span>
                      <span className="font-mono text-xs">{l.product?.sku}</span> {l.product?.name}
                      {l.product?.status === "discontinued" && <span className="ml-2"><Pill tone="danger">Référence arrêtée</Pill></span>}
                    </span>
                    <span className="font-mono">{l.quantity} × {l.unit_price != null ? eur(Number(l.unit_price)) : "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
