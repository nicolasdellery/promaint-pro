import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dateFr, eur, QUOTE_STATUS } from "@/lib/format";
import { Pill } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const quotesQuery = queryOptions({
  queryKey: ["quotes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("quotes")
      .select("*, account:accounts(name), quote_lines(*, product:products(sku,name))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/devis")({
  head: () => ({ meta: [{ title: "Devis — ProMaint Pro" }, { name: "description", content: "Suivi des demandes de devis." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery),
  component: Devis,
});

function Devis() {
  const quotes = useSuspenseQuery(quotesQuery).data;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Devis</h1>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Compte</TableHead><TableHead>Articles</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Total HT</TableHead><TableHead>Valable jusqu'au</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Aucun devis.</TableCell></TableRow>}
            {quotes.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs">{dateFr(q.created_at)}</TableCell>
                <TableCell className="text-sm">{q.account?.name}</TableCell>
                <TableCell className="text-sm">{q.quote_lines.map((l) => `${l.quantity} × ${l.product?.sku}`).join(", ")}</TableCell>
                <TableCell><Pill tone={q.status === "priced" ? "info" : q.status === "accepted" ? "ok" : "neutral"}>{QUOTE_STATUS[q.status]}</Pill></TableCell>
                <TableCell className="text-right font-mono text-sm">{eur(q.total_ht as number | null)}</TableCell>
                <TableCell className="font-mono text-xs">{q.valid_until ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
