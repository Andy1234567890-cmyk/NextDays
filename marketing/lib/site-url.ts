// Die öffentliche Adresse DIESER Seite — Grundlage für Sitemap, robots.txt,
// llms.txt und kanonische Links.
//
// Warum nicht `ANBIETER.websiteUrl` direkt: Das ist die Adresse, die im
// Impressum steht (eine Rechtsangabe, `www.mynextdays.com`). Sie ist hier zwar
// der richtige Vorgabewert, aber Sitemap und robots.txt müssen auf der Domain
// stehen, unter der die Seite TATSÄCHLICH ausgeliefert wird — auf Staging ist
// das eine andere. Eine Sitemap, die von Staging aus Produktions-URLs meldet,
// lässt Google die falschen Seiten crawlen.
//
// Deshalb: Umgebungsvariable mit dem Impressumswert als Vorgabe. Das ist KEIN
// erfundener Fallback (Wurzel 4) — es ist derselbe Wert aus derselben Quelle,
// nur überschreibbar.
import { ANBIETER } from "@/content/legal/anbieter";

/**
 * Basis-URL ohne abschließenden Schrägstrich, z. B. `https://www.mynextdays.com`.
 *
 * In Coolify als `NEXT_PUBLIC_SITE_URL` setzen, wenn die Auslieferungsdomain
 * von der Impressumsadresse abweicht (Staging, Vorschau-Deploys).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? ANBIETER.websiteUrl
).replace(/\/$/, "");

/** Absolute URL zu einem Pfad dieser Seite. */
export function siteUrl(pfad: string): string {
  return `${SITE_URL}/${pfad.replace(/^\//, "")}`;
}
