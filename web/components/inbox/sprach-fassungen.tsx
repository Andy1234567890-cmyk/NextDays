"use client";

// Inhalt je Sprache — die Reiter über Betreff und Text (0363).
//
// DAS MODELL (wie im Backend, `inbox/sprachen.py`): Es gibt EINE Grundfassung
// ohne Sprachangabe und dazu beliebig viele Sprachfassungen. Verschickt wird die
// Fassung in der Sprache des Gastes, sonst die der Standardsprache des Betriebs,
// sonst die Grundfassung.
//
// WARUM ES DEN REITER „GRUNDFASSUNG" GIBT, obwohl Lodgify ihn nicht hat: Beim
// Beta-Betrieb stehen 17 gepflegte Vorlagen in gemischten Sprachen, und niemand
// hat je erfasst, welche welche ist. Diese Texte einer Sprache zuzuschreiben
// hieße zu behaupten, was keiner weiß — und ein dänischer Text, der als
// „deutsche Fassung" gilt, geht an deutsche Gäste hinaus, ohne dass die fehlende
// deutsche Fassung je auffällt. Die Grundfassung ist deshalb ein eigener Reiter.
//
// SIE IST DER LETZTE RANG, NICHT DER ERSTE RÜCKFALL: vor ihr greift die Fassung
// in der Standardsprache des Betriebs. Wer alle Vorlagen in seiner Standard-
// sprache pflegt, erreicht die Grundfassung nie — genau das führte am
// 24.08.2026 dazu, dass ein italienischer Gast die deutsche Fassung bekam,
// obwohl die Grundfassung englisch ist. Welche Sprache das ist, steht seither
// in „Sprachen verwalten" (`langDefaultHint`).
//
// Solange der Betrieb KEINE Sprachen verwaltet, zeigt diese Komponente gar keine
// Reiter — dann ist die Grundfassung schlicht „der Text", genau wie vorher.
//
// ZWEI VERSCHIEDENE „LÖSCHEN", DIE MAN NICHT VERWECHSELN DARF:
//   1. HIER, am Reiter (das X): löscht die Fassung DIESER EINEN Vorlage/Regel.
//      Die Sprache bleibt beim Betrieb geführt, der Reiter bleibt stehen (nur
//      leer, mit grauem Punkt), alle anderen Vorlagen bleiben unberührt.
//   2. In „Sprachen verwalten" (`sprachen-panel.tsx`, der Papierkorb): entfernt
//      die Sprache beim BETRIEB — samt ihren Texten in ALLEN Vorlagen und
//      Regeln, und der Reiter verschwindet überall.
// Beide Dialoge benennen genau diesen Unterschied (`langClearConfirm` gegen
// `langRemoveHint`), sonst löscht jemand 17 Vorlagen, weil er eine meinte.
//
// WARUM DAS X NICHT SOFORT SPEICHERT, anders als der Papierkorb in „Sprachen
// verwalten": dort ist jede Zeile eine für sich stehende Entscheidung, hier ist
// die Fassung Teil eines Formulars, das noch ungespeicherte Änderungen an
// Titel, Grundfassung und den anderen Sprachen hält. Ein sofortiger Server-
// Aufruf würde vom nächsten „Speichern" ohnehin wieder überschrieben — der
// Speichern-Pfad schickt IMMER den vollständigen Sollzustand
// (`_sprachfassungen_schreiben`, Wurzel 1: was fehlt, wird entfernt). Das X
// leert die Fassung deshalb im Editor und sagt dazu, dass es mit dem Speichern
// wirkt; ein zweiter, entgegengesetzt laufender Löschweg entfällt.
// Nebeneffekt derselben Entscheidung: das X wirkt auch in einer NOCH NICHT
// gespeicherten Vorlage, die gar keine ID hat, an der ein DELETE-Endpunkt also
// nichts löschen könnte.
//
// ZWEI FORMATE, weil die zwei Ziele verschieden sind (`format`):
//   `"html"` — VORLAGEN. Autorenformat ist HTML (`body_html`), den Klartext für
//     den Versand leitet der SERVER ab.
//   `"text"` — AUTOMAIL-REGELN. `message_automation.message` hat keine
//     HTML-Spalte; der Text geht als Klartext raus. Der Editor liefert hier
//     direkt Klartext, damit kein Markup beim Gast landet.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  ComposerEditor,
  type ComposerGriff,
} from "@/components/inbox/composer-editor";
import { FeldDialogKnopf } from "@/components/inbox/feld-picker";
import {
  type MessageLanguage,
  addMessageLanguage,
  translateFassung,
} from "@/lib/inbox";

