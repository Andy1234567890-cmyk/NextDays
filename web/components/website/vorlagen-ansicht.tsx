"use client";

// Der Vorlagen-Reiter: links wählen, rechts sofort sehen, oben übernehmen.
//
// Aufbau nach Hostaways Abschnitts-Galerie (live abgelesen am 24.08.2026):
// Kategorien in einer schmalen Spalte, darunter die Kacheln mit Vorschaubild,
// daneben eine LIVE-Vorschau des Gewählten, und die bestätigende Aktion oben
// rechts („Save Section" dort, „Vorlage übernehmen" hier).
//
// Zwei bewusste Abweichungen:
//
// 1. Hostaway kennt nur Abschnitts-Vorlagen; eine ganze Website baut man dort
//    Seite für Seite. Wir haben beides — oben die ganze Website, darunter die
//    einzelne Seite. Wer neu anfängt, ist mit einem Klick fertig; wer schon
//    eine Website hat, nimmt sich eine Seite dazu.
// 2. Die Vorschau ist der ECHTE Renderer, nicht ein Vorschaubild. Ein Screenshot
//    zeigt fremde Farben; hier stehen die Farben und das Logo des Betriebs schon
//    drin, weil der Vorschau-Endpunkt dasselbe Branding einsetzt, das nach dem
//    Übernehmen gilt.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Logo } from "@/components/logo";
import type { CustomDomain } from "@/lib/site-config";
import {
  type Page,
  type SeitenVorlage,
  type TemplateSummary,
  applyTemplate,
  createTemplatePreviewToken,
} from "@/lib/site-pages";

import { BaukastenRahmen } from "./rahmen";
import { useVorschauToken } from "./use-vorschau-token";
import { GERAET_BREITE, type Geraet } from "./vorschau";

const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

/** Locale → Text, mit Rückfall auf Englisch und dann auf den ersten Eintrag.
 *
 *  Die Vorlagen-Texte stehen in Deutsch und Englisch, nicht in allen 24
 *  Sprachen: sie sind Beispieltexte, die der Betrieb ohnehin ersetzt. Fehlt die
 *  Sprache des Nutzers, ist Englisch die bessere Antwort als ein leeres Feld —
 *  und wenn auch das fehlt, das, was da ist. */
function text(werte: Record<string, string>, locale: string): string {
  return werte[locale] ?? werte.en ?? Object.values(werte)[0] ?? "";
}

/** Die Seitenwahl der Vorlagen-Vorschau.
 *
 *  Sie zeigt die Seiten EINER VORLAGE (`slug` + `title`), nicht die Seiten des
 *  Kunden — deshalb nicht `SeitenWahl`: die erwartet `Page[]` mit `id`,
 *  Entwurfsmarke und Buchungsstrecken-Gruppe, und all das gibt es hier nicht.
 *
 *  Was sie ersetzt, ist ein nacktes `<select>`: mitten in einer Kopfzeile, in
 *  der jedes andere Bauteil gestaltet ist, sah es aus wie ein Fremdkörper
 *  (Prüfbericht D5). Die Optik ist dieselbe wie bei `SeitenWahl` — Knopf mit
 *  Pfeil, Liste darunter, Klick nach außen schließt. */
