"use client";

// Die Beitrags-Vorschau — übernommen aus dem Agentur-CMS
// (`cms/apps/admin/src/components/BlogPreview.tsx`).
//
// Sie zeigt den Beitrag so, wie ihn ein Gast liest: Titelbild, Datum, Titel,
// Schlagwörter, Anriss, Text — UND die Vorlagenfelder (0483/0485). KEIN
// Nachbau der Beitragsseite: welche Abschnitte darüber und darunter stehen,
// entscheidet die Website; ein zweiter Entwurf hier wäre eine Behauptung über
// eine Seite, die anders aussieht.
//
// WARUM DIE VORLAGENFELDER DAZUKAMEN
// ==================================
// Sie fehlten hier vollständig. Der Dialog nimmt seit 0483 Branche, Kunde,
// vollen Titel, Einleitung, Aufforderung, drei Galerien, Abschluss und vier
// Karussellbilder entgegen — die Vorschau daneben zeigte davon nichts.
//
// Gemeldet am 28.08.2026 mit der ganzen Feldliste: „das alles wird im Preview
// nicht angezeigt (im blog)". Eine Vorschau, die die Hälfte der Eingaben
// weglässt, ist schlimmer als keine: sie behauptet, so sehe der Beitrag aus.
//
// Die Reihenfolge ist die der Beitragsseite (`builder/components/blog/
// beitrag-felder.tsx`) — nicht die des Formulars. Eine Vorschau, die anders
// sortiert als die Seite, die sie vorschaut, ist eine Falschaussage.
//
// Angepasst: `renderTiptap` entfällt. Unser Beitragstext IST bereits HTML
// (beim Speichern mit `nh3` gesäubert) — das Vorbild speichert TipTap-JSON und
// muss es hier erst rendern, mit einem Erweiterungssatz, der dort nachweislich
// vom Editor abweicht (18 gegen 3).
import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

type Props = {
  titel: string;
  anriss?: string | null;
  titelbild?: string | null;
  schlagwoerter?: string[];
  /** Der Beitragstext als gesäubertes HTML. */
  text: string | null;
  /** Erscheinungsdatum; fehlt es, steht kein Datum da — kein „heute" als
   *  Ersatz (Wurzel 4/5b). Das Vorbild setzt hier das Tagesdatum ein. */
  datum?: string | null;
  /** Die Vorlagenfelder (0483) in dem Stand, den der Dialog gerade hält —
   *  nicht der gespeicherte. Wer etwas tippt, will es in der Vorschau sehen,
   *  bevor er speichert. */
  felder?: VorschauFelder;
};

/** Die Vorlagenfelder, wie die Vorschau sie braucht. Dieselben Namen wie im
 *  Dialogzustand, damit an der Übergabestelle nichts umbenannt wird. */
export type VorschauFelder = {
  branche?: string;
  kunde?: string;
  vollerTitel?: string;
  introUeberschrift?: string;
  introText?: string;
  buttonText?: string;
  websiteLink?: string;
  galerieOben?: string[];
  galerieLinks?: string | null;
  galerieRechts?: string | null;
  galerieUnten?: string[];
  finalUeberschrift?: string;
  finalText?: string;
  karussellZeigen?: boolean;
  karussell?: (string | null)[];
  /** Die eigenen Felder (0485): Name und Wert, schon aufgelöst. */
  eigene?: { name: string; wert: unknown }[];
};

/** Eine Bildreihe der Vorschau — ein Bild füllt die Breite, mehrere stehen im
 *  Raster. Dieselbe Regel wie auf der Beitragsseite. */
