// Die Fläche, die ein Eigentümer sieht, solange das Portal gesperrt ist (0726).
//
// Warum eine eigene Seite und nicht ein Band über dem Portal: Wenn der Zugriff
// weg ist, sind auch die Inhalte weg — eine Navigation, deren Punkte alle in
// einen 403 laufen, sieht nach Defekt aus und erzeugt genau die Anrufe, die
// dieser Hinweis vermeiden soll.
//
// Warum er angemeldet bleibt und nicht auf /login oder / geworfen wird: Auf „/"
// steht das Rollen-Gate des Agentur-Dashboards, das ihn sofort wieder hierher
// schickt — zwei Guards, die sich gegenseitig wegschieben, ergeben eine
// Endlosschleife. Und abmelden wäre eine Lüge: seine Anmeldung ist gültig, nur
// der Bereich ist zu.
//
// Der Text kommt bevorzugt vom Betreiber (`eigentuemer_portal_hinweis`). Fehlt
// er, steht hier der übersetzte Standardsatz — keine erfundene Begründung und
// kein Datum, das niemand zugesagt hat (Wurzel 4).
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

export async function PortalGesperrt({ hinweis }: { hinweis: string | null }) {
  const t = await getTranslations("portal.gesperrt");

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
