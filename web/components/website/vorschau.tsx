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

export type Geraet = "desktop" | "mobil";

const BREITE: Record<Geraet, string> = {
  desktop: "100%",
  mobil: "24.375rem",
};

/** Basis-URL des Renderers. Muss gesetzt sein — eine geratene (z. B.
 *  „localhost:3200") wäre in Produktion falsch (Wurzel 4).
 *
 *  `null` und nicht `""`: mit einem Leerstring entstünde die RELATIVE Adresse
 *  `/render/…`, die gegen das Dashboard läuft und dort eine 404 zeigt — ein
 *  Fehler, der wie ein kaputter Baukasten aussieht statt wie eine fehlende
 *  Einstellung. */
const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

export function VorschauFlaeche({
  geraet,
  onGeraet,
  pageId,
  token,
  tokenFehler,
  neuLaden,
  iframeRef,
  onLoad,
  rechts,
  editierbar = false,
  locale,
}: {
  geraet: Geraet;
  onGeraet: (g: Geraet) => void;
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
}) {
  const t = useTranslations("website");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Vorschau-Leiste */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
        <div className="flex items-center rounded-full bg-secondary p-0.5">
          {(["desktop", "mobil"] as Geraet[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-label={t(`vorschau.${g}`)}
              aria-pressed={geraet === g}
              title={t(`vorschau.${g}`)}
              onClick={() => onGeraet(g)}
              className={
                "rounded-full px-3 py-1 transition " +
                (geraet === g
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon
                icon={g === "desktop" ? "ph:desktop" : "ph:device-mobile"}
                className="size-4"
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">{rechts}</div>
      </div>

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
  return (
    <iframe
      ref={iframeRef}
      src={url}
      title={t("vorschau.titel")}
      onLoad={onLoad}
      style={{ width: BREITE[geraet] }}
      className="h-full rounded-(--radius) border border-border bg-background shadow-sm"
      // Der Renderer ist unsere eigene App, aber der iframe zeigt Kundeninhalte
      // (Rich-Text, Bild-URLs). sandbox begrenzt die Folgen: Skripte und gleicher
      // Origin für die postMessage-Brücke ja, Top-Level-Navigation nein.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
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
