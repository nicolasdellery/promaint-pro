import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, useMe } from "@/lib/me";
import { useCart } from "@/lib/cart";
import { eur, ROLE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LogOut, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: Layout,
});

function Layout() {
  const me = useMe();
  const cartLines = useCart();
  const qc = useQueryClient();
  const nav = useNavigate();
  const isAdmin = me.role === "admin";
  const acc = me.account;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const link = "rounded px-3 py-1.5 text-sm text-header-foreground/80 hover:bg-header-foreground/10 hover:text-header-foreground";
  const active = { className: "bg-header-foreground/15 text-header-foreground" };

  return (
    <div>
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-3 px-4 sm:flex-nowrap sm:gap-6">
          <Link to="/catalogue" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary font-mono text-[10px]">PM</span>
            <span className="hidden sm:inline">ProMaint Pro</span>
          </Link>
          <nav aria-label="Navigation principale" className="order-last -mx-1 flex w-full min-w-0 gap-1 overflow-x-auto whitespace-nowrap px-1 pb-1.5 sm:order-none sm:w-auto sm:pb-0">
            <Link to="/catalogue" className={link} activeProps={active}>Catalogue</Link>
            <Link to="/commandes" className={link} activeProps={active}>{isAdmin ? "Commandes" : "Mes commandes"}</Link>
            {!isAdmin && <Link to="/references" className={link} activeProps={active}>Références habituelles</Link>}
            {(me.role === "approver" || isAdmin) && <Link to="/validation" className={link} activeProps={active}>Validation</Link>}
            <Link to="/devis" className={link} activeProps={active}>Devis</Link>
            {isAdmin && <Link to="/admin" className={link} activeProps={active}>Back-office</Link>}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            {!isAdmin && (
              <Link to="/panier" className={link} activeProps={active}>
                <span className="flex items-center gap-1.5" aria-label={`Panier : ${cartLines.length} article${cartLines.length > 1 ? "s" : ""}`}><ShoppingCart className="h-4 w-4" aria-hidden="true" />{cartLines.length}</span>
              </Link>
            )}
            <div className="hidden text-right leading-tight md:block">
              <div>{me.full_name}</div>
              <div className="text-xs text-header-foreground/75">{ROLE_LABEL[me.role]}{acc ? ` · ${acc.name}` : ""}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Se déconnecter" className="text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
              <LogOut />
            </Button>
          </div>
        </div>
        {acc && (
          <div className="border-t border-header-foreground/10">
            <div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-0.5 px-4 py-1.5 font-mono text-xs text-header-foreground/85">
              <span className="font-sans md:hidden">{me.full_name} · {ROLE_LABEL[me.role]}</span>
              <span>Remise compte {Number(acc.account_discount)} %</span>
              <span>Seuil validation {eur(acc.approval_threshold)}</span>
              <span>Encours {eur(acc.current_outstanding)} / {eur(acc.credit_limit)}</span>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
