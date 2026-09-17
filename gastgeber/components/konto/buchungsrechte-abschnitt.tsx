"use client";

// Abschnitt „Buchungsberechtigungen" der Kontoeinstellungen — wer darf bei dir
// buchen.
//
// Nachgebaut nach Airbnb (Hilfe-Artikel 484 · 1170 · 1237 und „Deciding how
// you'll confirm reservations", abgerufen 17.09.2026; das Feld selbst heißt in
// Airbnbs API `instant_booking_allowed_category`). Zwei Entscheidungen:
//
//   1. Sofortbuchung oder Anfrage.
//   2. Falls Sofortbuchung: für WEN sie gilt — geprüfte Identität und/oder
//      gute Vorgeschichte.
//
// DER SATZ, DER HIER NICHT FEHLEN DARF: Wer eine Voraussetzung nicht erfüllt,
// wird NICHT abgewiesen — daraus wird eine Anfrage. Ohne diesen Hinweis liest
// sich jede Voraussetzung wie eine Sperre, und ein Gastgeber schaltet sie aus
// Angst vor Umsatzverlust nicht ein, obwohl sie ihn keinen kostet.
//
// Kein Realtime: die Einstellung ändert nur, wer sie gerade setzt. Der Server
// gibt den neuen Stand zurück, die Ansicht übernimmt ihn.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Switch } from "@nextdays/ui/switch";

import type {
  Buchungsberechtigung,
  Buchungsmodus,
  Voraussetzungen,
} from "@/lib/buchungsrechte";
import { ausZielgruppe, zuZielgruppe } from "@/lib/buchungsrechte";
import { setzeBuchungsberechtigung } from "@/lib/buchungsrechte-actions";

// Airbnbs Grundvoraussetzungen für ALLE Gäste (Artikel 1170/1237). Sie sind
// Plattform-Sache und kein Schalter des Gastgebers — sie stehen hier, damit
// niemand sie zusätzlich fordert und sich wundert, dass es sie nicht gibt.
const GRUNDLAGEN = [
  "brGrundName",
  "brGrundMail",
  "brGrundTelefon",
  "brGrundZahlung",
  "brGrundHausregeln",
] as const;

function Wahlkarte({
  titel,
  text,
  gewaehlt,
  onClick,
  disabled,
}: {
  titel: string;
  text: string;
  gewaehlt: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={gewaehlt}
      className={`flex w-full items-start gap-3 rounded-2xl border p-5 text-start transition-colors disabled:opacity-60 ${
        gewaehlt
          ? "border-foreground bg-muted/40"
          : "border-border hover:bg-muted/30"
      }`}
    >
      <Icon
        icon={gewaehlt ? "ph:radio-button-fill" : "ph:circle"}
        className="mt-0.5 size-5 shrink-0"
      />
      <span className="min-w-0">
        <span className="block font-medium">{titel}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

function Bedingung({
  titelKey,
  textKey,
  an,
  onChange,
  disabled,
}: {
  titelKey: string;
  textKey: string;
  an: boolean;
  onChange: (an: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("konto");
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{t(titelKey)}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t(textKey)}
        </p>
      </div>
      <Switch
        checked={an}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={t(titelKey)}
      />
    </div>
  );
}

/** Airbnbs „Nachricht vor der Buchung".
 *
 *  Eigener Speichern-Knopf und kein Speichern beim Tippen: eine Frage wird
 *  formuliert, nicht geschaltet — ein PUT je Tastendruck schriebe Dutzende
 *  halbe Sätze in jede Buchungsstrecke. */
function FrageFeld({
  wert,
  busy,
  aufSpeichern,
}: {
  wert: string | null;
  busy: boolean;
  aufSpeichern: (frage: string) => void;
}) {
  const t = useTranslations("konto");
  const [text, setText] = useState(wert ?? "");
  const geaendert = (text.trim() || null) !== (wert || null);

  return (
    <div className="mt-8">
      <h2 className="font-medium">{t("brFrageTitel")}</h2>
      <p className="mt-1 max-w-lg text-[0.9375rem] text-muted-foreground">
        {t("brFrageText")}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("brFragePlatzhalter")}
        className="mt-3 w-full max-w-lg rounded-2xl border border-border bg-background px-4 py-3 text-[0.9375rem] outline-none focus:border-foreground"
      />
      {geaendert && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => aufSpeichern(text.trim())}
            disabled={busy}
            className="text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
          >
            {t("brFrageSpeichern")}
          </button>
        </div>
      )}
    </div>
  );
}

