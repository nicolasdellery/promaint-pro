import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { DISCLAIMER } from "@/lib/format";
import { ShieldCheck, Tags, Truck, Workflow } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProMaint Pro — Pièces et consommables de maintenance pour pros" },
      { name: "description", content: "Commandez filtres CVC, courroies, éclairage, sanitaire, électricité et visserie à vos conditions négociées." },
      { property: "og:title", content: "ProMaint Pro — Portail de commande B2B" },
      { property: "og:description", content: "Vos prix contrat, circuits de validation et suivi de commandes en un seul portail." },
    ],
  }),
  component: Index,
});

const families = ["Filtres CVC", "Courroies", "Éclairage", "Sanitaire", "Électricité", "Visserie"];
const features = [
  { icon: Tags, t: "Vos prix, toujours", d: "Prix contrat, remises quantité et remise compte appliqués automatiquement." },
  { icon: Workflow, t: "Validation intégrée", d: "Les commandes au-delà du seuil partent chez votre valideur." },
  { icon: ShieldCheck, t: "Encours maîtrisé", d: "Contrôle du plafond de crédit avant chaque envoi." },
  { icon: Truck, t: "Suivi jusqu'à livraison", d: "Statut ERP, préparation, expédition et n° de suivi." },
];

function Index() {
  return (
    <>
      <PublicHeader />
      <div className="border-b bg-warning/15 px-4 py-2 text-center text-sm text-warning-foreground">{DISCLAIMER}</div>
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary">Distributeur maintenance · B2B</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Le portail de commande de vos pièces de maintenance.
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Catalogue et tarifs réservés aux clients connectés. Vos conditions négociées s'appliquent ligne par ligne.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Accéder au portail</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/demande-compte">Demander l'ouverture d'un compte</Link></Button>
            </div>
          </div>
          <div className="rounded-md border bg-background">
            <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">6 familles · 60 références</div>
            <ul className="divide-y">
              {families.map((f, i) => (
                <li key={f}>
                  <Link to="/auth" className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                    <span>{f}</span>
                    <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, t, d }) => (
          <div key={t} className="p-4">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-medium">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
