// Die Social-/Sonstiges-Widgets des Baukastens (0471): Social-Symbole,
// WhatsApp-Chat, RSS-Feed, Facebook-Feed, HTML-Widget.
//
// Der Teilen-Knopf (`share_button`) liegt NICHT hier, sondern in einer
// eigenen Datei (`share-button.tsx`): er ist die einzige Client-Komponente
// der sechs ("diese Seite teilen" braucht `window.location`, das gibt es
// serverseitig nicht), und `"use client"` gilt für eine ganze DATEI — es
// hätte sonst auch `RssFeedBlock` (async, ruft serverseitig ab) zur
// Client-Komponente gemacht, was Next.js nicht zulässt.
//
// Alle vier Komponenten hier sind SERVER-Komponenten — keine hat einen
// Zustand, der sich ohne Nachladen ändert.
//
// `FacebookFeedBlock` bettet Facebooks EIGENES iframe-Page-Plugin ein — genau
// wie `VideoBlock`/`AudioBlock` (medien-blocks.tsx) baut der Renderer die
// Einbettungs-Adresse SELBST aus einer geprüften `page_url` zusammen; die
// Kundeneingabe wandert nie direkt in ein `src`.
//
// `RssFeedBlock` ruft NICHT direkt beim fremden Feed ab — das würde jeden
// Gast-Seitenaufruf in einen Abruf bei einem fremden Server verwandeln
// (Wurzel 8). Es fragt stattdessen den serverseitig gecachten Vorschau-
// Endpunkt (`/api/v1/site/rss-preview`, `rss_widget.py`).
import { Icon } from "@iconify/react";

import { backendBasis } from "@/lib/backend-basis";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Überschrift eines Abschnitts — dieselbe Typografie wie in den übrigen
 *  Widget-Dateien. Eigene kleine Komponente statt Import, damit jede Datei für
 *  sich lesbar bleibt (Muster wie in `medien-blocks.tsx`/`business-blocks.tsx`). */
function Ueberschrift({ text }: { text: string }) {
  if (!text) return null;
  return (
    <h2 className="pb-6 font-display text-3xl font-extrabold tracking-tight">
      {text}
    </h2>
  );
}

// =========================================================================
// Social-Symbole
// =========================================================================

/** Dieselben sechs Netzwerke wie die Fußzeile (`site-footer.tsx`) und in
 *  derselben Reihenfolge — EINE Quelle für die Adressen (`branding.
 *  social_links`), zwei Darstellungen. Iconify-Set `simple-icons`: Phosphor
 *  (das übrige Icon-Set des Baukastens) führt keine Markenlogos. */
const NETZWERKE: Array<{ key: string; icon: string }> = [
  { key: "instagram", icon: "simple-icons:instagram" },
  { key: "facebook", icon: "simple-icons:facebook" },
  { key: "youtube", icon: "simple-icons:youtube" },
  { key: "linkedin", icon: "simple-icons:linkedin" },
  { key: "pinterest", icon: "simple-icons:pinterest" },
  { key: "tiktok", icon: "simple-icons:tiktok" },
];

function sichereUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

const GROESSEN: Record<string, string> = {
  sm: "size-8 [&_svg]:size-3.5",
  md: "size-10 [&_svg]:size-4",
  lg: "size-12 [&_svg]:size-5",
};

const STILE: Record<string, string> = {
  filled: "bg-foreground text-background hover:opacity-80",
  outline:
    "border border-border text-foreground hover:border-foreground/60 bg-transparent",
  minimal: "text-foreground/70 hover:text-primary bg-transparent",
};

