import { useRouter, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { frError } from "@/lib/errors";

export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement…
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-md border bg-card p-6 text-center">
      <h2 className="font-semibold">Cette page n'a pas pu s'afficher</h2>
      <p className="text-sm text-muted-foreground">{frError(error)}</p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => router.invalidate()}>Réessayer</Button>
        <Button variant="outline" asChild><Link to="/">Accueil</Link></Button>
      </div>
    </div>
  );
}

export function PageNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-md border bg-card p-6 text-center">
      <h2 className="font-semibold">Page introuvable</h2>
      <p className="text-sm text-muted-foreground">Le lien est peut-être incorrect ou la page n'existe plus.</p>
      <Button variant="outline" asChild><Link to="/">Retour à l'accueil</Link></Button>
    </div>
  );
}
