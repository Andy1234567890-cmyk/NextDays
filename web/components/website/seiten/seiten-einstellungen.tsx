"use client";

// Seiteneinstellungen: Allgemein, SEO, Sprachen (0426).
//
// Drei Reiter in EINEM Dialog, weil es drei Fragen zu derselben Seite sind und
// der Kunde sie meist zusammen beantwortet: wie heißt sie, wie erscheint sie bei
// Google, in welchen Sprachen gibt es sie. Lodgify löst es identisch (live
// abgelesen am 23.08.2026).
//
// Warum ein Dialog und keine eigene Route: anders als bei den Reitern des
// Baukastens gibt es hier keinen Grund, einen Link zu verschicken — die Angaben
// gehören zur Seite, und wer sie ändern will, hat die Seitenliste ohnehin offen.
// Ein Dialog verliert außerdem nicht die Liste im Hintergrund.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { LOCALE_LABELS, type Locale } from "@/i18n/locales";
import {
  getPost,
  listBlogAuthors,
  publishPage,
  publishPageSingle,
  setPageAccess,
  type Beitrag,
  type Page,
  unpublishPage,
  updatePage,
  updatePost,
} from "@/lib/site-pages";

type Reiter = "allgemein" | "beitrag" | "seo" | "sprachen" | "zugang";

/** Ein `datetime-local`-Feld will „2026-08-25T09:30" — kein ISO mit Zone.
 *
 *  Umgerechnet wird in die ZEITZONE DES BEDIENERS und nicht in UTC: er plant
 *  „Freitag um neun", und das meint neun Uhr bei ihm. Der Browser rechnet beim
 *  Zurücklesen wieder in UTC um, sodass in der Datenbank ein eindeutiger
 *  Zeitpunkt steht. */
