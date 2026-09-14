"use client";

// Der Reiter „Steuerdokumente": die DAC7-Jahresmeldung.
//
// Der Ablauf, bewusst in getrennten Schritten:
//   1. BERECHNEN  — zeigt, was gemeldet würde, und was noch fehlt
//   2. HERUNTERLADEN — die Datei für das Portal der Behörde (CSV oder XML)
//   3. ÜBERMITTELN — an die Empfangsstelle senden, sofern eingerichtet
//   4. ABGEBEN bestätigen — kennzeichnet den Lauf als abgegeben
//
// Warum Schritt 3 und 4 GETRENNT bleiben: Eine Annahme durch die Teststufe
// ist keine Zusage der Behörde. „Abgegeben" ist die Aussage des Betriebs,
// dass die Meldung bei der Behörde liegt — sie automatisch zu setzen, weil
// eine simulierte Stelle „angenommen" sagte, wäre eine Falschaussage im
// eigenen Datenbestand.
//
// Schritt 3 erscheint nur, wenn die Übermittlung eingerichtet ist. Sonst
// bleibt es beim bisherigen Weg: herunterladen und selbst hochladen. Ein
// Knopf, der nur fehlschlagen kann, ist schlimmer als keiner.
//
// Der Prüfbericht ist gleichrangig mit der Datei, nicht Beiwerk: Bei
// unvollständigen Daten ist die Mängelliste das eigentliche Ergebnis.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";

import type {
  Befund,
  Dateipruefung,
  Meldeformat,
  Meldelauf,
  MeldungVorschau,
  Uebermittlungsergebnis,
} from "@/lib/dac7";
import { abgabefrist, meldejahre, objektartName } from "@/lib/dac7";

import { CsvRaster } from "./csv-raster";
import {
  erzeugeMeldung,
  holeMeldedatei,
  meldungAbgeben,
  uebermittleMeldung,
  uebermittlungEingerichtet,
} from "@/lib/dac7-actions";

