// Turns technical backend/network errors into clear French messages for users.
// Business errors raised by the database are already written in French and are kept as is.
export function frError(e: unknown): string {
  const msg = (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e ?? "")).trim();
  const m = msg.toLowerCase();
  if (!msg) return "Une erreur inattendue est survenue. Réessayez.";
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed")) return "Connexion impossible. Vérifiez votre réseau puis réessayez.";
  if (m.includes("jwt") || m.includes("not authenticated") || m.includes("session")) return "Votre session a expiré. Reconnectez-vous.";
  if (m.includes("permission denied") || m.includes("row-level security") || m.includes("violates row")) return "Vous n'avez pas les droits pour cette action.";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("duplicate key")) return "Cet élément existe déjà.";
  if (m.includes("invalid input syntax") || m.includes("violates check")) return "Valeur saisie invalide.";
  if (m.includes("timeout")) return "Le serveur met trop de temps à répondre. Réessayez.";
  if (/^[\x00-\x7F]*$/.test(msg) && !/[àâçéèêëîïôûùüÿ]/i.test(msg) && /\b(the|is|not|of|error|failed)\b/i.test(msg)) return "Une erreur technique est survenue. Réessayez dans un instant.";
  return msg;
}
