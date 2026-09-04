"use client";

// Kopf- und Aktionsleiste des Dienstplans (Vertrag §5): Zeitraum-Navigation,
// die zwei Umschalter (Tag/Woche/Monat, Kalender/Liste) und die Aktionen.
//
// WARUM EIGENE DATEI: `dienstplan.tsx` führt den Zustand; diese Leiste ist
// reines Markup über Callbacks und Flags. Zusammen wären es 1.700 Zeilen, in
// denen man die Zustandslogik zwischen Knöpfen suchen muss.
//
// WAS AN WELCHEM RECHT HÄNGT: Drucken und CSV stehen auch der Schichtleitung
// offen (der Aushang trägt keine Finanzzahlen, §4.3); alles Planende hängt an
// `kannPlanen`, alles Regelabhängige zusätzlich an `regelnBestaetigt` — ohne
// bestätigte Regeln gibt es keine Konfliktprüfung, also kein Anlegen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Segmented } from "@nextdays/ui/segmented";
import type { Ansicht, Darstellung } from "@/lib/personal-planung-typen";

export function DienstplanLeiste({
  zeitraumText,
  statusText,
  ansicht,
  darstellung,
  laden,
  laeuft,
  kannPlanen,
  regelnBestaetigt,
  auswahlModus,
  onZurueck,
  onVor,
  onHeute,
  onAnsicht,
  onDarstellung,
  onDrucken,
  onCsv,
  onVorlagen,
  onAuswahlToggle,
  onBedarfEditor,
  onBedarfAusAufgaben,
  onKopieren,
  onLeeren,
  onVeroeffentlichen,
}: {
  zeitraumText: string;
  /** „Veröffentlicht" oder „Entwurf" — der Zustand kommt vom Plan. */
  statusText: string;
  ansicht: Ansicht;
  darstellung: Darstellung;
  laden: boolean;
  laeuft: boolean;
  kannPlanen: boolean;
  regelnBestaetigt: boolean;
  auswahlModus: boolean;
  onZurueck: () => void;
  onVor: () => void;
  onHeute: () => void;
  onAnsicht: (a: Ansicht) => void;
  onDarstellung: (d: Darstellung) => void;
  onDrucken: () => void;
  onCsv: () => void;
  onVorlagen: () => void;
  onAuswahlToggle: () => void;
  onBedarfEditor: () => void;
  onBedarfAusAufgaben: () => void;
  onKopieren: () => void;
  onLeeren: () => void;
  onVeroeffentlichen: () => void;
}) {
  const t = useTranslations("personal");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={onZurueck}
            aria-label={t("dienstplan.vorher")}
          >
            <Icon icon="ph:caret-left" />
          </Button>
          <div className="min-w-56 text-center">
            <h1 className="font-display text-xl font-extrabold">{t("dienstplan.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {zeitraumText} · {statusText}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={onVor}
            aria-label={t("dienstplan.nachher")}
          >
            <Icon icon="ph:caret-right" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onHeute}
          >
            {t("heute")}
          </Button>
          {laden && (
            <Icon icon="ph:circle-notch" className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Ansicht>
            value={ansicht}
            options={[
              { value: "tag", label: t("zeit.ansicht.tag") },
              { value: "woche", label: t("zeit.ansicht.woche") },
              { value: "monat", label: t("zeit.ansicht.monat") },
            ]}
            onChange={onAnsicht}
          />
          {ansicht !== "monat" && (
            <Segmented<Darstellung>
              value={darstellung}
              options={[
                { value: "grid", label: t("abwesenheit.sicht.kalender") },
                { value: "liste", label: t("zeit.tabs.liste") },
              ]}
              onChange={onDarstellung}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Der Aushang steht auch der Schichtleitung offen — er trägt keine
            Finanzzahlen, deshalb hängt er nicht an `kannPlanen`. */}
        <Button
          variant="outline"
          className="rounded-full"
          onClick={onDrucken}
          disabled={laeuft}
        >
          <Icon icon="ph:printer" className="mr-1 size-4" />
          {t("drucken.knopf")}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={onCsv}
          disabled={laeuft}
        >
          <Icon icon="ph:file-csv" className="mr-1 size-4" />
          {t("mitarbeiter.exportieren")}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={onVorlagen}>
          <Icon icon="ph:bookmarks-simple" className="mr-1 size-4" />
          {t("wochenvorlagen.knopf")}
        </Button>
        {kannPlanen && (
          <>
            <Button
              variant={auswahlModus ? "default" : "outline"}
              className="rounded-full"
              onClick={onAuswahlToggle}
            >
              <Icon icon="ph:check-square" className="mr-1 size-4" />
              {auswahlModus ? t("mehrfach.beenden") : t("mehrfach.auswaehlen")}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={onBedarfEditor}>
              <Icon icon="ph:users-three" className="mr-1 size-4" />
              {t("bedarf.knopf")}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onBedarfAusAufgaben}
              disabled={!regelnBestaetigt}
            >
              <Icon icon="ph:list-checks" className="mr-1 size-4" />
              {t("dienstplan.bedarf")}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onKopieren}
              disabled={!regelnBestaetigt}
            >
              <Icon icon="ph:copy" className="mr-1 size-4" />
              {t("dienstplan.vorwocheKopieren")}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-destructive"
              onClick={onLeeren}
              disabled={laeuft || !regelnBestaetigt}
            >
              <Icon icon="ph:eraser" className="mr-1 size-4" />
              {t("loeschen")}
            </Button>
            <Button
              className="rounded-full"
              onClick={onVeroeffentlichen}
              disabled={!regelnBestaetigt}
            >
              <Icon icon="ph:paper-plane-tilt" className="mr-1 size-4" />
              {t("dienstplan.veroeffentlichen")}
            </Button>
          </>
        )}
      </div>

    </>
  );
}
