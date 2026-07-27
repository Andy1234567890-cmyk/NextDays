"use client";

// Abschnitt „Steuern" der Kontoeinstellungen (Airbnb-Vorbild).
// Zwei Reiter: „Steuerzahler" (Angaben je Land + USt-IdNr.) und
// „Steuerdokumente".
//
// Ehrlichkeit statt Fassade: Der Reiter „Steuerdokumente" zeigt, dass noch
// keine Dokumente vorliegen — das ist der wahre Zustand, denn die Jahres-
// meldung läuft erstmals im Januar. Ein erfundener Download-Button wäre ein
// toter Button (Wurzel 5).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";

import { landName } from "@/lib/laender";
import type {
  ObjektAngabeStatus,
  TaxpayerEntry,
  TaxpayerOverview,
} from "@/lib/steuern";
import { loescheSteuerangaben } from "@/lib/steuern-actions";

import { ObjektangabenAbschnitt } from "./objektangaben-abschnitt";
import { SteuerStartDialog } from "./steuer-start-dialog";
import { SteuerWizard } from "./steuer-wizard";

type Reiter = "steuerzahler" | "dokumente";

/** Steuernummer maskieren — nur die letzten vier Stellen bleiben lesbar.
 *
 *  Eine Steuer-ID ist ein sensibles Personenmerkmal. Zum Wiedererkennen in
 *  einer Übersicht genügt das Ende; wer den vollen Wert braucht, öffnet den
 *  Eintrag. Kurze Nummern werden ganz verdeckt, sonst bliebe fast alles
 *  sichtbar. */
function maskiere(tin: string): string {
  const rein = tin.trim();
  if (rein.length <= 4) return "•".repeat(rein.length);
  return `${"•".repeat(rein.length - 4)}${rein.slice(-4)}`;
}

export function SteuernAbschnitt({
  uebersicht,
  objektangaben,
}: {
  uebersicht: TaxpayerOverview | null;
  objektangaben: ObjektAngabeStatus[] | null;
}) {
  const [daten, setDaten] = useState(uebersicht);
  const [reiter, setReiter] = useState<Reiter>("steuerzahler");
  const [wizardOffen, setWizardOffen] = useState(false);
  // Neue Angaben starten über das Regime-Popup und laufen dann im Vollbild
  // weiter. Bearbeiten und „Land ergänzen" bleiben im Dialog: dort steht das
  // Land schon fest, ein Vollbild-Flow wäre ein Umweg.
  const [startOffen, setStartOffen] = useState(false);
  const [vorbelegt, setVorbelegt] = useState<string | undefined>();
  const [bearbeiten, setBearbeiten] = useState<TaxpayerEntry | undefined>();
  const [fehler, setFehler] = useState<string | null>(null);

  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Steuerangaben konnten nicht geladen werden. Diesen Bereich sieht nur,
        wer die Abrechnung verwalten darf.
      </p>
    );
  }

  function oeffneWizard(land?: string, eintrag?: TaxpayerEntry) {
    setVorbelegt(land);
    setBearbeiten(eintrag);
    setFehler(null);
    setWizardOffen(true);
  }

  async function entferne(land: string) {
    setFehler(null);
    const res = await loescheSteuerangaben(land);
    if (res.ok) setDaten(res.uebersicht);
    else setFehler(res.error);
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-extrabold">Steuern</h2>

      <div className="flex gap-2">
        {(
          [
            ["steuerzahler", "Steuerzahler"],
            ["dokumente", "Steuerdokumente"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setReiter(k)}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              reiter === k
                ? "border border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {fehler && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <Icon icon="solar:danger-triangle-line-duotone" className="size-4" />
          {fehler}
        </p>
      )}

      {reiter === "steuerzahler" ? (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-xl font-bold">
                Steuerinformationen
              </h3>
              <p className="text-sm text-muted-foreground">
                Für die meisten Länder sind Steuerangaben erforderlich. Wir sind
                als Buchungsplattform verpflichtet, sie zu erheben und jährlich
                an die Steuerbehörde zu melden.
              </p>
            </div>

            {daten.fehlende_laender.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="flex items-start gap-2 text-sm">
                  <Icon
                    icon="solar:danger-triangle-line-duotone"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    Für{" "}
                    {daten.fehlende_laender.map(landName).join(", ")} fehlen noch
                    Steuerangaben — dort hast du Objekte.
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {daten.fehlende_laender.map((land) => (
                    <Button
                      key={land}
                      variant="outline"
                      size="sm"
                      onClick={() => oeffneWizard(land)}
                    >
                      {landName(land)} ergänzen
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {daten.eintraege.length > 0 && (
              <ul className="flex flex-col divide-y divide-border">
                {daten.eintraege.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-[0.9375rem] font-medium">
                        {landName(e.country)}
                        {e.confirmed_at ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Abgeschlossen
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            Handlung erforderlich
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {e.kind === "entity"
                          ? e.legal_name
                          : `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()}
                        {/* Die Steuernummer wird MASKIERT: sie ist ein
                            sensibles Personenmerkmal und muss in einer
                            Übersicht nicht lesbar sein. Zum Prüfen genügen
                            die letzten Stellen. */}
                        {e.tin
                          ? ` · ${maskiere(e.tin)}`
                          : " · ohne Steuernummer"}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => oeffneWizard(undefined, e)}
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => void entferne(e.country)}
                        className="text-sm text-muted-foreground underline underline-offset-4"
                      >
                        Entfernen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Button className="self-start" onClick={() => setStartOffen(true)}>
              Steuerinformationen hinzufügen
            </Button>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-8">
            <h3 className="font-display text-xl font-bold">
              Umsatzsteuer-Identifikationsnummer
            </h3>
            <p className="text-sm text-muted-foreground">
              Wenn du umsatzsteuerlich registriert bist, hinterlege deine
              USt-IdNr. Sie gehört zu den Unternehmensdaten und wird für deine
              Rechnungen verwendet.
            </p>
            {daten.vat_id ? (
              <p className="text-[0.9375rem]">
                Hinterlegt: <span className="font-medium">{daten.vat_id}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine USt-IdNr. hinterlegt.
              </p>
            )}
            <a
              href="/konto?bereich=unternehmen"
              className="self-start text-sm font-medium underline underline-offset-4"
            >
              In den Unternehmensdaten bearbeiten
            </a>
          </section>

          <ObjektangabenAbschnitt angaben={objektangaben} />
        </>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-xl font-bold">Dokumente</h3>
            <p className="text-sm text-muted-foreground">
              Hier findest du künftig die Unterlagen zu deiner jährlichen
              Steuermeldung. Deine Rechnungen und Auszahlungen findest du unter
              Zahlungen.
            </p>
          </div>
          <div className="rounded-2xl border border-border p-6">
            <p className="text-sm text-muted-foreground">
              Es liegen noch keine Steuerdokumente vor. Die Meldung erfolgt
              jeweils im Januar für das abgelaufene Jahr.
            </p>
          </div>
        </section>
      )}

      <SteuerStartDialog
        offen={startOffen}
        onClose={() => setStartOffen(false)}
      />

      {wizardOffen && (
        <SteuerWizard
          offen={wizardOffen}
          onClose={() => setWizardOffen(false)}
          onGespeichert={setDaten}
          vorbelegtesLand={vorbelegt}
          bearbeiten={bearbeiten}
        />
      )}
    </div>
  );
}
