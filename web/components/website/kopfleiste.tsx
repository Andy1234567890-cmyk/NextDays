"use client";

// Die Bauteile der KOPFZEILE des Baukastens — 1:1 nach `docs/UI`.
//
//     ≡ Logo │ Seite ⌄ │ 🏳 ⌄   ║  🖥 ▭ ▯  ║   ↺ ↻ ✓ ⤴ Vorschau [Publish] ⌂
//     └──── Kontext ────┘       └ Brille ┘   └────────── Aktionen ──────────┘
//
// Hier stehen die drei, die es noch nicht gab: die SPRACHWAHL, das Paar
// RÜCKGÄNGIG/WIEDERHOLEN und das SPEICHER-HÄKCHEN. Die Seitenwahl steht in
// `seiten-wahl.tsx`, der Geräte-Umschalter in `vorschau.tsx` — beide gab es
// schon und beide bleiben, wo sie sind.
//
// WARUM RÜCKGÄNGIG EIN EIGENES BAUTEIL IST UND KEIN KNOPF IM EDITOR
// Der Verlauf gehört dem, der die Daten hält (dem Editor), die DARSTELLUNG aber
// in die Kopfzeile — und die Kopfzeile trägt auch der Design-Reiter, der keinen
// Abschnitts-Verlauf hat. Ein Bauteil, das nur zwei Knöpfe und zwei Rückrufe
// kennt, lässt sich an beiden Orten zeigen; einer, der den Verlauf selbst
// führte, wäre an einem der beiden falsch.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { LOCALE_FLAGS, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { type Page, createDraftToken, publishPage } from "@/lib/site-pages";

/** Adresse des Renderers. Ohne sie gibt es keine Vorschau — dann entfällt der
 *  Entwurfs-Eintrag, statt auf eine leere Adresse zu führen. */
const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

import type { SpeicherStand } from "./schale";

/**
 * Sprachwahl der Kopfzeile.
 *
 * Sie schaltet um, WELCHE Sprachfassung der Editor zeigt und bearbeitet. Vorher
 * gab es sie nicht: bearbeitet wurde immer die Sprache des Dashboards, also
 * konnte ein deutscher Betrieb die englische Fassung seiner Website nur
 * erreichen, indem er sein eigenes Dashboard auf Englisch stellte — und danach
 * jede Beschriftung im Dashboard ebenfalls (0426).
 *
 * Gezeigt werden NUR die Sprachen, die die Website führt (`branding.languages`).
 * Alle 24 anzubieten hieße, in eine Fassung zu tippen, die der Renderer nie
 * ausliefert.
 */
