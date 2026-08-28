"use client";

// Die Wahl der Buchungsstrecke (0474) — drei Formen, eine Entscheidung.
//
// WARUM ES DIESES FENSTER GIBT
// Die Buchungsstrecke stand in der Seitenliste unter „Buchungsstrecke", und ein
// Klick öffnete nur die SEO-Felder. Der Betrieb sah, DASS es diese Seiten gibt,
// und konnte nichts damit tun — bei der Objektseite war genau das schon einmal
// der Fehler (0468).
//
// WARUM EINE WAHL FÜR DREI SEITEN UND NICHT DREI WAHLEN
// Objektseite, Buchung und Bestätigung sind ein WEG, den der Gast hintereinander
// durchläuft. Eine moderne Objektseite vor einem schmalen Behörden-Checkout
// wirkt wie zwei verschiedene Websites, und genau an diesem Bruch bricht der
// Gast ab. Wer einzelne Seiten anders will, baut sie danach im Editor um — die
// Vorlage ist ein Startpunkt, kein Rahmen.
//
// WARUM ECHTE VORSCHAU UND KEINE GEZEICHNETE SKIZZE
// Die drei unterscheiden sich in Anordnung UND Wirkung: ob die Zusammenfassung
// seitlich mitläuft oder oben klebt, sieht man erst mit einem echten Objekt
// darin. Eine Skizze aus Rechtecken zeigt die Anordnung und verschweigt, wie es
// sich anfühlt.
//
// Der Preis dafür ist ein Beispielobjekt. Es kommt aus dem BESTAND des Betriebs
// (das zuletzt angelegte aktive), nicht aus erfundenen Daten — eine Vorschau mit
// einem Fantasie-Haus für 149 € wäre der plausible Ersatzwert, den Wurzel 4
// verbietet. Hat der Betrieb kein aktives Objekt, nennt das Fenster den Grund
// statt eine leere Fläche zu zeigen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  applyStrecke,
  createStreckePreviewToken,
  type Strecke,
} from "@/lib/site-pages";

const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

/** Die drei Abschnitte einer Strecke, in der Reihenfolge des Gastes.
 *
 *  Sie sind die Reiter der Vorschau. Feste Liste und keine aus der Antwort
 *  abgeleitete: die Reihenfolge IST der Weg des Gastes und keine Datenfrage. */
const ABSCHNITTE = ["objekt", "checkout", "bestaetigung"] as const;
type Abschnitt = (typeof ABSCHNITTE)[number];

/** Was je Vorlage vorbereitet wurde. `null` = noch nicht geladen. */
type Vorschau = { token: string; objektId: string | null } | null;