function Bildreihe({ bilder }: { bilder: (string | null | undefined)[] }) {
  const echte = bilder.filter((b): b is string => Boolean(b));
  if (echte.length === 0) return null;
  return (
    <div
      className={
        echte.length === 1 ? "mt-6" : "mt-6 grid grid-cols-2 gap-3"
      }
    >
      {echte.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${i}`}
          src={url}
          alt=""
          className="w-full rounded-(--radius) border border-border object-cover"
        />
      ))}
    </div>
  );
}


/** Das Karussell in der VORSCHAU — mit Pfeilen, wie auf der Website.
 *
 *  Vorher stand hier derselbe blosse Scroll-Streifen wie im Renderer: er liess
 *  sich wischen, aber mit der Maus kam man nicht weiter. Gemeldet wurde es für
 *  beide Stellen zugleich („niergends geht das karousell", 28.08.2026) — also
 *  wird es auch an beiden behoben. Eine Vorschau, in der ein Baustein anders
 *  funktioniert als auf der Seite, ist keine Vorschau.
 *
 *  Bewusst KEIN gemeinsamer Baustein mit `builder/components/blog/karussell`:
 *  die beiden Anwendungen teilen kein Paket (das ist eine Entscheidung des
 *  Monorepos, nicht meine), und ein Import quer über die App-Grenze wäre ein
 *  Bündel, das den Renderer mit Dashboard-Code füllt. Was sie teilen müssen,
 *  ist das VERHALTEN — und das steht in beiden Dateien beschrieben.
 *
 *  `object-contain`: das Bild wird NICHT beschnitten. Ein Karussell zeigt, was
 *  hochgeladen wurde; der feste Rahmen ist unser Problem, nicht seins. */
function VorschauKarussell({ bilder }: { bilder: string[] }) {
  const t = useTranslations("website");
  const spur = useRef<HTMLDivElement>(null);
  const [amAnfang, setAmAnfang] = useState(true);
  const [amEnde, setAmEnde] = useState(false);

  const messen = () => {
    const el = spur.current;
    if (!el) return;
    setAmAnfang(el.scrollLeft <= 1);
    setAmEnde(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };
  useEffect(messen, [bilder.length]);

  const blaettern = (richtung: -1 | 1) => {
    const el = spur.current;
    if (!el) return;
    const folie = el.firstElementChild as HTMLElement | null;
    const schritt = folie ? folie.offsetWidth + 12 : el.clientWidth;
    el.scrollBy({ left: richtung * schritt, behavior: "smooth" });
  };

  return (
    <div className="relative mt-6">
      <div
        ref={spur}
        onScroll={messen}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {bilder.map((url, i) => (
          <div
            key={`${url}-${i}`}
            style={{ aspectRatio: "3 / 2" }}
            className="w-2/3 shrink-0 snap-center overflow-hidden rounded-(--radius) border border-border bg-secondary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-contain" />
          </div>
        ))}
      </div>
      {!amAnfang ? (
        <button
          type="button"
          aria-label={t("blog.karussellZurueck")}
          onClick={() => blaettern(-1)}
          className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/90 p-1.5 shadow-sm transition hover:bg-background"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
      ) : null}
      {!amEnde ? (
        <button
          type="button"
          aria-label={t("blog.karussellWeiter")}
          onClick={() => blaettern(1)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/90 p-1.5 shadow-sm transition hover:bg-background"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function BeitragVorschau({
  titel,
  anriss,
  titelbild,
  schlagwoerter = [],
  text,
  datum,
  felder = {},
}: Props) {
  const t = useTranslations("website");
  const format = useFormatter();

  return (
    <div className="mx-auto max-w-2xl">
      {titelbild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={titelbild}
          alt=""
          className="mb-8 aspect-video w-full rounded-(--radius) border border-border object-cover"
        />
      ) : null}

      {datum ? (
        <div className="mb-2 text-sm text-muted-foreground">
          {format.dateTime(new Date(datum), {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      ) : null}
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {titel || t("blog.cm.ohneTitel")}
      </h1>

      {schlagwoerter.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {schlagwoerter.map((wort) => (
            <span
              key={wort}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {wort}
            </span>
          ))}
        </div>
      ) : null}

      {anriss ? (
        <p className="mt-4 text-lg text-muted-foreground">{anriss}</p>
      ) : null}

      {/* --- Die Vorlagenfelder (0483/0485) ---------------------------------
          Jedes leere Feld erzeugt NICHTS. Ein Beitrag mit nur Titel und Text
          sieht deshalb genauso aus wie vorher. */}
      {felder.branche || felder.kunde ? (
        <p className="mt-4 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          {felder.branche ? <span>{felder.branche}</span> : null}
          {felder.branche && felder.kunde ? <span aria-hidden>·</span> : null}
          {felder.kunde ? <span>{felder.kunde}</span> : null}
        </p>
      ) : null}

      {felder.vollerTitel ? (
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          {felder.vollerTitel}
        </h2>
      ) : null}

      {felder.introUeberschrift ? (
        <h3 className="mt-6 font-display text-xl font-semibold">
          {felder.introUeberschrift}
        </h3>
      ) : null}
      {felder.introText ? (
        <p className="whitespace-pre-line pt-2 text-base leading-relaxed">
          {felder.introText}
        </p>
      ) : null}

      {/* Der Knopf nur mit Ziel UND Beschriftung — genauso wie auf der
          Beitragsseite. Er ist hier bewusst NICHT anklickbar: eine Vorschau,
          die den Bearbeiter aus dem Dialog navigiert, verliert seine
          ungespeicherte Arbeit. */}
      {felder.buttonText && felder.websiteLink ? (
        <p className="mt-5">
          <span className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {felder.buttonText}
          </span>
        </p>
      ) : null}

      <Bildreihe bilder={felder.galerieOben ?? []} />
      <Bildreihe bilder={[felder.galerieLinks, felder.galerieRechts]} />
      <Bildreihe bilder={felder.galerieUnten ?? []} />

      {felder.finalUeberschrift ? (
        <h3 className="mt-6 font-display text-xl font-semibold">
          {felder.finalUeberschrift}
        </h3>
      ) : null}
      {felder.finalText ? (
        <p className="whitespace-pre-line pt-2 text-base leading-relaxed">
          {felder.finalText}
        </p>
      ) : null}

      {felder.karussellZeigen &&
      (felder.karussell ?? []).some(Boolean) ? (
        <VorschauKarussell
          bilder={(felder.karussell ?? []).filter(
            (b): b is string => Boolean(b),
          )}
        />
      ) : null}

      {(felder.eigene ?? []).length > 0 ? (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border pt-4">
          {(felder.eigene ?? []).map((e) => (
            <div key={e.name} className="contents">
              <dt className="text-sm text-muted-foreground">{e.name}</dt>
              <dd className="text-sm">
                {Array.isArray(e.wert)
                  ? (e.wert as unknown[]).join(", ")
                  : e.wert === true
                    ? "\u2713"
                    : String(e.wert)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <hr className="my-6 border-border" />

      {text ? (
        <div
          className="tiptap"
          // Der Text stammt aus dem eigenen Editor (schemabeschränkt) und ist
          // beim Speichern serverseitig durch die nh3-Allowlist gelaufen
          // (`site_config/basis._RICH_TEXT_TAGS`) — dieselbe Quelle, die auch
          // der Renderer ausgibt, kein zweiter ungeprüfter Weg.
          dangerouslySetInnerHTML={{ __html: text }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("blog.cm.keinText")}</p>
      )}
    </div>
  );
}