function datumKurz(wert: string | Date): string {
  const datum = typeof wert === "string" ? new Date(wert) : wert;
  return datum.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Einen Betrag anzeigen, ohne ihn zu rechnen.
 *
 *  Die Werte kommen als Zeichenkette vom Server (JSON kennt nur `double`).
 *  Für die Anzeige wird nur gruppiert — der Wert selbst bleibt unangetastet. */
function betrag(wert: string, waehrung: string): string {
  const zahl = Number(wert);
  if (!Number.isFinite(zahl)) return `${wert} ${waehrung}`;
  return `${zahl.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${waehrung}`;
}

function BefundListe({
  befunde,
  art,
}: {
  befunde: Befund[];
  art: "fehler" | "hinweis";
}) {
  if (befunde.length === 0) return null;
  const istFehler = art === "fehler";
  return (
    <ul className="space-y-2">
      {befunde.map((befund, i) => (
        <li
          key={`${befund.betrifft}-${befund.feld}-${i}`}
          className={`flex gap-3 rounded-lg border p-3 text-sm ${
            istFehler
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
          }`}
        >
          <Icon
            icon={istFehler ? "solar:danger-triangle-bold" : "solar:info-circle-bold"}
            className={`mt-0.5 size-5 shrink-0 ${
              istFehler ? "text-red-600" : "text-amber-600"
            }`}
          />
          <div className="min-w-0">
            <p className="font-medium">{befund.betrifft}</p>
            <p className="text-neutral-700 dark:text-neutral-300">
              {befund.grund}
            </p>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">
              {befund.feld}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Warum die Zahl der gemeldeten Buchungen kleiner ist als der Bestand.
 *
 *  Ohne diese Aufstellung wirkt jede Meldung unvollständig — und der
 *  häufigste Grund (das Portal meldet selbst) ist gerade der wichtigste. */
function Ausschluesse({ liste }: { liste: Record<string, number> }) {
  const eintraege = Object.entries(liste).sort((a, b) => b[1] - a[1]);
  if (eintraege.length === 0) return null;
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h4 className="mb-3 text-sm font-semibold">
        Nicht in dieser Meldung enthalten
      </h4>
      <ul className="space-y-1.5 text-sm">
        {eintraege.map(([grund, anzahl]) => (
          <li key={grund} className="flex justify-between gap-4">
            <span className="text-neutral-600 dark:text-neutral-400">
              {grund}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{anzahl}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ein Objekt = eine Zeile der Meldedatei.
 *
 *  Die amtliche Vorlage verlangt fuer Immobilien eine Zeile je Objekt
 *  („Gentages for hver ejendom"). Diese Karte bildet genau eine solche
 *  Zeile ab — mit den Feldern, die wirklich uebermittelt werden, damit
 *  niemand die Rohdatei lesen muss, um sie zu pruefen. */
function ObjektKarte({
  objekt,
  nummer,
}: {
  objekt: MeldungVorschau["anbieter"][number]["taetigkeiten"][number];
  nummer: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          <span className="mr-2 text-xs text-neutral-400">
            Zeile {nummer}
          </span>
          {objekt.anschrift || "(ohne Anschrift)"}
        </span>
        <span className="text-xs text-neutral-500">
          {objektartName(objekt.objektart) ?? "Art nicht angegeben"}
          {objekt.vermietete_tage !== null
            ? ` · ${objekt.vermietete_tage} Tage vermietet`
            : ""}
          {` · ${objekt.anzahl_buchungen} Buchungen`}
        </span>
      </div>

      {/* Die Kennungen der Immobilie. BFE und Matrikelnummer sind zwei
          verschiedene Angaben — die Behoerde erwartet auch zwei Werte. */}
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-neutral-500">BFE-Nummer</dt>
          <dd className="font-mono">
            {objekt.bfe_nummer ?? (
              <span className="text-amber-600">fehlt</span>
            )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-neutral-500">Matrikelnummer</dt>
          <dd className="font-mono">
            {objekt.grundbuchnummer ?? (
              <span className="text-neutral-400">—</span>
            )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-neutral-500">Land</dt>
          <dd className="font-mono">{objekt.land}</dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
        {(["q1", "q2", "q3", "q4"] as const).map((q, i) => (
          <div key={q}>
            <p className="text-xs text-neutral-500">Q{i + 1}</p>
            <p className="tabular-nums">
              {betrag(objekt.verguetung[q], objekt.waehrung)}
            </p>
          </div>
        ))}
        <div>
          <p className="text-xs font-medium text-neutral-500">Gesamt</p>
          <p className="font-semibold tabular-nums">
            {betrag(objekt.verguetung.summe, objekt.waehrung)}
          </p>
        </div>
      </div>

      {(Number(objekt.gebuehren.summe) > 0 ||
        Number(objekt.steuern.summe) > 0 ||
        objekt.brutto_mieteinnahme) && (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          {Number(objekt.gebuehren.summe) > 0 && (
            <div className="flex gap-1.5">
              <dt>Gebühren</dt>
              <dd className="tabular-nums">
                {betrag(objekt.gebuehren.summe, objekt.waehrung)}
              </dd>
            </div>
          )}
          {Number(objekt.steuern.summe) > 0 && (
            <div className="flex gap-1.5">
              <dt>einbehaltene Steuer</dt>
              <dd className="tabular-nums">
                {betrag(objekt.steuern.summe, objekt.waehrung)}
              </dd>
            </div>
          )}
          {objekt.brutto_mieteinnahme && (
            <div className="flex gap-1.5">
              <dt>Bruttomieteinnahme</dt>
              <dd className="tabular-nums">
                {betrag(
                  objekt.brutto_mieteinnahme,
                  objekt.brutto_waehrung ?? objekt.waehrung,
                )}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function AnbieterKarte({
  anbieter,
}: {
  anbieter: MeldungVorschau["anbieter"][number];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{anbieter.anzeigename}</p>
          <p className="text-xs text-neutral-500">
            {anbieter.ist_person ? "Privatperson" : "Gesellschaft"} ·{" "}
            {anbieter.ansaessig_in.join(", ")}
            {anbieter.steuernummer_maskiert
              ? ` · Steuer-Nr. ${anbieter.steuernummer_maskiert}`
              : ""}
          </p>
        </div>
        <span className="font-mono text-xs text-neutral-400">
          {anbieter.doc_ref_id}
        </span>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {anbieter.taetigkeiten.length === 1
          ? "1 Objekt — eine Zeile in der Meldedatei"
          : `${anbieter.taetigkeiten.length} Objekte — je eine Zeile in der Meldedatei`}
      </p>

      <div className="mt-2 space-y-3">
        {anbieter.taetigkeiten.map((objekt, i) => (
          <ObjektKarte
            key={`${objekt.bfe_nummer ?? objekt.anschrift}-${objekt.land}`}
            objekt={objekt}
            nummer={i + 1}
          />
        ))}
      </div>
    </div>
  );
}

/** Jahreswahl, Berechnen-Knopf und Abgabefrist. */
function Steuerleiste({
  jahr,
  jahre,
  frist,
  fristVorbei,
  abgegeben,
  laeuft,
  onJahr,
  onProbelauf,
  onBerechnen,
}: {
  jahr: number;
  jahre: number[];
  frist: Date;
  fristVorbei: boolean;
  abgegeben: boolean;
  laeuft: boolean;
  onJahr: (wert: number) => void;
  onProbelauf: () => void;
  onBerechnen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Meldejahr</span>
        <select
          value={jahr}
          onChange={(e) => onJahr(Number(e.target.value))}
          // appearance-none: Das native Dreieck würde sonst außerhalb des
          // Innenabstands gezeichnet und am rechten Rand kleben.
          className="appearance-none rounded-lg border border-neutral-300 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22gray%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-9 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {jahre.map((wert) => (
            <option key={wert} value={wert}>
              {wert}
            </option>
          ))}
        </select>
      </label>

      {/* Der Probelauf steht vorn und ist der Hauptknopf: Er ist der
          richtige erste Schritt, und er kann nichts kaputtmachen. */}
      <Button onClick={onProbelauf} disabled={laeuft}>
        <Icon icon="solar:test-tube-bold" className="size-4" />
        {laeuft ? "Läuft…" : "Probelauf"}
      </Button>

      <Button variant="outline" onClick={onBerechnen} disabled={laeuft}>
        Meldung erstellen
      </Button>

      <p className="text-sm text-neutral-500">
        Abgabefrist: {datumKurz(frist)}
        {fristVorbei && !abgegeben ? " · überschritten" : ""}
      </p>
    </div>
  );
}

/** Die Knopfleiste eines fertig berechneten Laufs. */
function LaufAktionen({
  abgegeben,
  laeuft,
  bestaetigen,
  kannUebermitteln,
  onHerunterladen,
  onUebermitteln,
  onBestaetigen,
  onAbgeben,
}: {
  abgegeben: boolean;
  laeuft: boolean;
  bestaetigen: boolean;
  /** Nur dann erscheint der Übermitteln-Knopf. Ist die Strecke nicht
   *  eingerichtet, bleibt es beim Herunterladen — ein Knopf, der nur
   *  fehlschlagen kann, ist schlimmer als keiner. */
  kannUebermitteln: boolean;
  onHerunterladen: (format: Meldeformat) => void;
  onUebermitteln: () => void;
  onBestaetigen: (wert: boolean) => void;
  onAbgeben: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => onHerunterladen("csv")}>
        <Icon icon="solar:download-minimalistic-bold" className="size-4" />
        CSV herunterladen
      </Button>
      {/* Dieselbe Meldung, das andere Zielformat. Dänemark nimmt ab dem
          Meldejahr 2026 DPI-XML entgegen; beide entstehen aus demselben
          gerechneten Baum. */}
      <Button variant="outline" onClick={() => onHerunterladen("xml")}>
        <Icon icon="solar:code-file-bold" className="size-4" />
        XML herunterladen
      </Button>
      {kannUebermitteln && !abgegeben && (
        <Button onClick={onUebermitteln} disabled={laeuft}>
          <Icon icon="solar:upload-minimalistic-bold" className="size-4" />
          {laeuft ? "Wird übermittelt …" : "An die Behörde übermitteln"}
        </Button>
      )}
      {abgegeben ? null : bestaetigen ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Datei wurde bei der Behörde eingereicht?
          </span>
          <Button onClick={onAbgeben} disabled={laeuft}>
            Ja, als abgegeben kennzeichnen
          </Button>
          <Button variant="ghost" onClick={() => onBestaetigen(false)}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => onBestaetigen(true)}>
          Als abgegeben kennzeichnen
        </Button>
      )}
    </div>
  );
}

/**
 * Was die Empfangsstelle geantwortet hat.
 *
 * DREI Zustände, nicht zwei. `angenommen: null` heißt UNBEKANNT — die
 * Antwort kam nicht an, die Datei kann die Behörde erreicht haben. Diesen
 * Fall als „nicht gesendet" zu zeigen wäre der teuerste Fehler des Moduls:
 * Der nächste Klick erzeugte eine Doppelmeldung, und der Vermieter würde
 * doppelt veranlagt. Deshalb steht bei unbekanntem Ausgang auch kein
 * „Erneut senden" da.
 */
function Quittung({
  ergebnis,
  onErneut,
}: {
  ergebnis: Uebermittlungsergebnis;
  onErneut: () => void;
}) {
  const unbekannt = ergebnis.angenommen === null;
  const angenommen = ergebnis.angenommen === true;
  const farbe = unbekannt
    ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
    : angenommen
      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
      : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950";
  const symbol = unbekannt
    ? "solar:question-circle-bold"
    : angenommen
      ? "solar:check-circle-bold"
      : "solar:close-circle-bold";
  const symbolfarbe = unbekannt
    ? "text-amber-600"
    : angenommen
      ? "text-green-600"
      : "text-red-600";

  return (
    <div className={`mt-4 rounded-lg border p-4 text-sm ${farbe}`}>
      <div className="flex items-start gap-3">
        <Icon
          icon={symbol}
          className={`mt-0.5 size-5 shrink-0 ${symbolfarbe}`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {unbekannt
              ? "Ausgang unbekannt"
              : angenommen
                ? "Von der Empfangsstelle angenommen"
                : "Von der Empfangsstelle zurückgewiesen"}
          </p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">
            {ergebnis.meldung}
          </p>

          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {ergebnis.quittungsnummer && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Quittung</dt>
                <dd className="font-mono">{ergebnis.quittungsnummer}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Übertragung</dt>
              <dd>
                {ergebnis.verschluesselt ? (
                  <span className="inline-flex items-center gap-1">
                    <Icon icon="solar:lock-keyhole-bold" className="size-3.5" />
                    verschlüsselt
                  </span>
                ) : (
                  "unverschlüsselt"
                )}
              </dd>
            </div>
            {ergebnis.pruefsumme && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Prüfsumme</dt>
                {/* Die des KLARTEXTS — sie belegt, WAS eingereicht wurde,
                    unabhängig von der Verschlüsselung. */}
                <dd className="truncate font-mono text-xs">
                  {ergebnis.pruefsumme.slice(0, 24)}…
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Ziel</dt>
              <dd className="truncate text-xs">{ergebnis.ziel}</dd>
            </div>
          </dl>

          {ergebnis.ist_teststufe && (
            <p className="mt-3 text-xs text-muted-foreground">
              Das war die <strong>Teststufe</strong>, nicht die Behörde. Eine
              Annahme hier ist keine Zusage von Skattestyrelsen — die Meldung
              gilt erst als abgegeben, wenn sie dort eingereicht wurde.
            </p>
          )}

          {ergebnis.wiederholbar && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onErneut}
            >
              Erneut übermitteln
            </Button>
          )}
          {unbekannt && (
            <p className="mt-3 text-xs font-medium">
              Bitte im Portal der Behörde nachsehen, bevor erneut gesendet
              wird — eine zweite Einreichung derselben Meldung wäre eine
              Doppelmeldung.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Der Hinweis auf eine bereits abgegebene Meldung. */
function AbgegebenHinweis({ lauf }: { lauf: Meldelauf }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
      <Icon
        icon="solar:check-circle-bold"
        className="size-5 shrink-0 text-green-600"
      />
      <div>
        <p className="font-medium">Meldung für {lauf.jahr} ist abgegeben</p>
        <p className="text-neutral-600 dark:text-neutral-400">
          Am {datumKurz(lauf.abgegeben_am ?? lauf.created_at)} ·{" "}
          {lauf.anzahl_anbieter} Anbieter · {lauf.anzahl_buchungen} Buchungen.
          Änderungen sind nur noch als Korrekturmeldung möglich.
        </p>
      </div>
    </div>
  );
}

/** Die Liste der gespeicherten Läufe. */
function LaufListe({
  laeufe,
  onHerunterladen,
}: {
  laeufe: Meldelauf[];
  onHerunterladen: (laufId: string) => void;
}) {
  const beschriftung: Record<string, string> = {
    abgegeben: "abgegeben",
    ersetzt: "ersetzt",
    entwurf: "Entwurf",
  };
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">Bisherige Meldungen</h4>
      <div className="space-y-2">
        {laeufe.map((lauf) => (
          <div
            key={lauf.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
          >
            <div>
              <p className="font-medium">
                {lauf.jahr}
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal dark:bg-neutral-800">
                  {beschriftung[lauf.status] ?? lauf.status}
                </span>
              </p>
              <p className="text-xs text-neutral-500">
                {lauf.anzahl_anbieter} Anbieter · {lauf.anzahl_einheiten}{" "}
                Einheiten · {lauf.anzahl_buchungen} Buchungen · erstellt{" "}
                {datumKurz(lauf.created_at)}
              </p>
            </div>
            <Button variant="ghost" onClick={() => onHerunterladen(lauf.id)}>
              <Icon icon="solar:download-minimalistic-bold" className="size-4" />
              Datei
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Was ein Probelauf ergeben hat.
 *
 *  Der Blick in die erzeugte Datei ist der Kern: „Es hat geklappt" bleibt
 *  sonst eine Behauptung. Gezeigt werden die ersten Zeilen — genug, um
 *  Kopfzeile, Nachricht, Betreiber und die ersten Anbieter zu sehen. */
/** Was die Pruefung der FERTIGEN Datei ergeben hat.
 *
 *  Der Unterschied zum Pruefbericht darueber: Jener prueft unsere Daten,
 *  BEVOR die Datei entsteht. Dieser liest die fertige Datei zurueck und
 *  misst sie an den Regeln der amtlichen Vorlage — so, wie die Behoerde
 *  es tun wuerde. Ein Fehler im Erzeugen selbst faellt nur hier auf. */
function Regelpruefung({ pruefung }: { pruefung: Dateipruefung }) {
  const [offen, setOffen] = useState(false);
  const zeilen = Object.entries(pruefung.zeilentypen).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div
      className={`rounded-lg border p-4 ${
        pruefung.besteht
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          icon={
            pruefung.besteht
              ? "solar:shield-check-bold"
              : "solar:shield-cross-bold"
          }
          className={`mt-0.5 size-5 shrink-0 ${
            pruefung.besteht ? "text-green-600" : "text-red-600"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {pruefung.besteht
              ? "Die Datei hält allen Regeln der amtlichen Vorlage stand"
              : `${pruefung.fehler.length} Regelverstöße — so nimmt die Behörde die Datei nicht an`}
          </p>
          <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">
            Geprüft wurden {pruefung.zeilen} Zeilen gegen die Vorgaben von
            Skattestyrelsen: Spalten und Reihenfolge, Pflichtangaben je
            Zeilentyp, Wertelisten, Datums- und Zahlenformate, Wahrheitswerte
            und der Aufbau der Datei.
          </p>

          {pruefung.fehler.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {pruefung.fehler.slice(0, 20).map((befund) => (
                <li
                  key={`${befund.zeile}-${befund.spalte}-${befund.regel}`}
                  className="flex flex-wrap gap-x-2"
                >
                  <span className="font-mono text-xs text-neutral-500">
                    Zeile {befund.zeile}
                  </span>
                  <span className="font-mono text-xs">{befund.spalte}</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {befund.grund}
                    {befund.wert ? ` (»${befund.wert}«)` : ""}
                  </span>
                </li>
              ))}
              {pruefung.fehler.length > 20 && (
                <li className="text-xs text-neutral-500">
                  … und {pruefung.fehler.length - 20} weitere
                </li>
              )}
            </ul>
          )}

          {pruefung.hinweise.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-500">
              {pruefung.hinweise.slice(0, 5).map((befund) => (
                <li key={`${befund.zeile}-${befund.spalte}-${befund.regel}`}>
                  Zeile {befund.zeile} · {befund.spalte}: {befund.grund}
                </li>
              ))}
            </ul>
          )}

          {zeilen.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOffen((wert) => !wert)}
                className="mt-2 text-sm font-medium underline underline-offset-4"
              >
                {offen ? "Aufbau ausblenden" : "Aufbau der Datei zeigen"}
              </button>
              {offen && (
                <dl className="mt-2 space-y-0.5 text-xs">
                  {zeilen.map(([typ, anzahl]) => (
                    <div key={typ} className="flex gap-2">
                      <dt className="font-mono">{typ}</dt>
                      <dd className="text-neutral-500">
                        {anzahl}{" "}
                        {typ === "ACT_Immovable_Property"
                          ? anzahl === 1
                            ? "Objekt"
                            : "Objekte"
                          : anzahl === 1
                            ? "Zeile"
                            : "Zeilen"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Eine Datei im Browser zum Speichern anbieten.
 *
 *  Die Datei entsteht aus dem Text — sie war nie eine URL, die jemand
 *  ohne Anmeldung hätte abrufen können.
 *
 *  DIE BOM BEI CSV: Sie kommt bereits aus dem Serialisierer
 *  (`csv_dk.schreiben`, so wie das Export-Makro der amtlichen Vorlage mit
 *  `xlCSVUTF8`) und übersteht den Weg durch die Antwort. Hier steht sie
 *  als BACKSTOP — fehlt sie einmal, erkennt Excel auf einem deutschen oder
 *  dänischen System das `;` nicht als Trennzeichen und legt die ganze
 *  Zeile in EINE Spalte. Die Datei sieht dann hochkant aus, obwohl ihr
 *  Inhalt stimmt (live gemeldet am 11.09.2026). Doppelt darf sie nicht
 *  hinein, deshalb die Prüfung. */
function speichern(inhalt: string, name: string, format: Meldeformat): void {
  const text =
    format === "csv" && !inhalt.startsWith("\ufeff")
      ? `\ufeff${inhalt}`
      : inhalt;
  const ziel = URL.createObjectURL(
    new Blob([text], {
      type:
        format === "xml"
          ? "application/xml;charset=utf-8"
          : "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = ziel;
  link.download = name;
  link.click();
  URL.revokeObjectURL(ziel);
}

function ProbelaufErgebnis({ vorschau }: { vorschau: MeldungVorschau }) {
  const [dateiOffen, setDateiOffen] = useState(false);
  const geht = vorschau.datei_verfuegbar;

  return (
    <div
      className={`rounded-lg border p-4 ${
        geht
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
          : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          icon={geht ? "solar:check-circle-bold" : "solar:danger-triangle-bold"}
          className={`mt-0.5 size-5 shrink-0 ${
            geht ? "text-green-600" : "text-amber-600"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {geht
              ? "Probelauf erfolgreich — die Meldung lässt sich erzeugen"
              : "Probelauf: die Meldung kann so noch nicht erzeugt werden"}
          </p>
          <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">
            {geht
              ? `Die Datei hätte ${vorschau.datei_zeilen ?? "?"} Zeilen. Es wurde nichts gespeichert und nichts gemeldet.`
              : "Es wurde nichts gespeichert. Die fehlenden Angaben stehen unten."}
          </p>

          {geht && (vorschau.datei_inhalt ?? vorschau.datei_anfang) && (
            <>
              <button
                type="button"
                onClick={() => setDateiOffen((offen) => !offen)}
                className="mt-2 text-sm font-medium underline underline-offset-4"
              >
                {dateiOffen
                  ? "Datei ausblenden"
                  : "Die vollständige Datei ansehen"}
              </button>
              {dateiOffen && (
                <>
                  <p className="mt-2 text-xs text-neutral-500">
                    Genau dieser Text wird übermittelt. Erste Zeile: die
                    Spaltennamen, EU-weit einheitlich. Danach je eine Zeile
                    für Nachricht, Betrieb, Verkäufer und jedes Objekt.
                  </p>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">
                    {vorschau.datei_inhalt ?? vorschau.datei_anfang}
                  </pre>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Das Ergebnis eines Laufs: Kopfzahlen, Mängel, Ausschlüsse, Anbieter.
 *
 *  Die Reihenfolge ist Absicht: Erst was geht, dann was fehlt, dann was
 *  bewusst draußen bleibt, dann die Einzelheiten. Wer die Meldung
 *  vorbereitet, arbeitet von oben nach unten. */
function VorschauBereich({
  vorschau,
  abgegeben,
  laeuft,
  bestaetigen,
  kannUebermitteln,
  quittung,
  onHerunterladen,
  onUebermitteln,
  onBestaetigen,
  onAbgeben,
}: {
  vorschau: MeldungVorschau;
  abgegeben: boolean;
  laeuft: boolean;
  bestaetigen: boolean;
  kannUebermitteln: boolean;
  /** Die Antwort der Empfangsstelle, sobald übermittelt wurde. */
  quittung: Uebermittlungsergebnis | null;
  onHerunterladen: (laufId: string, format: Meldeformat) => void;
  onUebermitteln: (laufId: string) => void;
  onBestaetigen: (wert: boolean) => void;
  onAbgeben: (laufId: string) => void;
}) {
  const laufId = vorschau.lauf_id;
  return (
    <div className="space-y-4">
      {vorschau.probelauf && <ProbelaufErgebnis vorschau={vorschau} />}
      {vorschau.dateipruefung && (
        <Regelpruefung pruefung={vorschau.dateipruefung} />
      )}

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">
            {vorschau.anbieter.length} Anbieter ·{" "}
            {vorschau.bericht.einbezogene_buchungen} Buchungen
          </h4>
          {vorschau.melde_ref_id && (
            <span className="font-mono text-xs text-neutral-400">
              {vorschau.melde_ref_id}
            </span>
          )}
        </div>

        {/* Beim Probelauf gibt es keine Kennung — herunterladen und
            abgeben wären dort tote Knöpfe. */}
        {vorschau.datei_verfuegbar && laufId ? (
          <>
            <LaufAktionen
              abgegeben={abgegeben}
              laeuft={laeuft}
              bestaetigen={bestaetigen}
              kannUebermitteln={kannUebermitteln}
              onHerunterladen={(format) => onHerunterladen(laufId, format)}
              onUebermitteln={() => onUebermitteln(laufId)}
              onBestaetigen={onBestaetigen}
              onAbgeben={() => onAbgeben(laufId)}
            />
            {quittung && (
              <Quittung
                ergebnis={quittung}
                onErneut={() => onUebermitteln(laufId)}
              />
            )}
          </>
        ) : vorschau.probelauf ? (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Probelauf — zum Herunterladen und Abgeben die Meldung erstellen.
          </p>
        ) : (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            Diese Meldung kann noch nicht erzeugt werden — die unten genannten
            Angaben fehlen.
          </p>
        )}
      </div>

      {/* Die Datei selbst — vor den Anbieterkarten. Die Karten legen sie
          aus, das Raster IST sie. */}
      {vorschau.datei_inhalt && <CsvRaster datei={vorschau.datei_inhalt} />}

      {vorschau.bericht.fehler.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            Fehlende Angaben ({vorschau.bericht.fehler.length})
          </h4>
          <BefundListe befunde={vorschau.bericht.fehler} art="fehler" />
        </div>
      )}

      {vorschau.bericht.hinweise.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            Hinweise ({vorschau.bericht.hinweise.length})
          </h4>
          <BefundListe befunde={vorschau.bericht.hinweise} art="hinweis" />
        </div>
      )}

      <Ausschluesse liste={vorschau.bericht.ausgeschlossene_buchungen} />

      {vorschau.anbieter.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Gemeldete Anbieter</h4>
          {vorschau.anbieter.map((anbieter) => (
            <AnbieterKarte key={anbieter.doc_ref_id} anbieter={anbieter} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Dac7Meldung({ laeufe }: { laeufe: Meldelauf[] | null }) {
  const jahre = meldejahre();
  // Vorbelegt ist das zuletzt ABGELAUFENE Jahr — das ist das, was gemeldet
  // wird. Das laufende Jahr steht zur Vorschau bereit, ist aber noch nicht
  // meldereif.
  const [jahr, setJahr] = useState(jahre[1] ?? jahre[0]);
  const [vorschau, setVorschau] = useState<MeldungVorschau | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [gespeicherte, setGespeicherte] = useState(laeufe ?? []);
  const [quittung, setQuittung] = useState<Uebermittlungsergebnis | null>(null);
  // Ob überhaupt übermittelt werden kann. Erst false: Ein Knopf, der kurz
  // erscheint und dann verschwindet, ist schlimmer als einer, der nach dem
  // Laden dazukommt.
  const [kannUebermitteln, setKannUebermitteln] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    void uebermittlungEingerichtet().then((wert) => {
      if (!abgebrochen) setKannUebermitteln(wert);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const frist = abgabefrist(jahr);
  const abgegeben = gespeicherte.find(
    (lauf) => lauf.jahr === jahr && lauf.status === "abgegeben",
  );

  async function berechnen(probelauf: boolean) {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await erzeugeMeldung(jahr, { probelauf });
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.error);
      return;
    }
    setQuittung(null);
    setVorschau(ergebnis.vorschau);
  }

  async function herunterladen(laufId: string, format: Meldeformat = "csv") {
    setFehler(null);
    const ergebnis = await holeMeldedatei(laufId, format);
    if (!ergebnis.ok) {
      setFehler(ergebnis.error);
      return;
    }
    speichern(ergebnis.inhalt, ergebnis.name, format);
  }

  async function uebermitteln(laufId: string) {
    setLaeuft(true);
    setFehler(null);
    setQuittung(null);
    const ergebnis = await uebermittleMeldung(laufId);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.error);
      return;
    }
    // Auch eine Zurückweisung und ein unbekannter Ausgang sind ERGEBNISSE,
    // keine Fehler: Sie gehören in die Quittung, nicht in die Fehlerzeile.
    setQuittung(ergebnis.ergebnis);
  }

  async function abgeben(laufId: string) {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await meldungAbgeben(laufId);
    setLaeuft(false);
    setBestaetigen(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.error);
      return;
    }
    setGespeicherte((bisher) => [
      ergebnis.lauf,
      ...bisher.filter((lauf) => lauf.id !== ergebnis.lauf.id),
    ]);
    setVorschau(null);
  }

  if (laeufe === null) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Die Meldungen konnten nicht geladen werden. Für diesen Bereich wird die
        Berechtigung „Abrechnung verwalten" benötigt.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">DAC7-Jahresmeldung</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Als Vermittler sind Sie verpflichtet, die Einnahmen Ihrer
          Hauseigentümer jährlich an die Steuerbehörde zu melden. Die Meldung
          umfasst <strong>alle</strong> Vermietungen Ihrer Objekte — auch
          Buchungen über Booking, Airbnb oder direkt: Maßgeblich ist Ihr
          Vermittlungsvertrag mit dem Eigentümer, nicht der Buchungsweg.
        </p>
      </div>

      <Steuerleiste
        jahr={jahr}
        jahre={jahre}
        frist={frist}
        fristVorbei={frist.getTime() < Date.now()}
        abgegeben={Boolean(abgegeben)}
        laeuft={laeuft}
        onJahr={(wert) => {
          setJahr(wert);
          setVorschau(null);
        }}
        onProbelauf={() => berechnen(true)}
        onBerechnen={() => berechnen(false)}
      />

      {fehler && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {fehler}
        </div>
      )}

      {abgegeben && <AbgegebenHinweis lauf={abgegeben} />}

      {vorschau && (
        <VorschauBereich
          vorschau={vorschau}
          abgegeben={Boolean(abgegeben)}
          laeuft={laeuft}
          bestaetigen={bestaetigen}
          kannUebermitteln={kannUebermitteln}
          quittung={quittung}
          onHerunterladen={herunterladen}
          onUebermitteln={uebermitteln}
          onBestaetigen={setBestaetigen}
          onAbgeben={abgeben}
        />
      )}

      {gespeicherte.length > 0 && (
        <LaufListe laeufe={gespeicherte} onHerunterladen={herunterladen} />
      )}

      {gespeicherte.length === 0 && !vorschau && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Es liegt noch keine Meldung vor. Wählen Sie ein Jahr und berechnen Sie
          die Meldung, um zu sehen, was gemeldet würde.
        </p>
      )}
    </div>
  );
}
