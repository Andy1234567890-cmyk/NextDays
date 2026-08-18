// Platzhalter-Abschnitt für Konto-Bereiche ohne Backend (Datenschutz, Steuern,
// Benachrichtigungen …). Zeigt ehrlich „In Vorbereitung" statt erfundener
// Felder (Wurzel 5) — die Sidebar bleibt vollständig wie bei Airbnb, aber es
// werden keine Fake-Daten vorgetäuscht.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

export async function VorbereitungAbschnitt({ titelKey }: { titelKey: string }) {
  const t = await getTranslations("konto");

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t(titelKey)}
      </h1>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Icon
            icon="ph:hammer"
            className="size-6 text-muted-foreground"
          />
        </span>
        <div>
          <p className="font-semibold">{t("inVorbereitungTitel")}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t("inVorbereitungText")}
          </p>
        </div>
      </div>
    </section>
  );
}