export function StreckenWahl({
  strecken,
  sprache,
  onSchliesse,
}: {
  strecken: Strecke[];
  /** Standardsprache der Website. Sie geht in die Vorschau, damit dort dieselbe
   *  Sprache steht, die der Gast später sieht — nicht die des Bedieners. */
  sprache?: string;
  onSchliesse: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  // KEIN Anfangswert aus `strecken[0]`: die Liste wird erst geholt, wenn das
  // Fenster öffnet, ist beim ersten Rendern also leer — und `useState` zieht
  // seinen Anfangswert nicht nach, wenn sie später ankommt. Die Folge war ein
  // leeres `gewaehlt`, an dem der Token-Effekt abbrach und nie wieder ansprang:
  // die Vorlagen standen links, die Vorschau blieb für immer leer, und im
  // Server-Log fehlte der `preview-token`-Aufruf komplett.
  //
  // `null` heißt „noch keine Wahl" und wird unten aus der Liste nachgezogen.
  const [gewaehltRoh, setGewaehlt] = useState<string | null>(null);
  const gewaehlt = gewaehltRoh ?? strecken[0]?.key ?? "";
  const [abschnitt, setAbschnitt] = useState<Abschnitt>("objekt");
  // Je Vorlage EIN Token. Sie werden beim Umschalten nachgeholt und behalten:
  // ein Token je Klick wäre eine Anfrage je Klick, und sie sind ohnehin
  // kurzlebig genug (dieselbe Frist wie die Entwurfs-Vorschau).
  //
  // Behalten wird nur der ERFOLG. Ein Fehlschlag wird NICHT gemerkt: sonst hält
  // der Zustand einen Serverfehler fest, der längst behoben ist, und der Betrieb
  // sieht bis zum Neuladen der ganzen Seite weiter den alten Hinweis. Genau das
  // ist beim Bau passiert — ein 500 im Backend, danach klebte
  // „kein aktives Objekt" im Fenster, obwohl 42 aktive Objekte da waren.
  const [vorschauen, setVorschauen] = useState<Record<string, Vorschau>>({});
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [uebernimmt, setUebernimmt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nachfrage, setNachfrage] = useState(false);

  // Escape schließt — Tastaturbedienung ohne Mausweg zum X.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliesse();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [onSchliesse]);

  // Token der gewählten Vorlage holen, wenn er fehlt.
  useEffect(() => {
    if (!gewaehlt || vorschauen[gewaehlt] !== undefined) return;
    // Der Fehler der VORIGEN Vorlage gilt hier nicht mehr. Ohne diese Zeile
    // stünde er über dem neuen Versuch, und zwar so lange, wie das Fenster offen
    // ist.
    setLadefehler(null);
    let abgebrochen = false;
    void (async () => {
      const res = await createStreckePreviewToken(gewaehlt);
      if (abgebrochen) return;
      if (res.ok) {
        setVorschauen((v) => ({
          ...v,
          [gewaehlt]: {
            token: res.data.token,
            objektId: res.data.beispiel_objekt_id,
          },
        }));
      } else {
        // Der Fehler wird GEZEIGT, aber nicht GEMERKT: beim nächsten Wechsel auf
        // diese Vorlage wird neu versucht. Eine Vorschau, die stumm leer bleibt,
        // sähe aus wie eine Vorlage ohne Inhalt (Wurzel 5) — eine, die den
        // Fehler festhält, wäre eine Falschaussage über den aktuellen Zustand.
        setLadefehler(res.error);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [gewaehlt, vorschauen]);

  async function uebernehmen() {
    setUebernimmt(true);
    setFehler(null);
    const res = await applyStrecke(gewaehlt);
    setUebernimmt(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    router.refresh();
    onSchliesse();
  }

  const aktuelle = vorschauen[gewaehlt];
  // Die Objektseite braucht ein Beispielobjekt; Buchung und Bestätigung nicht
  // zwingend — der Checkout zeigt dann seinen eigenen Hinweis.
  //
  // Geprüft wird NUR mit geladener Antwort (`aktuelle`). Vorher war die
  // Bedingung `aktuelle?.objektId == null`, und die ist wahr, solange der Token
  // noch lädt: das Fenster behauptete „kein aktives Objekt", während es in
  // Wahrheit nur noch nichts wusste. Ein Ladezustand als Sachaussage auszugeben
  // ist dieselbe Falschaussage wie ein erfundener Wert (Wurzel 4) — nur fällt
  // sie noch weniger auf, weil sie plausibel klingt.
  const objektFehlt = Boolean(
    aktuelle && abschnitt === "objekt" && aktuelle.objektId == null,
  );
  const url =
    RENDERER && aktuelle
      ? `${RENDERER}/render/strecke/${encodeURIComponent(gewaehlt)}` +
        `?seite=${abschnitt}&token=${encodeURIComponent(aktuelle.token)}` +
        (sprache ? `&locale=${encodeURIComponent(sprache)}` : "") +
        (aktuelle.objektId
          ? `&objekt=${encodeURIComponent(aktuelle.objektId)}`
          : "")
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("strecke.titel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onSchliesse}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold">
              {t("strecke.titel")}
            </h2>
            <p className="pt-0.5 text-xs text-muted-foreground">
              {t("strecke.hinweis")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("editor.schliessen")}
            onClick={onSchliesse}
            className="shrink-0 text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Links: die drei Vorlagen */}
          <ul className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-4 md:w-72 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {strecken.map((s) => (
              <li key={s.key} className="shrink-0 md:shrink">
                <button
                  type="button"
                  onClick={() => setGewaehlt(s.key)}
                  aria-pressed={gewaehlt === s.key}
                  className={
                    "flex w-full flex-col gap-1 rounded-(--radius) border p-3 text-left transition " +
                    (gewaehlt === s.key
                      ? "border-foreground bg-secondary"
                      : "border-border hover:bg-secondary")
                  }
                >
                  <span className="text-sm font-semibold">
                    {t(`strecke.namen.${s.key}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`strecke.beschreibung.${s.key}`)}
                  </span>
                  <span className="pt-1 text-[0.6875rem] text-muted-foreground">
                    {t("strecke.bausteine", {
                      anzahl:
                        s.objekt_bloecke +
                        s.checkout_bloecke +
                        s.bestaetigung_bloecke,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Rechts: die echte Vorschau */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
              {ABSCHNITTE.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAbschnitt(a)}
                  aria-pressed={abschnitt === a}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium transition " +
                    (abschnitt === a
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary")
                  }
                >
                  {t(`strecke.abschnitt.${a}`)}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 bg-secondary/40 p-4">
              {!RENDERER ? (
                <Hinweis
                  icon="ph:plug"
                  text={t("vorschau.nichtKonfiguriertHinweis")}
                />
              ) : ladefehler ? (
                <Hinweis icon="ph:warning" text={ladefehler} />
              ) : objektFehlt ? (
                <Hinweis
                  icon="ph:house-line"
                  text={t("strecke.keinBeispielObjekt")}
                />
              ) : !url ? (
                <Hinweis icon="ph:hourglass" text={t("vorschau.laedtHinweis")} />
              ) : (
                <iframe
                  // `key` erzwingt ein Neuladen beim Wechsel von Vorlage oder
                  // Abschnitt. Ohne ihn behielte der iframe seine alte Adresse:
                  // React sieht dieselbe Stelle im Baum und ändert nur `src`,
                  // was manche Browser bei gleichem Origin verzögert anwenden.
                  key={`${gewaehlt}-${abschnitt}`}
                  src={url}
                  title={t("strecke.titel")}
                  className="size-full rounded-(--radius) border border-border bg-background"
                  // Kundeninhalte im iframe: Skripte und gleicher Origin ja
                  // (für die Vorschau-Brücke), Top-Level-Navigation nein.
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">
            {t("strecke.ersetztHinweis")}
          </p>
          <div className="flex items-center gap-2">
            {fehler ? (
              <span className="text-xs text-destructive">{fehler}</span>
            ) : null}
            {nachfrage ? (
              <>
                <span className="text-xs font-medium">
                  {t("strecke.wirklich")}
                </span>
                <button
                  type="button"
                  onClick={() => setNachfrage(false)}
                  className="rounded-full px-4 py-2 text-sm transition hover:bg-secondary"
                >
                  {t("strecke.abbrechen")}
                </button>
                <button
                  type="button"
                  onClick={uebernehmen}
                  disabled={uebernimmt}
                  className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {uebernimmt ? (
                    <Icon icon="ph:spinner" className="size-4 animate-spin" />
                  ) : null}
                  {t("strecke.jaErsetzen")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setNachfrage(true)}
                disabled={!gewaehlt}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("strecke.uebernehmen")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hinweis({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 rounded-(--radius) border border-dashed border-border p-6 text-center">
      <Icon icon={icon} className="size-8 text-muted-foreground" />
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
