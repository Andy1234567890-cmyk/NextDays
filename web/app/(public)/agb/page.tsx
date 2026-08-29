// Öffentliche AGB-Seite (ohne Login erreichbar). Sprache folgt dem
// nd_locale-Cookie (next-intl); der Umschalter oben rechts wechselt sie.
// Für die Stripe-Custom-Genehmigung wichtig: §-Abschnitt „Zahlungsabwicklung
// durch Stripe" mit dem Stripe Connected Account Agreement.
import { getLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/legal-document";
import { loadAgb } from "@/content/legal";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const locale = (await getLocale()) as Locale;
  const doc = await loadAgb(locale);
  return { title: `${doc.title} — myNextDays` };
}

export default async function AgbPage() {
  const locale = (await getLocale()) as Locale;
  const doc = await loadAgb(locale);

  // Kopf- und Fusszeile stehen im Layout der (public)-Gruppe — hier nur der
  // Inhalt, sonst erschienen Logo und Sprachumschalter doppelt.
  return (
    <div className="px-6 py-10">
      <LegalDocument doc={doc} />
    </div>
  );
}
