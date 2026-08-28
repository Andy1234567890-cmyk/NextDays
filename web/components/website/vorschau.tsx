"use client";

// Live-Vorschau: der ECHTE Renderer im iframe, mit Geräte-Umschalter darüber.
//
// Nicht eine zweite Nachbildung der Abschnitte im Dashboard. Der Doppel-Renderer
// war vorher der offene Divergenz-Herd: Editor und Live-Seite hatten je eine
// eigene Implementierung jedes Blocks, und was im Editor gut aussah, konnte live
// anders aussehen. Hier läuft dieselbe Datei, die der Gast sieht.
//
// Zugriff über einen kurzlebig signierten Draft-Token (HMAC, 1 h). Fehlt er, gibt
// es KEINE Vorschau — der Draft-Endpunkt ist fail-closed, und das soll er sein:
// ein offener Entwurfs-Renderer wäre ein Leseweg in unveröffentlichte Seiten.
//
// Der Umschalter ändert nur die BREITE. Es gibt bewusst keinen zweiten
// Mobil-Editor: eine von Hand gepflegte Mobil-Fassung ist doppelte Arbeit und
// die häufigste Ursache für „sieht auf dem Handy kaputt aus".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";

export type Geraet = "desktop" | "tablet" | "mobil";

/** Bühnenbreite je Gerät.
 *
 *  Die Werte liegen MITTEN in ihrem CSS-Bereich und nicht auf dessen Kante:
 *  820 px steht sicher zwischen `md` (768) und `lg` (1024), 390 px sicher
 *  darunter. Läge die Tablet-Bühne auf 768, entschiede ein Pixel Scrollbalken
 *  darüber, ob der Renderer den Tablet- oder den Mobil-Zustand zeigt — und der
 *  Kunde sähe beim Ausblenden das Gegenteil dessen, was er eingestellt hat. */
export const GERAET_BREITE: Record<Geraet, string> = {
  desktop: "100%",
  tablet: "51.25rem",
  mobil: "24.375rem",
};

/** Symbol je Gerät — dieselbe Reihenfolge wie im Umschalter, von breit nach
 *  schmal. Als eigene Karte, damit „welches Symbol steht für Tablet" an EINER
 *  Stelle steht und nicht in vier Ternären über drei Dateien. */
export const GERAET_SYMBOL: Record<Geraet, string> = {
  desktop: "ph:desktop",
  tablet: "ph:device-tablet",
  mobil: "ph:device-mobile",
};

/** Basis-URL des Renderers. Muss gesetzt sein — eine geratene (z. B.
 *  „localhost:3200") wäre in Produktion falsch (Wurzel 4).
 *
 *  `null` und nicht `""`: mit einem Leerstring entstünde die RELATIVE Adresse
 *  `/render/…`, die gegen das Dashboard läuft und dort eine 404 zeigt — ein
 *  Fehler, der wie ein kaputter Baukasten aussieht statt wie eine fehlende
 *  Einstellung. */
const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

/** Geräte-Umschalter der Kopfzeile.
 *
 *  Er steht hier und nicht mehr in der Vorschau-Leiste: bei Hostaway sitzt er in
 *  der obersten Zeile und gilt für den ganzen Editor. Vorher hing er am
 *  Seiten-Reiter — wer im Design-Reiter eine Schriftgröße wählte, konnte nicht
 *  nachsehen, wie sie auf dem Telefon wirkt, obwohl genau dort die Probleme
 *  entstehen. */
