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
import { type Page, updatePage } from "@/lib/site-pages";

type Reiter = "allgemein" | "seo" | "sprachen";

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
      toast.success(t("seiten.einstellungenGespeichert"));
      onSchliessen();
    });
  }

  // Die Startseite hat keinen Slug — ihre Adresse IST die Domain. Ein Feld dafür
  // wäre eine Falle: ein eingetragener Slug würde die Startseite verschieben und
  // die Domain zeigte danach ins Leere.
  const slugFeld = !seite.is_home;
  const adresse = domain
    ? `https://${domain}/${seite.is_home ? "" : slug}`
    : null;

  const REITER: Reiter[] = ["allgemein", "seo", "sprachen"];

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
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("seiten.name")}</span>
                <Input
                  value={titel}
                  maxLength={200}
                  onChange={(e) => setTitel(e.target.value)}
                />
              </label>
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
                  {t("seiten.startseiteOhneSlug")}
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
