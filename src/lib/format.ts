export const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));

export const dateFr = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "—";

export const ORDER_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warn" | "danger" | "ok" }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  pending_approval: { label: "En attente de validation", tone: "warn" },
  blocked_credit: { label: "Bloquée — encours", tone: "danger" },
  validated: { label: "Validée", tone: "info" },
  sent_to_erp: { label: "Envoyée ERP", tone: "info" },
  in_preparation: { label: "En préparation", tone: "info" },
  shipped: { label: "Expédiée", tone: "ok" },
  delivered: { label: "Livrée", tone: "ok" },
  cancelled: { label: "Annulée", tone: "neutral" },
};

export const QUOTE_STATUS: Record<string, string> = {
  requested: "Demandé",
  priced: "Chiffré",
  accepted: "Accepté",
  expired: "Expiré",
};

export const PRICE_ORIGIN: Record<string, string> = {
  contract: "Prix contrat",
  tier: "Remise quantité",
  account_discount: "Remise compte",
  catalog: "Prix catalogue",
};

export const ROLE_LABEL: Record<string, string> = {
  buyer: "Acheteur",
  approver: "Valideur",
  admin: "Admin ProMaint",
};

export const DISCLAIMER =
  "Projet fictif réalisé par Nicolas Dellery — démonstration de démarche Product Builder. Aucune donnée réelle.";
