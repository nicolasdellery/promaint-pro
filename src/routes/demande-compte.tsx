import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/demande-compte")({
  head: () => ({
    meta: [
      { title: "Demande d'ouverture de compte — ProMaint Pro" },
      { name: "description", content: "Demandez l'ouverture d'un compte professionnel ProMaint Pro." },
      { property: "og:title", content: "Ouvrir un compte ProMaint Pro" },
      { property: "og:description", content: "Formulaire de demande d'ouverture de compte client B2B." },
    ],
  }),
  component: Page,
});

const schema = z.object({
  company: z.string().trim().min(1, "Raison sociale requise").max(200),
  siret: z.string().trim().max(20).optional(),
  contact_name: z.string().trim().min(1, "Nom requis").max(120),
  email: z.string().trim().email("E-mail invalide").max(255),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().max(2000).optional(),
});

function Page() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = schema.safeParse(fd);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide"); return; }
    setBusy(true);
    const v = parsed.data;
    const { error } = await supabase.from("account_requests").insert({
      company: v.company, contact_name: v.contact_name, email: v.email,
      siret: v.siret || null, phone: v.phone || null, message: v.message || null,
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible, réessayez."); return; }
    setSent(true);
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Demande d'ouverture de compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">Un commercial vous recontacte sous 48 h ouvrées.</p>
        {sent ? (
          <div className="mt-8 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
            <p className="font-medium">Merci, votre demande a bien été enregistrée.</p>
            <p className="mt-1 text-muted-foreground">Elle est désormais visible par l'équipe ProMaint dans l'espace de supervision.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 grid gap-4 rounded-md border bg-card p-6">
            <div className="grid gap-1.5"><Label htmlFor="company">Raison sociale *</Label><Input id="company" name="company" required maxLength={200} /></div>
            <div className="grid gap-1.5"><Label htmlFor="siret">SIRET</Label><Input id="siret" name="siret" maxLength={20} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="contact_name">Contact *</Label><Input id="contact_name" name="contact_name" required maxLength={120} /></div>
              <div className="grid gap-1.5"><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" maxLength={30} /></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="email">E-mail professionnel *</Label><Input id="email" name="email" type="email" required maxLength={255} /></div>
            <div className="grid gap-1.5"><Label htmlFor="message">Besoins</Label><Textarea id="message" name="message" maxLength={2000} rows={4} /></div>
            <Button type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande"}</Button>
            <p className="text-center text-xs text-muted-foreground">Démonstration : n'indiquez pas de données réelles.</p>
          </form>
        )}
      </main>
    </>
  );
}