export function SprachWahl({
  sprachen,
  gefuehrt,
  aktiv,
  standard,
  onWahl,
  verwaltenHref,
}: {
  /** Die Sprachen, die zur Wahl stehen — im Baukasten alle 24 EU-Amtssprachen.
   *  Der Editor kann jede Fassung bearbeiten, auch eine noch nicht geführte. */
  sprachen: Locale[];
  /** Die davon, die die Website AUSLIEFERT (`branding.languages`). Sie
   *  bestimmen allein die REIHENFOLGE — geführte Sprachen stehen oben, weil
   *  man sie im Alltag wählt. Sie tragen bewusst KEINE Markierung: bearbeitbar
   *  sind alle 24 gleichermaßen, und eine Marke an den übrigen sähe wie eine
   *  Einschränkung aus, die es nicht gibt. Leer = die Website führt noch
   *  keine; dann entscheidet die alphabetische Ordnung. */
  gefuehrt: Locale[];
  aktiv: Locale;
  /** Die Standardsprache — sie trägt den Zusatz „(Standard)". Ohne ihn sieht
   *  eine Liste aus vier Sprachen aus, als wären alle gleichrangig, und niemand
   *  weiß, welche ein Gast ohne Sprachwunsch bekommt. */
  standard: Locale | null;
  onWahl: (l: Locale) => void;
  /** Ziel des Eintrags „Sprachen verwalten" ganz oben — genau wie im Vorbild
   *  („Manage Languages"). */
  verwaltenHref: string;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const huelle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  // Die Sprachwahl steht IMMER in der Kopfzeile — auch wenn die Website noch
  // keine oder nur eine Sprache führt (Vorgabe vom 26.08.2026).
  //
  // Vorher blendete sie sich bei `sprachen.length <= 1` aus. Das war als
  // „ein Menü mit einem Eintrag ist ein Klick ohne Wirkung" gedacht, hatte in
  // der Praxis aber die Wirkung, dass die Kopfzeile bei einem frisch
  // angelegten Betrieb (beide Felder leer) gar keinen Sprachpunkt zeigte —
  // also genau dort fehlte, wo man ihn braucht, um die erste Sprache
  // einzustellen. Ein Bedienelement, das sich versteckt, solange es nichts zu
  // wählen gibt, ist kein Aufgeräumtsein, sondern eine Sackgasse.
  //
  // Führt die Website noch nichts, bleibt der Eintrag „Sprachen verwalten"
  // stehen und ist der Weg dorthin.

  // 24 Einträge sind zu viele für eine Liste, die man durchsieht — im Bild
  // reichte sie über den ganzen Bildschirm. Zwei Mittel dagegen:
  //   · Ein Suchfeld ab einer Schwelle (Empfehlung aus der Recherche in
  //     `components/sprache-auswahl.tsx`: ab grob 25 Einträgen). Es sucht über
  //     Endonym, deutschen Namen und Kürzel — wer „DE" tippt, „Deutsch" oder
  //     „Deutschland" meint dasselbe.
  //   · Eine Höhengrenze mit Scroll, damit das Menü nie länger als der
  //     Bildschirm wird.
  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const treffer = q
      ? sprachen.filter(
          (l) =>
            l.includes(q) ||
            LOCALE_LABELS[l].toLowerCase().includes(q),
        )
      : sprachen;
    // Die GEFÜHRTEN zuerst, darin der Standard ganz oben — das sind die, die
    // man im Alltag wählt. Alphabetisch über alle 24 hieße: die eine Sprache,
    // die der Betrieb wirklich pflegt, steht irgendwo zwischen Bulgarisch und
    // Schwedisch.
    return [...treffer].sort((a, b) => {
      if (a === standard) return -1;
      if (b === standard) return 1;
      const ga = gefuehrt.includes(a) ? 0 : 1;
      const gb = gefuehrt.includes(b) ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return LOCALE_LABELS[a].localeCompare(LOCALE_LABELS[b]);
    });
  }, [sprachen, gefuehrt, standard, suche]);

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        aria-label={t("kopf.sprache")}
        title={t("kopf.sprache")}
        onClick={() => setOffen((o) => !o)}
        className="flex items-center gap-1 rounded-(--radius) px-2 py-1.5 text-sm font-medium transition hover:bg-secondary"
      >
        <Icon icon={LOCALE_FLAGS[aktiv]} className="size-4 shrink-0" />
        <span className="uppercase">{aktiv}</span>
        <Icon icon="ph:caret-down" className="size-3.5 text-muted-foreground" />
      </button>
      {offen ? (
        <div className="absolute left-0 top-9 z-40 flex w-60 flex-col rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          <a
            href={verwaltenHref}
            onClick={() => setOffen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-secondary/60"
          >
            <Icon icon="ph:translate" className="size-4 shrink-0" />
            {t("kopf.sprachenVerwalten")}
          </a>
          <span aria-hidden className="my-1 block h-px bg-border" />
          {/* Suchfeld — nur wenn die Liste lang genug ist, dass man sucht. Bei
              drei geführten Sprachen wäre es ein leeres Feld über drei
              Zeilen. */}
          {sprachen.length > 12 ? (
            <div className="relative px-2 pb-1">
              <Icon
                icon="ph:magnifying-glass"
                className="pointer-events-none absolute left-4 top-2.5 size-3.5 text-muted-foreground"
              />
              <input
                type="search"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder={t("kopf.spracheSuchen")}
                aria-label={t("kopf.spracheSuchen")}
                className="w-full rounded-(--radius) border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-ring"
              />
            </div>
          ) : null}
          {/* Höhengrenze mit Scroll: 24 Zeilen sind länger als der Bildschirm.
              `overscroll-contain` verhindert, dass das Weiterscrollen am Ende
              die Seite DAHINTER bewegt. */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
          {gefiltert.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t("kopf.spracheKeinTreffer")}
            </p>
          ) : null}
          {gefiltert.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                onWahl(l);
                setOffen(false);
              }}
              aria-current={l === aktiv ? "true" : undefined}
              className={
                "flex items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-secondary/60 " +
                (l === aktiv ? "bg-secondary font-medium" : "")
              }
            >
              <Icon icon={LOCALE_FLAGS[l]} className="size-4 shrink-0" />
              <span className="w-6 shrink-0 text-xs uppercase text-muted-foreground">
                {l}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {LOCALE_LABELS[l]}
              </span>
              {/* NUR der Standard wird markiert — nichts sonst.
                  Vorher stand an den übrigen 22 Zeilen eine Marke für „liefert
                  die Website noch nicht aus". Das war eine falsche Aussage über
                  den Editor: JEDE der 24 Fassungen lässt sich hier vollständig
                  bearbeiten, es gibt keine zweite Klasse. Eine Marke, die wie
                  eine Einschränkung aussieht, wo keine ist, hält Leute von
                  Funktionen ab, die es gibt. Was die Website ausliefert, ist
                  eine Frage der Einstellungen — der Weg dorthin steht oben im
                  Menü. */}
              {l === standard ? (
                <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                  {t("kopf.sprachStandard")}
                </span>
              ) : null}
            </button>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rückgängig und Wiederholen.
 *
 * Zwei Knöpfe, kein Menü, keine Beschriftung — im Vorbild stehen sie als
 * nacktes Pfeilpaar links neben dem Speicher-Häkchen, und das ist auch die
 * Reihenfolge, in der man sie sucht: erst „zurück", dann „doch wieder hin",
 * dann „ist es gespeichert".
 *
 * Ein deaktivierter Knopf bleibt STEHEN und verschwindet nicht. Ein Paar, das
 * je nach Verlauf mal ein und mal zwei Symbole zeigt, verschiebt bei jedem
 * Tastendruck alles rechts davon.
 */
export function VerlaufKnoepfe({
  kannZurueck,
  kannVor,
  onZurueck,
  onVor,
}: {
  kannZurueck: boolean;
  kannVor: boolean;
  onZurueck: () => void;
  onVor: () => void;
}) {
  const t = useTranslations("website");
  return (
    <div className="flex items-center">
      <KopfSymbol
        icon="ph:arrow-counter-clockwise"
        label={t("kopf.rueckgaengig")}
        disabled={!kannZurueck}
        onClick={onZurueck}
      />
      <KopfSymbol
        icon="ph:arrow-clockwise"
        label={t("kopf.wiederholen")}
        disabled={!kannVor}
        onClick={onVor}
      />
    </div>
  );
}

/**
 * Das Speicher-Häkchen der Kopfzeile.
 *
 * Es sagt dasselbe wie `SpeicherAnzeige`, aber als SYMBOL an fester Stelle —
 * genau so steht es im Vorbild, zwischen den Verlaufspfeilen und „Vorschau".
 *
 * Der Unterschied zur Textanzeige ist nicht kosmetisch: die Textanzeige
 * erscheint und verschwindet, also wandert alles daneben. Dieses Symbol steht
 * IMMER da und wechselt nur seine Gestalt — ruhendes Häkchen, drehender Ring,
 * rotes Warndreieck. Ein Zustand, dessen Anzeige die Nachbarn verschiebt, wird
 * beim Arbeiten nicht gelesen, sondern als Zucken wahrgenommen.
 */
export function SpeicherHaken({ stand }: { stand: SpeicherStand }) {
  const t = useTranslations("website");
  if (stand === "speichert") {
    return (
      <span
        title={t("kopf.speichert")}
        aria-label={t("kopf.speichert")}
        role="status"
        className="flex size-8 items-center justify-center text-muted-foreground"
      >
        <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
      </span>
    );
  }
  if (stand === "fehler") {
    return (
      <span
        title={t("kopf.speicherFehler")}
        aria-label={t("kopf.speicherFehler")}
        role="status"
        className="flex size-8 items-center justify-center text-destructive"
      >
        <Icon icon="ph:warning" className="size-4" />
      </span>
    );
  }
  // „ruht" und „gespeichert" sehen gleich aus, und das ist richtig: beide
  // heißen „es ist nichts offen". Ein eigener Ruhezustand („noch nie
  // gespeichert") wäre eine Unterscheidung ohne Folge für den Kunden.
  return (
    <span
      title={t("kopf.gespeichert")}
      aria-label={t("kopf.gespeichert")}
      role="status"
      className={
        "flex size-8 items-center justify-center transition-colors " +
        (stand === "gespeichert" ? "text-(--brand)" : "text-muted-foreground")
      }
    >
      <Icon icon="ph:check" className="size-4" />
    </span>
  );
}

export function WebsiteAnsehen({
  pages,
  liveDomain,
}: {
  pages: Page[];
  liveDomain: string | null;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const [entwurfUrl, setEntwurfUrl] = useState<string | null>(null);
  const [holt, setHolt] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  const startseite = pages.find((p) => p.is_home) ?? pages[0] ?? null;

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  // NUR die ID als Abhängigkeit, nicht das Seiten-Objekt: `startseite` kommt aus
  // `pages.find(...)` und ist bei jedem Render ein NEUES Objekt. Stand es in der
  // Liste, lief der Effekt bei jedem Render neu — und weil `setHolt(true)` selbst
  // einen Render auslöst, setzte das Cleanup `lebt = false`, BEVOR die Antwort
  // ankam. Danach verwarf `if (!lebt) return` das Ergebnis, `holt` blieb true, und
  // im Menü stand für immer „Entwurf wird vorbereitet …" (live gesehen am
  // 24.08.2026). `holt` gehört aus demselben Grund nicht in die Liste: es triggert
  // sich sonst selbst.
  const startseitenId = startseite?.id ?? null;
  useEffect(() => {
    if (!offen || !startseitenId || !RENDERER) return;
    let lebt = true;
    setHolt(true);
    createDraftToken(startseitenId)
      .then((res) => {
        if (!lebt) return;
        if (res.ok) {
          setEntwurfUrl(
            `${RENDERER}/render/${startseitenId}?token=${encodeURIComponent(res.data.token)}`,
          );
        }
        // Bei einem abgelehnten Token bleibt der Entwurfs-Eintrag aus. Ein Link,
        // der auf eine 404 führt, wäre schlechter als keiner — der Live-Eintrag
        // bleibt.
      })
      .catch(() => {
        // Wirft die Server-Action (Netzfehler, 500, abgebrochene Anfrage), lief
        // vorher NIE ein `setHolt(false)` — die Meldung „wird vorbereitet" stand
        // dann bis zum Neuladen. Fehler sind hier ein normaler Ausgang, kein
        // Sonderfall (Wurzel 5): der Zustand muss aufgelöst werden, auch wenn es
        // nichts zu zeigen gibt.
      })
      .finally(() => {
        if (lebt) setHolt(false);
      });
    return () => {
      lebt = false;
    };
  }, [offen, startseitenId]);

  if (!startseite && !liveDomain) return null;

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        {t("kopf.websiteAnsehen")}
        <Icon icon="ph:caret-down" className="size-4" />
      </button>
      {offen ? (
        <div className="absolute right-0 top-8 z-40 flex w-72 flex-col rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          {entwurfUrl ? (
            <a
              href={entwurfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOffen(false)}
              className="flex items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-secondary/60"
            >
              <Icon icon="ph:eye" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("kopf.entwurfAnsehen")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("kopf.entwurfHinweis")}
                </span>
              </span>
            </a>
          ) : (
            <p className="px-4 py-2.5 text-sm text-muted-foreground">
              {holt ? t("kopf.entwurfLaedt") : t("kopf.entwurfNichtMoeglich")}
            </p>
          )}
          {liveDomain ? (
            <a
              href={`https://${liveDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOffen(false)}
              className="flex items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-secondary/60"
            >
              <Icon icon="ph:globe" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("kopf.liveAnsehen")}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {liveDomain}
                </span>
              </span>
            </a>
          ) : (
            <p className="px-4 py-2.5 text-sm text-muted-foreground">
              {t("kopf.keineLiveDomain")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Der Veröffentlichen-Knopf.
 *
 *  Er lag als Inline-Code in `rahmen.tsx` und war damit an EINE Kopfzeile
 *  gebunden — die Übersicht hatte ihn, der Editor nicht. Wer im Editor fertig
 *  wurde, musste erst zurück zur Übersicht, um zu veröffentlichen; das Vorbild
 *  (Hostaway) hat den Knopf an beiden Stellen, und zwar denselben.
 *
 *  Als Bauteil hier, nicht als Kopie dort: zwei Fassungen desselben Knopfes
 *  wären zwei Stellen, an denen die Entwurfs-Regel unten hängt — und die eine,
 *  die beim nächsten Mal vergessen wird (Wurzel 2). */
export function VeroeffentlichenKnopf({
  pages,
  onVeroeffentlicht,
}: {
  pages: Page[];
  onVeroeffentlicht?: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();

  function veroeffentlichen() {
    // Entwürfe bleiben liegen (0443). Genau dafür gibt es sie: ohne diese
    // Zeile nimmt der Knopf jede halbfertige Seite mit — und der Kunde merkt
    // es erst, wenn ein Gast sie sieht.
    const offen = pages.filter((p) => !p.is_published && !p.is_draft);
    if (offen.length === 0) {
      toast.info(t("kopf.nichtsZuVeroeffentlichen"));
      return;
    }
    start(async () => {
      for (const p of offen) {
        const res = await publishPage(p.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
      }
      toast.success(t("kopf.veroeffentlicht", { anzahl: offen.length }));
      router.refresh();
      onVeroeffentlicht?.();
    });
  }

  return (
    <Button
      size="sm"
      variant="accent"
      disabled={pending || pages.length === 0}
      onClick={veroeffentlichen}
    >
      {pending ? t("kopf.veroeffentlicht0") : t("kopf.veroeffentlichen")}
    </Button>
  );
}

/** Ein nacktes Symbol in der Kopfzeile — die Grundform für alle Aktionen
 *  rechts. Als eigenes Bauteil, damit Größe, Rundung und Hover an EINER Stelle
 *  stehen; vorher trug jeder Knopf seine eigene Klassenkette, und sie waren
 *  nicht dieselben. */
export function KopfSymbol({
  icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  /** Ziel, wenn das Symbol NAVIGIERT (Vorschau in neuem Tab, Baukasten
   *  verlassen). Dann wird ein Link gerendert — Mittelklick und „in neuem Tab
   *  öffnen" funktionieren, was bei einem Knopf mit `router.push` nicht der
   *  Fall wäre. */
  href?: string;
  disabled?: boolean;
}) {
  const klasse =
    "flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className={klasse}
      >
        <Icon icon={icon} className="size-4" />
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={klasse}
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