export function BuchungsrechteAbschnitt({
  stand,
}: {
  stand: Buchungsberechtigung | null;
}) {
  const t = useTranslations("konto");
  const [werte, setWerte] = useState<Buchungsberechtigung | null>(stand);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(
    modus: Buchungsmodus,
    vor: Voraussetzungen,
    frage: string | null = werte?.vorab_frage ?? null,
  ) {
    if (!werte) return;
    const zielgruppe = zuZielgruppe(vor);
    if (
      modus === werte.modus &&
      zielgruppe === werte.zielgruppe &&
      (frage || null) === (werte.vorab_frage || null)
    ) {
      return;
    }
    setBusy(true);
    setFehler(null);
    // Optimistisch setzen, damit der Schalter sofort reagiert; bei Fehlschlag
    // zurück auf den alten Stand — eine Anzeige, die eine nicht gespeicherte
    // Einstellung behauptet, wäre schlimmer als ein kurzes Zögern.
    const vorher = werte;
    setWerte({ ...werte, modus, zielgruppe, vorab_frage: frage || null });
    const res = await setzeBuchungsberechtigung(modus, zielgruppe, frage || null);
    setBusy(false);
    if (res.ok) {
      setWerte(res.stand);
    } else {
      setWerte(vorher);
      setFehler(res.error);
    }
  }

  if (!werte) {
    return (
      <section>
        <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
          {t("navBuchungsrechte")}
        </h1>
        {/* Kein Zugriff ist etwas anderes als „steht auf Sofortbuchung" —
            eine geratene Einstellung anzuzeigen wäre eine Falschaussage. */}
        <p className="text-[0.9375rem] text-destructive">
          {t("brNichtAbrufbar")}
        </p>
      </section>
    );
  }

  const vor = ausZielgruppe(werte.zielgruppe);
  const sofort = werte.modus === "instant";

  return (
    <section>
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">
        {t("navBuchungsrechte")}
      </h1>
      <p className="mb-8 max-w-lg text-[0.9375rem] text-muted-foreground">
        {t("brEinleitung")}
      </p>

      <h2 className="font-medium">{t("brModusTitel")}</h2>
      <div className="mt-3 space-y-3">
        <Wahlkarte
          titel={t("brModusSofort")}
          text={t("brModusSofortText")}
          gewaehlt={sofort}
          onClick={() => void speichern("instant", vor)}
          disabled={busy}
        />
        <Wahlkarte
          titel={t("brModusAnfrage")}
          text={t("brModusAnfrageText")}
          gewaehlt={!sofort}
          onClick={() => void speichern("request", vor)}
          disabled={busy}
        />
      </div>

      {/* Die Voraussetzungen gelten nur für die Sofortbuchung. Bei „Anfrage"
          entscheidet ohnehin der Gastgeber selbst — dann wären sie ohne
          Wirkung, und ein wirkungsloser Schalter gehört nicht auf die Seite.
          Airbnb blendet sie an dieser Stelle ebenfalls aus. */}
      {sofort && (
        <div className="mt-8">
          <h2 className="font-medium">{t("brWerTitel")}</h2>
          <p className="mt-1 max-w-lg text-[0.9375rem] text-muted-foreground">
            {t("brWerText")}
          </p>
          <div className="mt-3 rounded-2xl border border-border px-5">
            <Bedingung
              titelKey="brWerIdentitaet"
              textKey="brWerIdentitaetText"
              an={vor.identitaet}
              onChange={(an) =>
                void speichern("instant", { ...vor, identitaet: an })
              }
              disabled={busy}
            />
            <Bedingung
              titelKey="brWerVorgeschichte"
              textKey="brWerVorgeschichteText"
              an={vor.vorgeschichte}
              onChange={(an) =>
                void speichern("instant", { ...vor, vorgeschichte: an })
              }
              disabled={busy}
            />
          </div>
          <p className="mt-3 flex max-w-lg items-start gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
            {t("brHerabstufung")}
          </p>

          <FrageFeld
            wert={werte.vorab_frage}
            busy={busy}
            aufSpeichern={(frage) => void speichern("instant", vor, frage)}
          />
        </div>
      )}

      <div className="mt-8 rounded-2xl bg-muted/40 p-5">
        <p className="font-medium">{t("brGrundTitel")}</p>
        <ul className="mt-3 space-y-2">
          {GRUNDLAGEN.map((key) => (
            <li
              key={key}
              className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground"
            >
              <Icon
                icon="ph:check"
                className="size-4 shrink-0 text-emerald-600"
              />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {t("brGiltFuerAlle", { anzahl: werte.objekte_gesamt })}
        {werte.objekte_abweichend > 0 && (
          <>
            {" "}
            {t("brAbweichend", { anzahl: werte.objekte_abweichend })}
          </>
        )}
      </p>

      {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}
    </section>
  );
}
