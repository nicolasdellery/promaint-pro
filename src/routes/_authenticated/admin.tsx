import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/me";
import { dateFr, eur } from "@/lib/format";
import { Pill } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const adminQuery = queryOptions({
  queryKey: ["admin"],
  queryFn: async () => {
    const [e, a, r] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("account_requests").select("*").order("created_at", { ascending: false }),
    ]);
    return { events: e.data ?? [], accounts: a.data ?? [], requests: r.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Supervision — ProMaint Pro" }, { name: "description", content: "Supervision ProMaint." }] }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.role !== "admin") throw redirect({ to: "/catalogue" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  component: Admin,
});

const tone = { erp_error: "danger", alert: "warn", erp_attempt: "info", status_change: "neutral" } as const;

function Admin() {
  const { events, accounts, requests } = useSuspenseQuery(adminQuery).data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-2 lg:col-span-2">
        <h2 className="font-semibold">Comptes clients</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Compte</TableHead><TableHead className="text-right">Remise</TableHead><TableHead className="text-right">Seuil validation</TableHead><TableHead className="text-right">Encours</TableHead><TableHead className="text-right">Plafond</TableHead><TableHead className="text-right">Utilisation</TableHead></TableRow></TableHeader>
            <TableBody>
              {accounts.map((a) => {
                const pct = Math.round((Number(a.current_outstanding) / Number(a.credit_limit)) * 100);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="text-right font-mono">{Number(a.account_discount)} %</TableCell>
                    <TableCell className="text-right font-mono">{eur(Number(a.approval_threshold))}</TableCell>
                    <TableCell className="text-right font-mono">{eur(Number(a.current_outstanding))}</TableCell>
                    <TableCell className="text-right font-mono">{eur(Number(a.credit_limit))}</TableCell>
                    <TableCell className="text-right"><Pill tone={pct > 85 ? "danger" : pct > 60 ? "warn" : "ok"}>{pct} %</Pill></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Journal d'événements</h2>
        <div className="rounded-md border bg-card">
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
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Demandes d'ouverture de compte</h2>
        <div className="rounded-md border bg-card">
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
        </div>
      </section>
    </div>
  );
}
