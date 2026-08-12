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
// deutsche Fassung je auffällt. Die Grundfassung ist deshalb ein eigener Reiter
// und bleibt der Rückfall für jede Sprache ohne eigene Fassung.
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
import { useTranslations } from "next-intl";

import { Input } from "@nextdays/ui/input";
import {
  ComposerEditor,
  type ComposerGriff,
} from "@/components/inbox/composer-editor";
import { FeldDialogKnopf } from "@/components/inbox/feld-picker";
import type { MessageLanguage } from "@/lib/inbox";

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
}: {
  sprachen: MessageLanguage[];
  aktiv: string;
  onAktiv: (schluessel: string) => void;
  /** Für den Punkt „hier steht schon etwas" am Reiter. */
  fassungen: Fassungen;
  /** Sprachcode → ausgeschriebener Name (Katalog des Servers). Fehlt einer,
   *  steht der Code da — kein erfundener Name (Wurzel 4). */
  namen?: Record<string, string>;
}) {
  const t = useTranslations("inbox");

  // Ohne verwaltete Sprachen ist ein einzelner Reiter „Grundfassung" nur Lärm.
  if (sprachen.length === 0) return null;

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
}) {
  const t = useTranslations("inbox");
  return (
    <div className="flex flex-col gap-2">
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
