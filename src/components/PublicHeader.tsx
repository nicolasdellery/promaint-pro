import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-xs text-primary-foreground">PM</span>
      <span>ProMaint <span className="text-primary">Pro</span></span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/demande-compte">Demander un compte</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Se connecter</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