function VorlagenSeitenWahl({
  seiten,
  aktiv,
  onWahl,
  beschriftung,
}: {
  seiten: Array<{ slug: string; title: string }>;
  aktiv: string;
  onWahl: (slug: string) => void;
  beschriftung: string;
}) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  const gewaehlt = seiten.find((p) => p.slug === aktiv) ?? seiten[0] ?? null;
  if (seiten.length === 0) return null;

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        aria-label={beschriftung}
        onClick={() => setOffen((o) => !o)}
        className="flex max-w-56 items-center gap-1.5 rounded-(--radius) px-2 py-1 text-sm font-medium transition hover:bg-secondary"
      >
        <span className="truncate">{gewaehlt?.title ?? ""}</span>
        <Icon icon="ph:caret-down" className="size-4 shrink-0" />
      </button>
      {offen ? (
        <div className="absolute left-0 top-9 z-40 flex max-h-96 w-72 flex-col overflow-y-auto rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          {seiten.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                onWahl(p.slug);
                setOffen(false);
              }}
              className={
                "truncate px-3 py-1.5 text-left text-sm transition hover:bg-secondary " +
                (p.slug === aktiv ? "font-semibold text-foreground" : "")
              }
            >
              {p.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VorlagenAnsicht({
  pages,
  domains,
  templates,
  seitenVorlagen,
  kategorien,
}: {
  pages: Page[];
  domains: CustomDomain[];
  templates: TemplateSummary[];
  seitenVorlagen: SeitenVorlage[];
  kategorien: string[];
}) {
  const t = useTranslations("website");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [geraet, setGeraet] = useState<Geraet>("desktop");
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(
    templates[0]?.id ?? null,
  );
  const [seite, setSeite] = useState("");

  const gefiltert = kategorie
    ? templates.filter((v) => v.kategorie === kategorie)
    : templates;
  const aktive = templates.find((v) => v.id === gewaehlt) ?? null;

  // Der Token hängt an der VORLAGE, nicht an der Seite: eine Vorlage hat viele
  // Seiten, und für jede einen neuen Token zu holen wäre ein Request pro Klick
  // in der Seitenliste.
  const { token, tokenFehler } = useVorschauToken(
    gewaehlt,
    createTemplatePreviewToken,
  );

  // Beim Wechsel der Vorlage zurück auf deren Startseite: die vorher gewählte
  // Unterseite gibt es in der neuen Vorlage vielleicht gar nicht, und der
  // Renderer antwortete dann mit einer 404 statt mit der Vorschau.
  useEffect(() => {
    setSeite("");
  }, [gewaehlt]);

  function uebernehmen() {
    if (!aktive) return;
    start(async () => {
      const res = await applyTemplate(aktive.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("vorlagen.angewendet"));
      router.push("/website/seiten");
      router.refresh();
    });
  }

  const vorschauUrl =
    RENDERER && aktive && token
      ? `${RENDERER}/render/vorlage/${encodeURIComponent(aktive.id)}?` +
        new URLSearchParams({ token, slug: seite, locale }).toString()
      : null;

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      panelTitel={t("reiter.vorlagen")}
      geraet={geraet}
      onGeraet={setGeraet}
      kopfLinks={
        aktive ? (
          <>
            {/* Das Logo als Anker links, wie im Editor. Ein SPRACHWÄHLER
                steht hier absichtlich NICHT: eine Vorlage trägt ihre eigenen
                Beispieltexte, keine Sprachfassungen des Kunden — der Wähler
                hätte nichts zu schalten (Wurzel 4). */}
            <Logo heightRem={1.5} />
            <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
            <VorlagenSeitenWahl
              seiten={aktive.pages}
              aktiv={seite}
              onWahl={setSeite}
              beschriftung={t("vorlagen.seiteWaehlen")}
            />
          </>
        ) : null
      }
      seitenleiste={
        <div className="flex flex-col">
          {/* Kategorien. „Alle" steht zuerst und ist die Vorgabe: wer nicht
              weiß, wonach er sucht, soll alles sehen. */}
          <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
            <KategorieKnopf
              label={t("vorlagen.alle")}
              aktiv={kategorie === null}
              onClick={() => setKategorie(null)}
            />
            {kategorien.map((k) => (
              <KategorieKnopf
                key={k}
                label={t(`vorlagen.kategorie.${k}`)}
                aktiv={kategorie === k}
                onClick={() => setKategorie(k)}
              />
            ))}
          </div>

          <h3 className="px-4 pb-1 pt-4 font-display text-sm font-extrabold">
            {t("vorlagen.ganzeWebsite")}
          </h3>
          <p className="px-4 pb-2 text-xs text-muted-foreground">
            {t("vorlagen.ganzeWebsiteHinweis")}
          </p>
          <div className="flex flex-col gap-2 px-3 pb-4">
            {gefiltert.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === gewaehlt}
                onClick={() => setGewaehlt(v.id)}
                className={
                  "overflow-hidden rounded-(--radius) border text-left transition " +
                  (v.id === gewaehlt
                    ? "border-foreground"
                    : "border-border hover:border-foreground/40")
                }
              >
                {v.preview_image ? (
                  // Bewusst <img> und nicht next/image: die Adresse ist eine
                  // Unsplash-URL aus einem Fixture, keine Datei im Projekt.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.preview_image}
                    alt=""
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                ) : null}
                <span className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="text-sm font-semibold">
                    {text(v.name, locale)}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {text(v.description, locale)}
                  </span>
                  <span className="pt-1 text-xs text-muted-foreground">
                    {t("vorlagen.seitenAnzahl", { anzahl: v.pages.length })}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Einzelne Seiten. Sie werden hier nur GEZEIGT — angelegt werden sie
              im Seiten-Reiter, weil dort der Titel und der Ort im Menü
              festgelegt werden. Ein zweiter Anlege-Weg mit eigenen Feldern wäre
              dieselbe Maske ein zweites Mal. */}
          <div className="border-t border-border">
            <h3 className="px-4 pb-1 pt-4 font-display text-sm font-extrabold">
              {t("vorlagen.einzelneSeiten")}
            </h3>
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              {t("vorlagen.einzelneSeitenHinweis")}
            </p>
            <ul className="flex flex-col px-3 pb-4">
              {seitenVorlagen.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 rounded-(--radius) px-2 py-1.5"
                >
                  <Icon
                    icon="ph:file-text"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {text(v.title, locale)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("vorlagen.abschnitte", { anzahl: v.block_count })}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-3 pb-4">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/website/seiten")}
              >
                {t("vorlagen.seiteAnlegen")}
              </Button>
            </div>
          </div>
        </div>
      }
      inhalt={
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              {aktive ? text(aktive.name, locale) : ""}
            </p>
            <Button
              size="sm"
              variant="accent"
              disabled={pending || !aktive}
              onClick={uebernehmen}
            >
              {pending
                ? t("vorlagen.uebernimmt")
                : t("vorlagen.uebernehmen")}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-3">
            <Buehne
              url={vorschauUrl}
              geraet={geraet}
              tokenFehler={tokenFehler}
            />
          </div>
        </div>
      }
    />
  );
}

function KategorieKnopf({
  label,
  aktiv,
  onClick,
}: {
  label: string;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-1 text-xs transition " +
        (aktiv
          ? "bg-foreground text-background"
          : "bg-secondary text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}

function Buehne({
  url,
  geraet,
  tokenFehler,
}: {
  url: string | null;
  geraet: Geraet;
  tokenFehler: boolean;
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
  if (tokenFehler) {
    return (
      <Hinweis
        icon="ph:warning"
        titel={t("vorschau.fehler")}
        text={t("vorschau.fehlerHinweis")}
      />
    );
  }
  if (!url) {
    return (
      <Hinweis
        icon="ph:hourglass"
        titel={t("vorschau.laedt")}
        text={t("vorschau.laedtHinweis")}
      />
    );
  }
  return (
    <iframe
      src={url}
      title={t("vorlagen.vorschauTitel")}
      style={{ width: GERAET_BREITE[geraet] }}
      className="h-full rounded-(--radius) border border-border bg-background shadow-sm"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}

function Hinweis({
  icon,
  titel,
  text: inhalt,
}: {
  icon: string;
  titel: string;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Icon icon={icon} className="size-8 text-muted-foreground" />
      <p className="font-medium">{titel}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{inhalt}</p>
    </div>
  );
}