function alsFeldWert(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

/** Slug-Regel wie im Backend: a–z, 0–9 und Bindestrich. Hier NUR normalisiert,
 *  nicht geprüft — die Prüfung bleibt serverseitig, damit sie auch für den
 *  direkten API-Aufruf gilt. */
function slugifizieren(roh: string): string {
  return roh
    .toLowerCase()
    .replace(/[äàáâã]/g, "a")
    .replace(/[öòóô]/g, "o")
    .replace(/[üùúû]/g, "u")
    .replace(/[éèêë]/g, "e")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function SeitenEinstellungen({
  seite,
  /** Sprachen, die die WEBSITE führt. Nur sie sind je Seite wählbar — eine
   *  Seite in einer Sprache, die die Website nicht führt, wäre unerreichbar. */
  websiteSprachen,
  /** Aktive Domain für die Adress-Vorschau. Fehlt sie, wird KEINE Adresse
   *  gezeigt: eine geratene wäre eine Falschaussage (Wurzel 4). */
  domain,
  onSchliessen,
}: {
  seite: Page;
  websiteSprachen: string[];
  domain: string | null;
  onSchliessen: () => void;
}) {
  const t = useTranslations("website");
  const [reiter, setReiter] = useState<Reiter>("allgemein");
  const [pending, start] = useTransition();
  const titelId = useId();
  const huelle = useRef<HTMLDivElement>(null);

  const [titel, setTitel] = useState(seite.title);
  const [slug, setSlug] = useState(seite.slug);
  const [seoTitel, setSeoTitel] = useState(seite.seo_title ?? "");
  const [seoText, setSeoText] = useState(seite.seo_description ?? "");
  const [sprachen, setSprachen] = useState<string[] | null>(seite.languages);
  // Das Passwort steht NIE im Zustand einer geladenen Seite — es kommt nie aus
  // der API zurück. Hier steht nur, was der Kunde gerade tippt.
  const [passwort, setPasswort] = useState("");

  // --- Beitrag (0457) ------------------------------------------------------
  // Die Beitragsfelder kommen über einen EIGENEN Abruf und nicht aus `seite`:
  // die Seitenliste liefert nicht alle davon (der Alt-Text des Vorschaubilds
  // etwa), und ein Dialog, der die Hälfte seiner Felder leer zeigt, löscht sie
  // beim Speichern.
  const istBeitrag = seite.page_type === "post";
  const [beitrag, setBeitrag] = useState<Beitrag | null>(null);
  const [autoren, setAutoren] = useState<string[]>([]);
  const [live, setLive] = useState(seite.is_published);
  const autorenId = useId();

  useEffect(() => {
    if (!istBeitrag) return;
    let abgebrochen = false;
    void (async () => {
      const [b, a] = await Promise.all([getPost(seite.id), listBlogAuthors()]);
      if (abgebrochen) return;
      if (b.ok) setBeitrag(b.data);
      // Die Autorenliste ist eine Bequemlichkeit. Scheitert sie, bleibt das
      // Freitextfeld — kein Fehler-Toast für einen Vorschlag, den niemand
      // angefordert hat.
      if (a.ok) setAutoren(a.data.items);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [istBeitrag, seite.id]);

  /** Ein Beitragsfeld ändern. Nur im Zustand — gespeichert wird mit dem Knopf,
   *  wie bei allen anderen Feldern dieses Dialogs auch. */
  function setzeBeitrag(patch: Partial<Beitrag>) {
    setBeitrag((alt) => (alt ? { ...alt, ...patch } : alt));
  }

  /** Steht das Erscheinungsdatum in der Zukunft?
   *
   *  Das ist die ganze Planung: der Renderer vergleicht bei JEDEM Aufruf gegen
   *  die aktuelle Zeit — es gibt keinen Hintergrundlauf, der etwas freischaltet
   *  und ausfallen könnte. */
  const geplant = Boolean(
    beitrag?.published_at && new Date(beitrag.published_at).getTime() > Date.now(),
  );

  // Escape schließt, und der Fokus startet im Dialog. Ohne das bliebe er in der
  // Seitenliste hinter dem Dialog: mit der Tastatur käme man gar nicht an die
  // Felder, und Screenreader lasen weiter die Liste vor.
  useEffect(() => {
    huelle.current?.querySelector<HTMLElement>("input, button")?.focus();
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onSchliessen]);

  function speichern() {
    start(async () => {
      const res = await updatePage(seite.id, {
        title: titel.trim() || seite.title,
        slug,
        // Leere Felder werden zu `null` und nicht zu `""`: „keine
        // SEO-Beschreibung" ist das Fehlen der Angabe, kein leerer Text, den
        // Google als Beschreibung lesen würde.
        seo_title: seoTitel.trim() || null,
        seo_description: seoText.trim() || null,
        languages: sprachen,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Die Beitragsfelder gehen an ihren EIGENEN Endpunkt: sie gelten nur an
      // einem Beitrag (CHECK aus 0438), und an `updatePage` gehängt wären sie
      // an jeder Seite ein Datenbankfehler statt einer Antwort.
      if (istBeitrag && beitrag) {
        const post = await updatePost(seite.id, {
          published_at: beitrag.published_at,
          author: beitrag.author?.trim() || null,
          cover_image_url: beitrag.cover_image_url?.trim() || null,
          excerpt: beitrag.excerpt?.trim() || null,
          tags: beitrag.tags,
          og_image_url: beitrag.og_image_url?.trim() || null,
          og_image_alt: beitrag.og_image_alt?.trim() || null,
          noindex: beitrag.noindex ?? false,
        });
        if (!post.ok) {
          toast.error(post.error);
          return;
        }
      }
      toast.success(t("seiten.einstellungenGespeichert"));
      onSchliessen();
    });
  }

  // Die Startseite hat keinen Slug — ihre Adresse IST die Domain. Ein Feld dafür
  // wäre eine Falle: ein eingetragener Slug würde die Startseite verschieben und
  // die Domain zeigte danach ins Leere.
  // Eine Systemseite (0466) hat einen festen Slug: er ist das MUSTER ihrer
  // Route (`inserat/[id]`), keine frei wählbare Adresse. Ein umbenannter Slug
  // beschriebe eine Seite, die es nicht gibt — das Backend weist ihn ohnehin
  // mit 422 ab, und ein Feld, dessen Eingabe beim Speichern scheitert, ist
  // schlechter als keines.
  const systemseite = Boolean(seite.system_key);
  const slugFeld = !seite.is_home && !systemseite;
  const adresse = domain
    ? `https://${domain}/${seite.is_home ? "" : slug}`
    : null;

  // Der Beitrags-Reiter steht an ZWEITER Stelle und nur an einem Beitrag: er
  // ist das, weswegen man diesen Dialog an einem Beitrag öffnet (Datum, Autor,
  // Schlagwörter). An einer normalen Seite gäbe es dort nichts zu sehen.
  const REITER: Reiter[] = istBeitrag
    ? ["allgemein", "beitrag", "seo", "sprachen", "zugang"]
    : ["allgemein", "seo", "sprachen", "zugang"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSchliessen();
      }}
    >
      <div
        ref={huelle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={titelId} className="font-display text-lg font-extrabold">
            {t("seiten.einstellungen")}
          </h2>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t("seiten.schliessen")}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border px-5">
          {REITER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReiter(r)}
              aria-current={reiter === r ? "true" : undefined}
              className={
                "relative px-3 py-2.5 text-sm transition " +
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full " +
                (reiter === r
                  ? "font-semibold text-foreground after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t(`seiten.reiter.${r}`)}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {reiter === "allgemein" ? (
            <>
              {/* Der Name einer Systemseite steht nicht in der Datenbank: er
                  stünde dort in EINER Sprache, und diese Liste bedient 24. Er
                  kommt aus dem Katalog und ist deshalb nicht editierbar. */}
              {systemseite ? (
                <div className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("seiten.name")}</span>
                  <p className="rounded-(--radius) border border-border bg-secondary px-3 py-2 text-muted-foreground">
                    {t(`seiten.systemseiten.${seite.system_key}`)}
                  </p>
                </div>
              ) : (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("seiten.name")}</span>
                  <Input
                    value={titel}
                    maxLength={200}
                    onChange={(e) => setTitel(e.target.value)}
                  />
                </label>
              )}
              {slugFeld ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("seiten.slug")}</span>
                  <Input
                    value={slug}
                    maxLength={200}
                    onChange={(e) => setSlug(slugifizieren(e.target.value))}
                  />
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {systemseite
                    ? t("seiten.systemseiteOhneSlug", { pfad: `/${seite.slug}` })
                    : t("seiten.startseiteOhneSlug")}
                </p>
              )}
              {adresse ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("seiten.adresse")}</span>
                  <Input value={adresse} readOnly />
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("seiten.keineDomain")}
                </p>
              )}
            </>
          ) : null}

          {reiter === "beitrag" && beitrag ? (
            <>
              {/* Der Permalink — kopierbar, und erst NACH der
                  Veröffentlichung. Vorher wäre er ein Link, der ins Leere
                  führt: die Adresse existiert erst, wenn der Beitrag live ist.
                  Hostaway hält es genauso, und der Grund ist derselbe. */}
              {live ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("seiten.permalink")}</span>
                  <div className="flex gap-2">
                    <Input
                      value={
                        domain
                          ? `https://${domain}/blog/${beitrag.slug}`
                          : `/blog/${beitrag.slug}`
                      }
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(
                            domain
                              ? `https://${domain}/blog/${beitrag.slug}`
                              : `/blog/${beitrag.slug}`,
                          )
                          .then(() => toast.success(t("seiten.permalinkKopiert")))
                          // Das Schreiben in die Zwischenablage darf ohne
                          // Nutzergeste oder ohne HTTPS scheitern. Dann sagen
                          // wir es, statt so zu tun, als hätte es geklappt.
                          .catch(() => toast.error(t("seiten.permalinkFehler")));
                      }}
                      className="shrink-0 rounded-full border border-border px-4 text-sm transition hover:bg-secondary"
                    >
                      {t("seiten.permalinkKopieren")}
                    </button>
                  </div>
                </label>
              ) : (
                <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-xs">
                  {t("seiten.permalinkErstNachVeroeffentlichung")}
                </p>
              )}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.erscheintAm")}</span>
                <Input
                  type="datetime-local"
                  value={alsFeldWert(beitrag.published_at)}
                  onChange={(e) =>
                    setzeBeitrag({
                      published_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {t("seiten.erscheintAmHinweis")}
                </span>
              </label>
              {geplant ? (
                <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-xs">
                  {t("seiten.geplantHinweis")}
                </p>
              ) : null}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.autor")}</span>
                <Input
                  value={beitrag.author ?? ""}
                  maxLength={120}
                  list={autoren.length ? autorenId : undefined}
                  onChange={(e) => setzeBeitrag({ author: e.target.value })}
                />
                {/* Eine LISTE über dem Freitextfeld, kein Ersatz dafür: der
                    Autor eines Beitrags ist oft keiner unserer Benutzer
                    („Familie Jensen"), und ein gelöschter Benutzer würde den
                    Beitrag sonst anonymisieren. */}
                {autoren.length ? (
                  <datalist id={autorenId}>
                    {autoren.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {t("seiten.autorHinweis")}
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.titelbild")}</span>
                <Input
                  value={beitrag.cover_image_url ?? ""}
                  placeholder="https://"
                  onChange={(e) =>
                    setzeBeitrag({ cover_image_url: e.target.value })
                  }
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.anriss")}</span>
                <textarea
                  value={beitrag.excerpt ?? ""}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setzeBeitrag({ excerpt: e.target.value })}
                  className="w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  {t("seiten.anrissHinweis")}
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.schlagwoerter")}</span>
                <Input
                  value={(beitrag.tags ?? []).join(", ")}
                  onChange={(e) =>
                    setzeBeitrag({
                      // Aufgeteilt wird beim Tippen, damit der Server dieselbe
                      // Liste sieht wie der Bediener. Der Deckel (acht) steht
                      // im Backend und wird dort als Fehler gemeldet — hier
                      // still zu kürzen würde die Eingabe verschlucken.
                      tags: e.target.value
                        .split(",")
                        .map((w) => w.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {t("seiten.schlagwoerterHinweis")}
                </span>
              </label>

              <div className="mt-2 border-t border-border pt-4">
                <p className="text-sm font-medium">
                  {live ? t("seiten.istLive") : t("seiten.istNichtLive")}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = live
                        ? await unpublishPage(seite.id)
                        : await publishPage(seite.id);
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      setLive(!live);
                      toast.success(
                        live
                          ? t("seiten.zurueckgezogen")
                          : t("seiten.beitragVeroeffentlicht"),
                      );
                    })
                  }
                  className="mt-2 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary disabled:opacity-50"
                >
                  {live
                    ? t("seiten.veroeffentlichungAufheben")
                    : t("seiten.erneutVeroeffentlichen")}
                </button>
              </div>
            </>
          ) : null}

          {reiter === "seo" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("seiten.seoHinweis")}
              </p>
              {/* Google-Vorschau: sie macht aus zwei abstrakten Feldern ein
                  Bild, und der Kunde sieht sofort, dass sein Titel abgeschnitten
                  wird. Die Längen sind Googles übliche Kappungsgrenzen. */}
              <div className="rounded-(--radius) border border-border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">
                  {t("seiten.googleVorschau")}
                </p>
                <p className="truncate pt-2 text-xs text-muted-foreground">
                  {adresse ?? t("seiten.keineDomainKurz")}
                </p>
                <p className="truncate text-base text-[#1a0dab] dark:text-[#8ab4f8]">
                  {seoTitel.trim() || titel}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {seoText.trim() || t("seiten.seoOhneText")}
                </p>
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-baseline justify-between font-medium">
                  {t("seiten.seoTitel")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {seoTitel.length}/60
                  </span>
                </span>
                <Input
                  value={seoTitel}
                  maxLength={200}
                  placeholder={titel}
                  onChange={(e) => setSeoTitel(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-baseline justify-between font-medium">
                  {t("seiten.seoText")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {seoText.length}/160
                  </span>
                </span>
                <textarea
                  value={seoText}
                  maxLength={400}
                  rows={3}
                  onChange={(e) => setSeoText(e.target.value)}
                  className="w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </label>

              {/* Beitrags-SEO (0457).
                  Nur am Beitrag, weil nur hier der Alt-Text des Vorschaubilds
                  gepflegt werden kann — er hängt am eigenen Beitrags-Endpunkt.
                  Die Längenangaben sind Googles Kappungsgrenzen: er misst in
                  PIXELN (rund 512 für den Titel), was ungefähr 65 Zeichen
                  entspricht; unter 45 Zeichen bleibt auch auf dem Telefon alles
                  stehen. Deshalb ZWEI Zahlen und nicht eine erfundene. */}
              {istBeitrag && beitrag ? (
                <>
                  <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-xs">
                    {t("seiten.metaTitelLaenge")}
                  </p>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">
                      {t("seiten.vorschaubild")}
                    </span>
                    <Input
                      value={beitrag.og_image_url ?? ""}
                      placeholder="https://"
                      onChange={(e) =>
                        setzeBeitrag({ og_image_url: e.target.value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {t("seiten.vorschaubildHinweis")}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">
                      {t("seiten.vorschaubildAlt")}
                    </span>
                    <Input
                      value={beitrag.og_image_alt ?? ""}
                      maxLength={200}
                      // Ohne Vorschaubild ist der Alt-Text die Beschreibung von
                      // nichts. Er bleibt trotzdem sichtbar (nicht versteckt),
                      // nur nicht bedienbar — verschwundene Felder sucht man.
                      disabled={!beitrag.og_image_url?.trim()}
                      onChange={(e) =>
                        setzeBeitrag({ og_image_alt: e.target.value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {t("seiten.vorschaubildAltHinweis")}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={beitrag.noindex ?? false}
                      onChange={(e) =>
                        setzeBeitrag({ noindex: e.target.checked })
                      }
                      className="mt-0.5 size-4 accent-foreground"
                    />
                    <span>
                      <span className="font-medium">
                        {t("seiten.noindexBeitrag")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("seiten.noindexBeitragHinweis")}
                      </span>
                    </span>
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {reiter === "zugang" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("seiten.zugangHinweis")}
              </p>
              {/* Der Satz, den auch Hostaway an diese Stelle schreibt, und er
                  gehört hierher: es ist EIN Passwort für EINE Seite, kein
                  Benutzerkonto. Wer das verwechselt, erwartet Rollen und
                  „Passwort vergessen" — beides gibt es nicht. */}
              <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-xs">
                {t("seiten.zugangKeinLogin")}
              </p>
              {seite.hat_passwort ? (
                <p className="text-sm font-medium">
                  {t("seiten.zugangAktiv")}
                </p>
              ) : null}
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {t("seiten.zugangFeld")}
                </span>
                <Input
                  type="password"
                  value={passwort}
                  maxLength={100}
                  autoComplete="new-password"
                  placeholder={
                    seite.hat_passwort
                      ? t("seiten.zugangNeuPlatzhalter")
                      : t("seiten.zugangPlatzhalter")
                  }
                  onChange={(e) => setPasswort(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !passwort.trim()}
                  onClick={() =>
                    start(async () => {
                      const res = await setPageAccess(seite.id, passwort);
                      if (!res.ok) toast.error(res.error);
                      else {
                        setPasswort("");
                        toast.success(t("seiten.zugangGesetzt"));
                      }
                    })
                  }
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {t("seiten.zugangSpeichern")}
                </button>
                {seite.hat_passwort ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setPageAccess(seite.id, null);
                        if (!res.ok) toast.error(res.error);
                        else toast.success(t("seiten.zugangEntfernt"));
                      })
                    }
                    className="rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary disabled:opacity-50"
                  >
                    {t("seiten.zugangEntfernen")}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-medium">
                  {t("seiten.einzelnTitel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("seiten.einzelnHinweis")}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await publishPageSingle(seite.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.success(t("seiten.einzelnFertig"));
                    })
                  }
                  className="mt-2 rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary disabled:opacity-50"
                >
                  {t("seiten.einzelnKnopf")}
                </button>
              </div>
            </>
          ) : null}

          {reiter === "sprachen" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("seiten.sprachenHinweis")}
              </p>
              {websiteSprachen.length === 0 ? (
                <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm">
                  {t("seiten.sprachenErstEinstellen")}
                </p>
              ) : (
                <>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={sprachen === null}
                      onChange={(e) =>
                        setSprachen(e.target.checked ? null : websiteSprachen)
                      }
                      className="mt-0.5 size-4 accent-foreground"
                    />
                    <span>
                      <span className="font-medium">
                        {t("seiten.alleSprachen")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("seiten.alleSprachenHinweis")}
                      </span>
                    </span>
                  </label>
                  {sprachen !== null ? (
                    <ul className="divide-y divide-border rounded-(--radius) border border-border">
                      {websiteSprachen.map((code) => (
                        <li key={code} className="px-3 py-2">
                          <label className="flex items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={sprachen.includes(code)}
                              onChange={(e) =>
                                setSprachen((alt) => {
                                  const liste = alt ?? [];
                                  return e.target.checked
                                    ? [...liste, code]
                                    : liste.filter((c) => c !== code);
                                })
                              }
                              className="size-4 accent-foreground"
                            />
                            {LOCALE_LABELS[code as Locale] ?? code}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" onClick={onSchliessen} disabled={pending}>
            {t("seiten.abbrechen")}
          </Button>
          <Button onClick={speichern} disabled={pending}>
            {pending ? t("kopf.speichert") : t("seiten.speichern")}
          </Button>
        </div>
      </div>
    </div>
  );
}
