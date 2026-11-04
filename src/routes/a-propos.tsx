import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/format";

const CADRAGE_URL = "https://claude.ai/artifact/FLmQAnv3TJ2geJZv4x5num#22b5214f-2829";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos du projet — ProMaint Pro" },
      { name: "description", content: "Le problème, le choix du MVP, la méthode et les règles de gestion clés derrière ProMaint Pro, portail B2B fictif." },
      { property: "og:title", content: "À propos du projet ProMaint Pro" },
      { property: "og:description", content: "Problème, périmètre du MVP, méthode et règles de gestion clés d'un portail B2B fictif." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const RULES = [
  {
    code: "RG-03",
    title: "Le prix contrat prime",
    text: "Si un prix contrat valide existe pour ce compte et ce produit, il s'applique. Sinon, prix catalogue × (1 − remise compte).",
  },
  {
    code: "RG-04",
    title: "La meilleure remise, jamais les deux",
    text: "Entre une remise par palier de quantité et la remise compte, on garde la plus avantageuse. Les deux ne se cumulent jamais.",
  },
  {
    code: "RG-08",
    title: "Validation au-delà du seuil",
    text: "Au-dessus du seuil de validation du compte, la commande part chez le valideur au lieu d'être validée seule.",
  },
  {
    code: "RG-09",
    title: "Blocage sur encours",
    text: "Si l'encours actuel ajouté à la commande dépasse le plafond du compte, la commande est bloquée et l'administrateur est alerté.",
  },
  {
    code: "CL-02",
    title: "L'encours prime sur la validation",
    text: "Le contrôle de plafond passe avant la recherche d'un valideur : une commande hors encours n'est jamais proposée à validation.",
  },
  {
    code: "CL-08",
    title: "Une panne ERP ne fait perdre aucune commande",
    text: "Si la transmission échoue, la commande reste validée, est réessayée trois fois, puis l'administrateur est alerté.",
  },
];

function About() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-primary">À propos du projet</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Du problème aux règles, puis au portail</h1>
          <p className="text-sm text-muted-foreground">{DISCLAIMER}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Le problème</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Un distributeur B2B de pièces et consommables de maintenance reçoit ses commandes par e-mail, par téléphone
            et par PDF. Quelqu'un les ressaisit à la main dans l'ERP. Les références se trompent, les quantités et les
            prix négociés aussi, et personne ne sait où en est une commande une fois envoyée. Le portail remplace cette
            ressaisie : le client commande directement à ses conditions, la commande entre dans l'ERP sans frappe humaine.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Le choix du MVP</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Une recommande rapide, aux prix contrat du client, avec paiement sur facture à 30 jours. Pas de paiement par
            carte, pas de marketplace, pas de catalogue multi-fournisseurs. Le périmètre tient en cinq blocs : catalogue
            et prix négociés, panier et frais, circuit de validation, devis, suivi de commande jusqu'à la livraison.
            Tout le reste est volontairement hors du premier livrable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. La méthode</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Les règles de gestion et les cas limites ont été écrits avant le code, et numérotés : RG pour les règles de
            métier, CL pour les cas limites. Le prototype a ensuite été construit avec l'IA (Lovable), une
            fonctionnalité à la fois, en citant les règles concernées. Les calculs sensibles — prix, frais, statut d'une
            commande — sont exécutés côté serveur, l'interface ne fait que les afficher. Chaque étape a été recettée
            scénario par scénario : commande validée, commande bloquée par l'encours, commande soumise au valideur, devis
            accepté, référence arrêtée, panne de transmission ERP.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Les règles clés</h2>
          <ul className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
            {RULES.map((r) => (
              <li key={r.code} className="bg-card p-4">
                <span className="font-mono text-xs text-primary">{r.code}</span>
                <h3 className="mt-1 font-medium">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-md border bg-card p-4">
          <h2 className="font-semibold">5. Voir la démonstration</h2>
          <p className="text-sm text-muted-foreground">
            Des profils de démonstration permettent de parcourir tout le portail en deux minutes, sans créer de compte.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link to="/auth">Tester le portail</Link></Button>
            <Button asChild variant="outline">
              <a href={CADRAGE_URL} target="_blank" rel="noopener noreferrer">Lire le document de cadrage</a>
            </Button>
          </div>
        </section>

        <p className="border-t pt-4 text-sm text-muted-foreground">
          Projet conçu et prototypé par <span className="font-medium text-foreground">Nicolas Dellery</span>.
        </p>
      </main>
    </>
  );
}
