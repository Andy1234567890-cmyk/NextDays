"use client";

// Ein Bildfeld: Vorschau + „Aus Mediathek wählen".
//
// Der Weg über die Mediathek ist der HAUPTWEG, nicht die Ausnahme: ein
// Vermieter hat seine Fotos auf dem Rechner, nicht unter einer Adresse im Netz.
// Deshalb steht der Knopf oben und das URL-Feld darunter — und zwar eingeklappt,
// weil eine fremde Adresse der seltene Fall ist (ein Bild, das schon auf einer
// anderen Seite des Betriebs liegt).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { findMediumByUrl } from "@/lib/site-pages";

import { BildAltKnopf } from "../ki/ki-alt-text";
import { Mediathek } from "../mediathek";

export function BildFeld({
  label,
  wert,
  onWert,
  mitAltText = false,
  sprache,
  kompakt = false,
}: {
  label: string;
  wert: string | null;
  onWert: (v: string | null) => void;
  /** true = zeig den KI-Alt-Text-Knopf unter dem Bild. NUR im Bild-Baustein
   *  des Seiten-Editors gesetzt (0463–0465) — Logo, Favicon und Hero-Bild in
   *  den Einstellungen sind keine Inhalte, die ein Gast mit Screenreader zu
   *  lesen bekommt, und jeder zusätzliche Aufruf dort wäre eine Suche, die
   *  nie einen Treffer findet. */
  mitAltText?: boolean;
  /** Sprache für den Alt-Text-Vorschlag. Fehlt sie, gilt die Dashboard-Sprache. */
  sprache?: string;
  /** KOMPAKT: eine kleine Platte statt Vorschau + Knopf + Adresszeile
   *  untereinander.
   *
   *  Für die CMS-Masken. Dort stehen je Beitrag ACHT Bildfelder (Titelbild,
   *  zwei Einzelgalerien, vier Karussellbilder, Vorschaubild) — in der
   *  ausführlichen Form ist jedes ein Block über die volle Breite mit einem
   *  grauen Balken „Bild wählen" darin, und der Dialog besteht aus grauen
   *  Balken. Genau so wurde es gemeldet („bei den Images schaut es voll
   *  schlecht aus", 28.08.2026).
   *
   *  Das Maß ist das des Vorbilds, am selben Tag im offenen Framer-Projekt
   *  abgemessen: die Miniatur in der Feldzeile ist **89 × 55** mit Radius 8
   *  (`h-14 w-22` = 56 × 88, `rounded-lg` = 8). Sie IST der Knopf: ein Klick
   *  öffnet die Mediathek, das `×` in der Ecke nimmt das Bild wieder weg. */
  kompakt?: boolean;
}) {
  const t = useTranslations("website");
  const uiLocale = useLocale();
  const [mediathekOffen, setMediathekOffen] = useState(false);
  const [adresseOffen, setAdresseOffen] = useState(false);
  const [mediumId, setMediumId] = useState<string | null>(null);

  // Zur URL das passende Mediathek-Bild suchen — nur so, weil der Baustein
  // selbst keine Medien-ID trägt (nur die URL). Kein Treffer bei einer
  // fremden Adresse oder einem Stockfoto-Hotlink: dann bleibt der Knopf aus.
  useEffect(() => {
    if (!mitAltText || !wert) {
      setMediumId(null);
      return;
    }
    let lebendig = true;
    void findMediumByUrl(wert).then((m) => {
      if (lebendig) setMediumId(m?.id ?? null);
    });
    return () => {
      lebendig = false;
    };
  }, [mitAltText, wert]);

  const mediathek = mediathekOffen ? (
    <Mediathek
      onWaehle={(url) => {
        onWert(url);
        setMediathekOffen(false);
      }}
      onSchliesse={() => setMediathekOffen(false)}
    />
  ) : null;

  if (kompakt) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          aria-label={wert ? t("bildFeld.aendern") : t("bildFeld.waehlen")}
          title={wert ? t("bildFeld.aendern") : t("bildFeld.waehlen")}
          onClick={() => setMediathekOffen(true)}
          className="group/bild relative h-14 w-22 shrink-0 overflow-hidden rounded-lg border border-border bg-(--tabelle-bild-platte) transition hover:border-foreground/30"
        >
          {wert ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wert} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <Icon icon="ph:image" className="size-5" />
            </span>
          )}
        </button>
        {wert ? (
          <button
            type="button"
            aria-label={t("bildFeld.entfernen")}
            title={t("bildFeld.entfernen")}
            onClick={() => onWert(null)}
            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-destructive"
          >
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        ) : null}
        {/* Die fremde Adresse bleibt erreichbar, aber klein: sie ist auch hier
            der seltene Fall. */}
        {adresseOffen ? (
          <input
            value={wert ?? ""}
            placeholder="https://…"
            spellCheck={false}
            onChange={(e) => onWert(e.target.value || null)}
            className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2 py-1.5 font-mono text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdresseOffen(true)}
            className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          >
            {t("bildFeld.adresseStattdessen")}
          </button>
        )}
        {mediathek}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-xs font-medium">{label}</span>

      {wert ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wert}
            alt=""
            className="h-24 w-full rounded-(--radius) border border-border bg-secondary/40 object-cover"
          />
          <button
            type="button"
            aria-label={t("bildFeld.entfernen")}
            title={t("bildFeld.entfernen")}
            onClick={() => onWert(null)}
            className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition hover:text-destructive"
          >
            <Icon icon="ph:x" className="size-3.5" />
          </button>
          {mitAltText && mediumId ? (
            <div className="absolute bottom-1.5 left-1.5">
              <BildAltKnopf mediumId={mediumId} sprache={sprache ?? uiLocale} />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMediathekOffen(true)}
        className="flex items-center justify-center gap-1.5 rounded-(--radius) border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
      >
        <Icon icon="ph:images" className="size-4" />
        {wert ? t("bildFeld.aendern") : t("bildFeld.waehlen")}
      </button>

      {/* Fremde Adresse: der seltene Fall, deshalb eingeklappt. */}
      {adresseOffen ? (
        <input
          value={wert ?? ""}
          placeholder="https://…"
          spellCheck={false}
          onChange={(e) => onWert(e.target.value || null)}
          className="w-full rounded-(--radius) border border-border bg-transparent px-2 py-1.5 font-mono text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdresseOffen(true)}
          className="self-start text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
        >
          {t("bildFeld.adresseStattdessen")}
        </button>
      )}

      {mediathek}
    </div>
  );
}
