import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — ProMaint Pro" },
      { name: "description", content: "Connectez-vous au portail de commande ProMaint Pro." },
      { property: "og:title", content: "Connexion ProMaint Pro" },
      { property: "og:description", content: "Accès client au catalogue et aux tarifs." },
    ],
  }),
  component: AuthPage,
});

const DEMO = [
  ["acheteur.horizon@promaint.demo", "Acheteur · Résidences Horizon (0 %)"],
  ["valideur.horizon@promaint.demo", "Valideur · Résidences Horizon"],
  ["acheteur.staubin@promaint.demo", "Acheteur · Clinique Saint-Aubin (8 %)"],
  ["valideur.staubin@promaint.demo", "Valideur · Clinique Saint-Aubin"],
  ["acheteur.ouest@promaint.demo", "Acheteur · Logistique Ouest (12 %)"],
  ["valideur.ouest@promaint.demo", "Valideur · Logistique Ouest"],
  ["admin@promaint.demo", "Admin ProMaint"],
];

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e?: React.FormEvent, em = email, pw = password) {
    e?.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    setBusy(false);
    if (error) { toast.error("Identifiants incorrects"); return; }
    nav({ to: "/catalogue" });
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid max-w-4xl gap-8 px-4 py-12 md:grid-cols-2">
        <form onSubmit={signIn} className="grid content-start gap-4 rounded-md border bg-card p-6">
          <h1 className="text-xl font-semibold">Connexion client</h1>
          <div className="grid gap-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="grid gap-1.5"><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" disabled={busy}>Se connecter</Button>
        </form>
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Comptes de démonstration</h2>
            <p className="text-xs text-muted-foreground">Mot de passe : <span className="font-mono">Demo1234!</span></p>
          </div>
          <ul className="divide-y">
            {DEMO.map(([em, label]) => (
              <li key={em}>
                <button type="button" disabled={busy} onClick={() => signIn(undefined, em, "Demo1234!")} className="flex w-full flex-col px-4 py-2 text-left hover:bg-accent">
                  <span className="text-sm">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{em}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