const AUSRICHTUNGEN: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function SocialIconsBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  branding: SiteBranding | null;
}) {
  const headline = pickText(content.headline, modus.locale);
  const gefundene = NETZWERKE.map((n) => ({
    ...n,
    url: sichereUrl(branding?.social_links?.[n.key]),
  })).filter((n) => n.url);

  if (gefundene.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerSocialIcons}
      />
    );
  }

  const groesse = typeof content.size === "string" && GROESSEN[content.size]
    ? GROESSEN[content.size]!
    : GROESSEN.md!;
  const stil = typeof content.style === "string" && STILE[content.style]
    ? STILE[content.style]!
    : STILE.filled!;
  const ausrichtung =
    typeof content.alignment === "string" && AUSRICHTUNGEN[content.alignment]
      ? AUSRICHTUNGEN[content.alignment]!
      : AUSRICHTUNGEN.center!;
  const t = texte(modus.locale);

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <Ueberschrift text={headline} />
      <ul className={`flex flex-wrap items-center gap-3 ${ausrichtung}`}>
        {gefundene.map((n) => (
          <li key={n.key}>
            <a
              href={n.url as string}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={t.sozialOeffnen.replace("{netzwerk}", n.key)}
              className={`flex items-center justify-center rounded-full transition ${groesse} ${stil}`}
            >
              <Icon icon={n.icon} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =========================================================================
// WhatsApp-Chat
// =========================================================================

export function WhatsappChatBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const t = texte(modus.locale);
  const telefon = typeof content.phone === "string" ? content.phone : "";
  if (!telefon) {
    return <AbschnittLeer modus={modus} grund={t.leerWhatsapp} />;
  }
  const nachricht = pickText(content.message, modus.locale);
  const beschriftung =
    pickText(content.label, modus.locale) || t.whatsappChatOeffnen;
  const links = content.position === "left";
  const ziffern = telefon.replace(/\D/g, "");
  const ziel = nachricht
    ? `https://wa.me/${ziffern}?text=${encodeURIComponent(nachricht)}`
    : `https://wa.me/${ziffern}`;

  // Kein `<AbschnittLeer>`-Rahmen im Editiermodus zusätzlich zur Blase: die
  // Blase selbst ist im Editor genauso sichtbar wie live — sie liegt nur
  // ÜBER dem Abschnittsfluss (`fixed`), er nimmt in der Seite keinen Platz
  // ein.
  return (
    <a
      href={ziel}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={beschriftung}
      title={beschriftung}
      className={
        "fixed bottom-6 z-40 flex size-14 items-center justify-center rounded-full " +
        "bg-[#25D366] text-white shadow-lg transition hover:opacity-90 " +
        (links ? "left-6" : "right-6")
      }
    >
      <Icon icon="simple-icons:whatsapp" className="size-7" aria-hidden />
    </a>
  );
}

// =========================================================================
// RSS-Feed
// =========================================================================

type RssPreviewItem = {
  title: string;
  href: string | null;
  published_at: string | null;
  excerpt: string | null;
};

async function rssVorschauLaden(
  feedUrl: string,
  maxItems: number,
): Promise<RssPreviewItem[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const qs = new URLSearchParams({
      url: feedUrl,
      max_items: String(maxItems),
    });
    const res = await fetch(
      `${backendBasis()}/api/v1/site/rss-preview?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        // Der Endpunkt cacht bereits serverseitig (30 Min.) — dieselbe Frist
        // hier vermeidet einen zweiten Abruf je Gast-Seitenaufruf.
        next: { revalidate: 1800 },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const daten = (await res.json()) as { items?: RssPreviewItem[] };
    return Array.isArray(daten.items) ? daten.items : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function RssFeedBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const feedUrl = typeof content.feed_url === "string" ? content.feed_url : "";
  const t = texte(modus.locale);

  if (!feedUrl) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerRssFeed}
      />
    );
  }

  const maxItems =
    typeof content.max_items === "number" && content.max_items > 0
      ? Math.min(content.max_items, 12)
      : 6;
  const items = await rssVorschauLaden(feedUrl, maxItems);

  if (!items || items.length === 0) {
    // Live: lieber gar nichts als eine leere Fläche — der Feed kann gerade
    // nicht erreichbar sein, das ist kein Fehler dieser Seite. Im Entwurf
    // bekommt der Betrieb einen Hinweis.
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerRssFeed}
      />
    );
  }

  const zeigeDatum = content.show_date !== false;
  const zeigeAnriss = content.show_excerpt !== false;
  const neuesFenster = content.open_new_tab !== false;

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <Ueberschrift text={headline} />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((eintrag, i) => (
          <li
            key={`${eintrag.title}-${i}`}
            className="flex flex-col gap-2 rounded-2xl border border-border p-5"
          >
            {zeigeDatum && eintrag.published_at ? (
              <time
                dateTime={eintrag.published_at}
                className="text-xs font-medium text-muted-foreground"
              >
                {new Intl.DateTimeFormat(modus.locale, {
                  dateStyle: "medium",
                }).format(new Date(eintrag.published_at))}
              </time>
            ) : null}
            {eintrag.href ? (
              <a
                href={eintrag.href}
                target={neuesFenster ? "_blank" : undefined}
                rel={neuesFenster ? "noopener noreferrer" : undefined}
                className="text-base font-semibold text-foreground hover:text-primary"
              >
                {eintrag.title}
              </a>
            ) : (
              <span className="text-base font-semibold text-foreground">
                {eintrag.title}
              </span>
            )}
            {zeigeAnriss && eintrag.excerpt ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {eintrag.excerpt}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// =========================================================================
// Facebook-Feed
// =========================================================================

export function FacebookFeedBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const pageUrl = typeof content.page_url === "string" ? content.page_url : "";
  const t = texte(modus.locale);

  if (!pageUrl) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerFacebookFeed}
      />
    );
  }

  const hoehe =
    typeof content.height === "number" && content.height >= 200 && content.height <= 1200
      ? content.height
      : 500;
  const reiter =
    content.tabs === "events" || content.tabs === "messages"
      ? content.tabs
      : "timeline";

  // Die Einbettungs-Adresse baut der Renderer SELBST — genau wie bei
  // Video/Audio. `page_url` ist beim Speichern gegen `facebook.com` geprüft
  // (`_v_facebook_url`).
  const params = new URLSearchParams({
    href: pageUrl,
    tabs: reiter,
    width: "500",
    height: String(hoehe),
    adapt_container_width: "true",
    hide_cover: content.hide_cover === true ? "true" : "false",
    small_header: content.small_header === true ? "true" : "false",
    show_facepile: "false",
  });
  const src = `https://www.facebook.com/plugins/page.php?${params.toString()}`;

  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      <Ueberschrift text={headline} />
      <div className="overflow-hidden rounded-2xl" style={{ height: hoehe }}>
        <iframe
          src={src}
          title={headline || t.facebookFeedTitel}
          loading="lazy"
          className="size-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}

// =========================================================================
// HTML-Widget
// =========================================================================

export function HtmlWidgetBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const html = sanitizeHtml(pickText(content.html, modus.locale));
  if (!html.trim()) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerHtmlWidget} />
    );
  }
  return (
    <section
      className="mx-auto max-w-5xl px-6 py-10"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
