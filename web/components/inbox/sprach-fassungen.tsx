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
// ZWEI FORMATE, weil die zwei Ziele verschieden sind (`format`):
//   `"html"` — VORLAGEN. Autorenformat ist HTML (`body_html`), den Klartext für
//     den Versand leitet der SERVER ab.
//   `"text"` — AUTOMAIL-REGELN. `message_automation.message` hat keine
//     HTML-Spalte; der Text geht als Klartext raus. Der Editor liefert hier
//     direkt Klartext, damit kein Markup beim Gast landet.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useTranslations } from "next-intl";

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
}) {
  const t = useTranslations("inbox");
  const [waehlen, setWaehlen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

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

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {reiter.map((r) => (
        <button
          key={r.schluessel}
          type="button"
          onClick={() => onAktiv(r.schluessel)}
          aria-current={aktiv === r.schluessel}
          className={
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors " +
            (aktiv === r.schluessel
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
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
              (fassungGefuellt(fassungen[r.schluessel]) ? "bg-emerald-500" : "bg-border")
            }
          />
        </button>
      ))}

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
  /** Sprachcode dieser Fassung. Fehlt er (Grundfassung), gibt es keinen
   *  Übersetzen-Knopf — die Grundfassung ist die Quelle, nicht das Ziel. */
  uebersetzenZiel?: string;
  /** Die Quelle für den Übersetzen-Knopf. */
  grundfassung?: Fassung;
}) {
  const t = useTranslations("inbox");
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
          <label className="text-sm font-medium" htmlFor={`${hoeheSchluessel}-betreff`}>
            {t("subjectLabel")}
          </label>
          <Input
            id={`${hoeheSchluessel}-betreff`}
            value={fassung.subject}
            onChange={(e) => onChange({ ...fassung, subject: e.target.value })}
            placeholder={t("subjectLabel")}
          />
          {/* Die Einschränkung steht DA, nicht im Hilfeartikel: unser Versand
              läuft über den Gast-Chat der Portale, und der überträgt keinen
              Betreff. Wer hier tippt, soll wissen, wohin es geht (Wurzel 4 —
              kein Versprechen, das der Versand nicht hält). */}
          <p className="-mt-1 text-xs text-muted-foreground">{t("subjectHint")}</p>
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