/** Kennung des Reiters „ohne Sprache". Kein Sprachcode kann so heißen (zwei
 *  Kleinbuchstaben, serverseitig per CHECK erzwungen) — deshalb ist die
 *  Verwechslung mit einer echten Sprache ausgeschlossen. */
export const GRUNDFASSUNG = "__grund__";

/** Eine Fassung im Editor. `body` ist HTML oder Klartext, je nach `format` der
 *  Einsatzstelle — nie beides gemischt. */
export type Fassung = { subject: string; body: string };

/** Alle Fassungen: Schlüssel ist der Sprachcode bzw. `GRUNDFASSUNG`. */
export type Fassungen = Record<string, Fassung>;

/** Steht in dieser Fassung etwas? Prüft auf INHALT, nicht auf Zeichenkette:
 *  ein leerer Editor liefert im HTML-Modus „<p></p>". */
export function fassungGefuellt(f: Fassung | undefined): boolean {
  if (!f) return false;
  return Boolean(f.body.replace(/<[^>]*>/g, "").trim() || f.subject.trim());
}

export function SprachReiter({
  sprachen,
  aktiv,
  onAktiv,
  fassungen,
  namen,
  onSpracheHinzugefuegt,
  onFassungLeeren,
}: {
  sprachen: MessageLanguage[];
  aktiv: string;
  onAktiv: (schluessel: string) => void;
  /** Für den Punkt „hier steht schon etwas" am Reiter. */
  fassungen: Fassungen;
  /** Sprachcode → ausgeschriebener Name (Katalog des Servers). Fehlt einer,
   *  steht der Code da — kein erfundener Name (Wurzel 4). */
  namen?: Record<string, string>;
  /** Der Betrieb führt jetzt eine Sprache mehr. Der Aufrufer übernimmt die
   *  neue Liste und schaltet auf den frischen Reiter. Fehlt der Handler, gibt
   *  es kein Plus — dann ist die Leiste reine Anzeige. */
  onSpracheHinzugefuegt?: (
    sprachen: MessageLanguage[],
    neuerCode: string,
  ) => void;
  /** Diese Sprachfassung soll weg (das X am Reiter). Der Aufrufer leert sie in
   *  seinem `fassungen`-Zustand; entfernt wird sie beim Speichern, weil der
   *  Speichern-Pfad den vollständigen Sollzustand schickt. Fehlt der Handler,
   *  gibt es kein X — dann ist die Leiste reine Anzeige.
   *
   *  NIE für die Grundfassung: sie ist der letzte Rang. Ohne sie hätte ein
   *  Gast, dessen Sprache und dessen Standardsprache keine Fassung haben, gar
   *  keinen Text — die Vorlage verschickte nichts. Der Aufrufer bekommt sie
   *  deshalb nie übergeben. */
  onFassungLeeren?: (sprachcode: string) => void;
}) {
  const t = useTranslations("inbox");
  const [waehlen, setWaehlen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Zuletzt geleerte Sprache (Anzeigename) — für den Hinweis „wirkt beim
   *  Speichern". Ohne ihn sieht der Betreiber nach dem X nur einen grauen Punkt
   *  und hält die Fassung für schon gelöscht; verlässt er die Maske ohne zu
   *  speichern, steht sie unverändert in der DB und geht weiter an Gäste raus. */
  const [geleert, setGeleert] = useState<string | null>(null);

  // Die Auswahl hinter dem Plus kommt aus `namen` — der Katalog des Servers,
  // den jeder Editor ohnehin lädt (`listAvailableLanguages`). Bewusst kein
  // zweiter Prop: eine parallele Katalog-Liste würde beim nächsten Editor
  // vergessen, und das Plus wäre dort still leer.
  // Schon gepflegte Sprachen stehen nicht mehr zur Wahl — sie erneut
  // anzubieten sähe aus, als könnte man sie zweimal führen.
  const offen = Object.entries(namen ?? {})
    .filter(([code]) => !sprachen.some((s) => s.code === code))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const mitPlus = Boolean(onSpracheHinzugefuegt) && offen.length > 0;

  async function hinzufuegen(code: string) {
    if (!code || pending) return;
    setFehler(null);
    setPending(true);
    const res = await addMessageLanguage(code);
    setPending(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setWaehlen(false);
    onSpracheHinzugefuegt?.(res.data.items, code);
  }

  // Ohne verwaltete Sprachen UND ohne Plus wäre ein einzelner Reiter
  // „Grundfassung" nur Lärm. Mit Plus bleibt die Leiste stehen: sonst gäbe es
  // im Editor keinen Weg zur ersten Sprache.
  if (sprachen.length === 0 && !mitPlus) return null;

  const reiter = [
    { schluessel: GRUNDFASSUNG, label: t("langBase") },
    ...sprachen.map((s) => ({
      schluessel: s.code,
      label: namen?.[s.code] ?? s.code.toUpperCase(),
    })),
  ];

  /** Das X am Reiter. Fragt vorher — und benennt im Dialog, dass es NUR diese
   *  eine Vorlage/Regel trifft. Ohne diesen Satz ist es von „Sprache entfernen"
   *  in „Sprachen verwalten" nicht zu unterscheiden, das die Texte in ALLEN
   *  Vorlagen löscht. */
  function leeren(code: string, label: string) {
    if (!window.confirm(t("langClearConfirm", { sprache: label }))) return;
    // Diagnose (Nutzerregel „Debugging immer einbauen"): das Leeren wirkt erst
    // beim Speichern, also liegen Klick und Wirkung auseinander. Bleibt die
    // Fassung nach dem Speichern stehen, beantwortet diese Zeile die erste
    // Frage — kam der Klick überhaupt an, und mit welchem Sprachcode?
    console.warn("[inbox] Sprachfassung geleert (wirkt beim Speichern)", {
      sprache: code,
    });
    setGeleert(label);
    onFassungLeeren?.(code);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {reiter.map((r) => {
        const gefuellt = fassungGefuellt(fassungen[r.schluessel]);
        // Das X nur, wo es etwas zu leeren GIBT: nie an der Grundfassung (der
        // letzte Rang, s. Prop-Kommentar) und nie an einem schon leeren Reiter
        // — ein Knopf, der nichts tut, ist eine Attrappe.
        const mitLeeren =
          Boolean(onFassungLeeren) && r.schluessel !== GRUNDFASSUNG && gefuellt;
        return (
          <span
            key={r.schluessel}
            className={
              "-mb-px flex items-center border-b-2 transition-colors " +
              (aktiv === r.schluessel ? "border-accent" : "border-transparent")
            }
          >
            <button
              type="button"
              onClick={() => onAktiv(r.schluessel)}
              aria-current={aktiv === r.schluessel}
              className={
                "flex items-center gap-1.5 py-2 text-sm transition-colors " +
                (mitLeeren ? "pl-3 pr-1.5 " : "px-3 ") +
                (aktiv === r.schluessel
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {r.label}
              {/* Der Punkt beantwortet die Frage, die man beim Pflegen von fünf
                  Sprachen dauernd hat: welcher Reiter ist noch leer? Ohne ihn muss
                  man jeden einzeln anklicken. */}
              <span
                aria-hidden="true"
                className={
                  "size-1.5 rounded-full " +
                  (gefuellt ? "bg-emerald-500" : "bg-border")
                }
              />
            </button>
            {/* Eigener Knopf NEBEN dem Reiter, nicht darin: ein Knopf im Knopf
                ist ungültiges HTML, und der Screenreader läse eine einzige,
                mehrdeutige Schaltfläche vor. */}
            {mitLeeren && (
              <button
                type="button"
                onClick={() => leeren(r.schluessel, r.label)}
                title={t("langClear", { sprache: r.label })}
                aria-label={t("langClear", { sprache: r.label })}
                className="mr-1.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            )}
          </span>
        );
      })}

      {/* Der Weg zur nächsten Sprache steht DA, wo die Sprachen stehen. Vorher
          lag er nur im Automatisieren-Panel unter „Sprachen verwalten" — wer
          eine Vorlage bearbeitete, sah drei Reiter und keinen Weg zum vierten. */}
      {mitPlus &&
        (waehlen ? (
          <NativeSelect
            autoFocus
            value=""
            disabled={pending}
            onChange={(e) => void hinzufuegen(e.target.value)}
            onBlur={() => setWaehlen(false)}
            aria-label={t("langAdd")}
            className="my-1 h-8 w-44 text-sm"
          >
            <option value="">{t("langAdd")}</option>
            {offen.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <button
            type="button"
            onClick={() => setWaehlen(true)}
            title={t("langAdd")}
            aria-label={t("langAdd")}
            className="-mb-px flex items-center gap-1 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("langAdd")}
          </button>
        ))}

      {fehler && (
        <span className="px-2 text-sm text-destructive">{fehler}</span>
      )}

      {/* Der Hinweis steht NEBEN den Reitern, nicht in einem Toast: er gilt so
          lange, bis gespeichert ist, und ein Toast wäre genau dann weg, wenn
          man ihn braucht. Er nennt die Sprache beim Namen, damit nach zwei
          geleerten Reitern klar ist, worauf er sich bezieht. */}
      {geleert && (
        <span className="basis-full px-1 pb-1.5 text-xs text-muted-foreground">
          {t("langClearedPendingSave", { sprache: geleert })}
        </span>
      )}
    </div>
  );
}

/** „Aus Grundfassung übersetzen" — steht in jedem Sprachreiter, nie in der
 *  Grundfassung selbst (die IST die Quelle).
 *
 *  Das Ergebnis wird NICHT gespeichert, sondern in den Editor gesetzt: der
 *  Betreiber prüft und speichert selbst. Maschinelle Übersetzungen von
 *  Hausregeln und Stornobedingungen ungesehen scharf zu schalten wäre bei
 *  rechtlich relevanten Texten nicht vertretbar.
 *
 *  Steht in der Fassung schon etwas, wird vorher gefragt — sonst wäre ein
 *  Fehlklick der stille Verlust einer von Hand gepflegten Fassung (Wurzel 1). */
export function UebersetzenKnopf({
  ziel,
  quelle,
  ziel_fassung,
  onErgebnis,
  format,
  mitBetreff,
}: {
  ziel: string;
  quelle: Fassung | undefined;
  ziel_fassung: Fassung | undefined;
  onErgebnis: (f: Fassung) => void;
  format: "html" | "text";
  mitBetreff: boolean;
}) {
  const t = useTranslations("inbox");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const quelleLeer = !fassungGefuellt(quelle);

  async function uebersetzen() {
    if (!quelle || quelleLeer || laeuft) return;
    if (
      fassungGefuellt(ziel_fassung) &&
      !window.confirm(t("translateOverwrite"))
    ) {
      return;
    }
    setFehler(null);
    setLaeuft(true);
    const res = await translateFassung({
      body: quelle.body,
      subject: mitBetreff ? quelle.subject : null,
      target: ziel,
      format,
    });
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    onErgebnis({
      subject: res.data.subject ?? (mitBetreff ? ziel_fassung?.subject ?? "" : ""),
      body: res.data.body,
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void uebersetzen()}
          disabled={laeuft || quelleLeer}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
        >
          <Icon
            icon={laeuft ? "ph:circle-notch" : "ph:translate"}
            className={"size-4 " + (laeuft ? "animate-spin" : "")}
          />
          {t("translateFromBase")}
        </button>
        {/* Die Einschränkung steht DA, nicht im Hilfeartikel: der Text kommt
            maschinell und geht an Gäste. Wer ihn nicht liest, verschickt ihn
            ungeprüft. */}
        <span className="text-xs text-muted-foreground">
          {quelleLeer ? t("translateBaseEmpty") : t("translateCheckHint")}
        </span>
      </div>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
    </div>
  );
}

export function FassungFelder({
  fassung,
  onChange,
  griff,
  hoeheSchluessel,
  testId,
  platzhalter,
  format = "html",
  mitBetreff = true,
  betreffHinweis,
  uebersetzenZiel,
  grundfassung,
}: {
  fassung: Fassung;
  onChange: (f: Fassung) => void;
  griff: React.RefObject<ComposerGriff | null>;
  hoeheSchluessel: string;
  testId?: string;
  platzhalter: string;
  format?: "html" | "text";
  /** Der Betreff gilt nur für E-Mail. Wo er (noch) nichts bewirkt, bleibt das
   *  Feld weg statt leer dazustehen. */
  mitBetreff?: boolean;
  /** Erklärung am ℹ-Symbol des Betreffs. Ohne Angabe gilt der allgemeine Satz
   *  (`subjectHint`); die Automatisierungen setzen ihren eigenen, weil dort
   *  zwei Versandwege nebeneinander stehen (Portal-Chat und E-Mail). */
  betreffHinweis?: string;
  /** Sprachcode dieser Fassung. Fehlt er (Grundfassung), gibt es keinen
   *  Übersetzen-Knopf — die Grundfassung ist die Quelle, nicht das Ziel. */
  uebersetzenZiel?: string;
  /** Die Quelle für den Übersetzen-Knopf. */
  grundfassung?: Fassung;
}) {
  const t = useTranslations("inbox");
  const tGemein = useTranslations("common");
  return (
    <div className="flex flex-col gap-2">
      {uebersetzenZiel && (
        <UebersetzenKnopf
          ziel={uebersetzenZiel}
          quelle={grundfassung}
          ziel_fassung={fassung}
          onErgebnis={onChange}
          format={format}
          mitBetreff={mitBetreff}
        />
      )}
      {mitBetreff && (
        <>
          {/* Die Einschränkung steht DA, nicht im Hilfeartikel: über den
              Gast-Chat der Portale geht kein Betreff hinaus, über E-Mail
              schon. Wer hier tippt, soll wissen, wohin es geht (Wurzel 4 —
              kein Versprechen, das der Versand nicht hält).
              Am ℹ-Symbol und nicht als Absatz darunter: Hilfetexte gehören
              projektweit ins Symbol, sonst wächst jede Maske um eine Zeile,
              die niemand mehr liest. */}
          <div className="flex items-center gap-1.5">
            <label
              className="text-sm font-medium"
              htmlFor={`${hoeheSchluessel}-betreff`}
            >
              {t("subjectLabel")}
            </label>
            <InfoHinweis
              titel={t("subjectLabel")}
              text={betreffHinweis ?? t("subjectHint")}
              ariaLabel={tGemein("explain", { label: t("subjectLabel") })}
            />
          </div>
          <Input
            id={`${hoeheSchluessel}-betreff`}
            value={fassung.subject}
            onChange={(e) => onChange({ ...fassung, subject: e.target.value })}
            placeholder={t("subjectLabel")}
          />
        </>
      )}
      <div className="flex flex-col rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-accent/40">
        <ComposerEditor
          wert={fassung.body}
          onChange={(wert) => onChange({ ...fassung, body: wert })}
          format={format}
          platzhalter={platzhalter}
          griff={griff}
          hoeheSchluessel={hoeheSchluessel}
          griffSeite="unten"
          leisteSeite="unten"
          testId={testId}
          leisteZusatz={
            <FeldDialogKnopf onInsert={(p) => griff.current?.einfuegen(p)} />
          }
          etiketten={{
            bold: t("formatBold"),
            italic: t("formatItalic"),
            underline: t("formatUnderline"),
            strike: t("formatStrike"),
            bulletList: t("formatBulletList"),
            orderedList: t("formatOrderedList"),
            link: t("formatLink"),
            code: t("formatCode"),
            linkPrompt: t("formatLinkPrompt"),
            resize: t("formatResize"),
          }}
        />
      </div>
    </div>
  );
}