export function GeraeteUmschalter({
  geraet,
  onGeraet,
}: {
  geraet: Geraet;
  onGeraet: (g: Geraet) => void;
}) {
  const t = useTranslations("website");
  return (
    // Heller Sammelkasten, aktiver Knopf als WEISSE Karte mit Markenfarbe im
    // Symbol — genau so steht es im Vorbild. Vorher war der aktive Knopf ein
    // dunkler Vollton: das las sich als „gedrückt gehalten", nicht als
    // „das ist die aktuelle Ansicht", und es war derselbe Ton wie der der
    // Haupthandlung im Kopf.
    <div className="flex items-center gap-0.5 rounded-(--radius) bg-secondary p-0.5">
      {GERAETE_REIHE.map((g) => (
        <button
          key={g}
          type="button"
          aria-label={t(`vorschau.${g}`)}
          aria-pressed={geraet === g}
          title={t(`vorschau.${g}`)}
          onClick={() => onGeraet(g)}
          className={
            "rounded-[calc(var(--radius)-0.125rem)] px-2.5 py-1.5 transition " +
            (geraet === g
              ? "bg-background text-(--brand) shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon icon={GERAET_SYMBOL[g]} className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Reihenfolge im Umschalter: breit nach schmal, wie im Vorbild. */
const GERAETE_REIHE: readonly Geraet[] = ["desktop", "tablet", "mobil"];

export function VorschauFlaeche({
  geraet,
  pageId,
  token,
  tokenFehler,
  neuLaden,
  iframeRef,
  onLoad,
  rechts,
  editierbar = false,
  locale,
  overlay,
  fremdeUrl = null,
}: {
  /** Die Breite der Bühne. Der UMSCHALTER dazu steht in der Kopfzeile des
   *  Baukastens (`BaukastenRahmen`), nicht mehr hier: er gilt für den ganzen
   *  Editor, nicht nur für diese eine Fläche. */
  geraet: Geraet;
  /** null = keine Seite gewählt (z. B. Design-Reiter ohne Seiten). */
  pageId: string | null;
  token: string | null;
  tokenFehler: boolean;
  neuLaden: number;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  onLoad?: () => void;
  /** Zusatzanzeige in der Vorschau-Leiste (z. B. Speicherstand). */
  rechts?: ReactNode;
  /** true = Textstellen in der Vorschau sind anklickbar und bearbeitbar.
   *  Nur im Seiten-Editor; im Design-Reiter wäre es eine Ablenkung. */
  editierbar?: boolean;
  /** Sprache, die gezeigt UND bearbeitet wird. */
  locale?: string;
  /** Eine ABWEICHENDE Adresse für den iframe.
   *
   *  Gesetzt, wenn nicht die eigene Seite gezeigt wird, sondern etwas anderes —
   *  heute die Vorschau einer Vorlage. Die Fläche bleibt dieselbe, damit der
   *  Kunde nicht die Umgebung wechselt, um sich eine Vorlage anzusehen.
   *
   *  Sie ersetzt `pageId` und `token` vollständig: eine Adresse, die aus beidem
   *  gemischt entstünde, wäre in der Hälfte der Fälle falsch. */
  fremdeUrl?: string | null;
  /** Die Auswahl-Schicht, die DECKUNGSGLEICH auf dem iframe liegt.
   *
   *  Sie kommt von außen und wird hier nur platziert: die Vorschau weiß nichts
   *  über Abschnitte, Auswahl oder Rechtecke — sie weiß, wo der iframe hängt.
   *  Genau diese Trennung erlaubt es, dieselbe Fläche in jedem Reiter zu
   *  zeigen und die Bedienung nur dort mitzugeben, wo sie hingehört. */
  overlay?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Vorschau-Leiste. Sie erscheint nur, wenn es etwas anzuzeigen gibt —
          eine leere Leiste wäre ein Streifen ohne Inhalt über der Bühne. */}
      {rechts ? (
        <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-3 py-2">
          {rechts}
        </div>
      ) : null}

      {/* Bühne */}
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-3">
        <Inhalt
          geraet={geraet}
          pageId={pageId}
          token={token}
          tokenFehler={tokenFehler}
          neuLaden={neuLaden}
          iframeRef={iframeRef}
          onLoad={onLoad}
          editierbar={editierbar}
          locale={locale}
          overlay={overlay}
          fremdeUrl={fremdeUrl}
        />
      </div>
    </div>
  );
}

function Inhalt({
  geraet,
  pageId,
  token,
  tokenFehler,
  neuLaden,
  iframeRef,
  onLoad,
  editierbar,
  locale,
  overlay,
  fremdeUrl,
}: {
  geraet: Geraet;
  pageId: string | null;
  token: string | null;
  tokenFehler: boolean;
  neuLaden: number;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  onLoad?: () => void;
  editierbar?: boolean;
  locale?: string;
  overlay?: ReactNode;
  fremdeUrl?: string | null;
}) {
  const t = useTranslations("website");

  if (!RENDERER) {
    return (
      <Hinweis
        icon="ph:plug"
        titel={t("vorschau.nichtKonfiguriert")}
        text={t("vorschau.nichtKonfiguriertHinweis")}
      />
    );
  }
  // Eine fremde Adresse gewinnt über alles: sie braucht weder Seite noch
  // Entwurfs-Token, und die Prüfungen darunter würden sie fälschlich abweisen.
  if (fremdeUrl) {
    return (
      <div className="relative h-full" style={{ width: GERAET_BREITE[geraet] }}>
        <iframe
          ref={iframeRef}
          src={fremdeUrl}
          title={t("vorschau.titel")}
          onLoad={onLoad}
          className="h-full w-full rounded-(--radius) border border-border bg-background shadow-sm"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        {overlay}
      </div>
    );
  }
  if (!pageId) {
    return (
      <Hinweis
        icon="ph:file-dashed"
        titel={t("vorschau.keineSeite")}
        text={t("vorschau.keineSeiteHinweis")}
      />
    );
  }
  if (tokenFehler) {
    return (
      <Hinweis
        icon="ph:warning"
        titel={t("vorschau.fehler")}
        text={t("vorschau.fehlerHinweis")}
      />
    );
  }
  if (!token) {
    return (
      <Hinweis
        icon="ph:hourglass"
        titel={t("vorschau.laedt")}
        text={t("vorschau.laedtHinweis")}
      />
    );
  }

  // `edit` schaltet im Renderer nur die Editier-Marker frei; der Zugriff hängt
  // weiter am Token. `locale` bestimmt, welche Sprache gezeigt und bearbeitet
  // wird — ohne sie zeigte die Vorschau eine andere Sprache als das Formular.
  const params = new URLSearchParams({ token });
  if (editierbar) params.set("edit", "1");
  if (locale) params.set("locale", locale);
  // Der Zähler wandert in die ADRESSE, nicht in den React-`key`.
  //
  // Mit `key={neuLaden}` baute React den iframe bei jedem gespeicherten
  // Tastendruck komplett neu auf: die Vorschau flackerte im Sekundenrhythmus und
  // sprang an den Seitenanfang zurück. Ein geänderter `src` lädt dasselbe
  // Element neu — die Bildlaufposition bleibt, solange der Browser sie halten
  // kann, und es gibt keinen weißen Blitz.
  params.set("v", String(neuLaden));
  const url = `${RENDERER}/render/${encodeURIComponent(pageId)}?${params.toString()}`;
  // Der Rahmen ist so breit wie der iframe und `relative` — nur so liegt die
  // Auswahl-Schicht deckungsgleich darauf. Läge sie stattdessen auf der Bühne,
  // wäre sie in der Mobilansicht um den halben Rand daneben, weil die Bühne
  // zentriert und der iframe dann nur 390 px breit ist.
  return (
    <div className="relative h-full" style={{ width: GERAET_BREITE[geraet] }}>
      <iframe
        ref={iframeRef}
        src={url}
        title={t("vorschau.titel")}
        onLoad={onLoad}
        className="h-full w-full rounded-(--radius) border border-border bg-background shadow-sm"
        // Der Renderer ist unsere eigene App, aber der iframe zeigt Kundeninhalte
        // (Rich-Text, Bild-URLs). sandbox begrenzt die Folgen: Skripte und gleicher
        // Origin für die postMessage-Brücke ja, Top-Level-Navigation nein.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      {overlay}
    </div>
  );
}

function Hinweis({
  icon,
  titel,
  text,
}: {
  icon: string;
  titel: string;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Icon icon={icon} className="size-8 text-muted-foreground" />
      <p className="font-medium">{titel}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
