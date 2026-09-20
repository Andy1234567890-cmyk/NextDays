// Die Fläche, die ein Partner sieht, solange das Dashboard gesperrt ist (0727).
//
// Warum eine eigene Seite statt eines Bandes über dem Dashboard: Wenn die
// Datenrouten 403 antworten, sind Kunden, Provisionen und Auszahlungen leer —
// eine Navigation, deren Punkte alle ins Nichts führen, sieht nach Defekt aus
// und erzeugt genau die Rückfragen, die dieser Hinweis vermeiden soll.
//
// Warum er angemeldet bleibt: Seine Anmeldung ist gültig, nur der Bereich ist
// zu. Ihn auf /anmelden zu werfen wäre eine Lüge und würde ihn dort in eine
// Schleife schicken — das Layout leitet ohne Sitzung wieder dorthin zurück.
//
// Was hier ausdrücklich NICHT steht: eine Begründung oder ein Datum, das
// niemand zugesagt hat (Wurzel 4). Was der Betreiber sagen will, steht in
// `portal_hinweis`; fehlt es, bleibt der übersetzte Standardsatz.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

export async function PortalGesperrt({ hinweis }: { hinweis: string | null }) {
  const t = await getTranslations("gesperrt");

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <Icon
          icon="ph:lock-key"
          className="mx-auto size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="text-base font-medium">{t("titel")}</h1>
        <p className="text-sm text-muted-foreground">{hinweis || t("text")}</p>
      </div>
    </div>
  );
}
