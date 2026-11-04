import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/format";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos du projet — ProMaint Pro" },
      { name: "description", content: "La démarche Product Builder derrière ProMaint Pro : cadrage, règles de gestion, prototypage IA et recette." },
      { property: "og:title", content: "À propos du projet ProMaint Pro" },
      { property: "og:description", content: "Cadrage, règles de gestion, prototypage IA et recette d'un portail B2B fictif." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const STEPS = [
  {
    n: "1",
    title: "Cadrage",
    text: "Un document de cadrage décrit le besoin : un portail de commande B2B pour des pièces détachées et consommables de maintenance, ses utilisateurs (acheteur, valideur, administrateur ProMaint) et le périmètre : catalogue, prix négociés, panier, validation, devis, back-office.",
  },
  {
    n: "2",
    title: "Règles de gestion",
    text: "Chaque comportement métier est numéroté et testable : RG pour les règles (prix contrat, remise compte, paliers, lots, minimum de commande, franco, encours, seuil de validation, devis, cycle de vie) et CL pour les cas limites (double clic, échec ERP, référence arrêtée, devis expiré…).",
  },
  {
    n: "3",
    title: "Prototypage IA",
    text: "L'application a été construite par itérations courtes avec un assistant IA, en demandant une fonctionnalité à la fois et en citant les règles concernées. Les calculs sensibles (prix, frais, statut d'une commande) sont faits côté serveur ; l'interface ne fait que les afficher.",
  },
  {
    n: "4",
    title: "Recette",
    text: "Chaque règle de calcul est couverte par des tests automatisés (prix, frais, lots, délais, références habituelles, devis). Les parcours ont été rejoués dans le navigateur avec les profils de démonstration : commande validée, bloquée par l'encours, soumise au valideur, devis accepté, référence arrêtée, expédition simulée.",
  },
];

function About() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-primary">À propos du projet</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Une démarche Product Builder, du cadrage à la recette</h1>
          <p className="text-muted-foreground">{DISCLAIMER}</p>
        </header>

        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-md border bg-card p-4">
              <span className="grid h-10 w-10 place-items-center rounded bg-primary font-mono text-primary-foreground" aria-hidden="true">{s.n}</span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="space-y-3 rounded-md border bg-card p-4">
          <h2 className="font-semibold">Document de cadrage</h2>
          <p className="text-sm text-muted-foreground">Le brief d'origine, avec le besoin, les profils et la liste des règles de gestion.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href="/document-de-cadrage.md" target="_blank" rel="noopener">Lire le document de cadrage</a></Button>
            <Button asChild variant="outline"><a href="/document-de-cadrage.md" download="ProMaint-Pro-document-de-cadrage.md">Télécharger</a></Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Tester vous-même</h2>
          <p className="text-sm text-muted-foreground">Des profils de démonstration permettent de parcourir tout le portail en 2 minutes, sans créer de compte.</p>
          <Button asChild variant="outline"><Link to="/auth">Choisir un profil de démo</Link></Button>
        </section>
      </main>
    </>
  );
}
