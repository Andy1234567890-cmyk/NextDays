"use client";

// SEO → Übersicht: was noch fehlt (Etappe B).
//
// Das eine Muster aus Hostaways SEO-Bereich, das wir nicht hatten: eine
// Zusammenfassung mit Befunden und einem Sprung zur Behebung („Fix it"). Die
// Felder allein sagen niemandem, WO etwas fehlt, wenn eine Website zwölf Seiten
// hat.
//
// Was hier bewusst FEHLT: eine Punktzahl. „87/100" wäre eine erfundene
// Bewertung — niemand kann sagen, was die fehlenden 13 Punkte sind, und Google
// bewertet ohnehin anders. Was zählt, ist die Liste.
//
// Und: kein „Alles mit KI erzeugen"-Knopf. Hostaway hat einen, der für alle
// Seiten auf einmal Texte schreibt; danach sieht die Liste vollständig aus, und
// niemand hat gelesen, was drin steht — bei dem Text, mit dem die Seite in
// Google auftritt. Jeder Befund führt deshalb zur Seite, nicht zu einem
// Generator.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { SeoBefund } from "@/lib/site-weiterleitungen";

/** Symbol und Farbe je Schwere. Drei Stufen, weil es drei Antworten gibt:
 *  so ist die Website nicht findbar · ein wichtiger Teil fehlt · verbesserbar. */
const STUFE: Record<
  SeoBefund["schwere"],
  { icon: string; klasse: string }
> = {
  fehler: { icon: "ph:warning-octagon", klasse: "text-destructive" },
  warnung: { icon: "ph:warning", klasse: "text-amber-600 dark:text-amber-500" },
  hinweis: { icon: "ph:info", klasse: "text-muted-foreground" },
};

/** Wohin der „Beheben"-Link je Befund führt.
 *
 *  Er zeigt auf die Stelle, an der man es WIRKLICH ändert — nicht auf eine
 *  Hilfeseite. Zwei Ziele liegen außerhalb des Baukastens (Firmenprofil,
 *  Objekte), und genau das ist der Punkt: dort würde niemand suchen. */
const ZIEL: Record<string, string> = {
  site_noindex: "/website/seo",
  keine_domain: "/website/einstellungen/adresse",
  seiten_ohne_titel: "/website/seo/seiten",
  seiten_ohne_beschreibung: "/website/seo/seiten",
  seiten_gleiche_beschreibung: "/website/seo/seiten",
  doppelte_titel: "/website/seo/seiten",
  kein_firmenname: "/konto/profil",
  keine_anschrift: "/konto/profil",
  keine_messung: "/website/seo/messung",
  objekte_ohne_text: "/objekte",
};

export function SeoBefundListe({
  befunde,
  geprueft,
}: {
  befunde: SeoBefund[];
  geprueft: number;
}) {
  const t = useTranslations("website");

  if (geprueft === 0) {
    // Nichts veröffentlicht = nichts zu prüfen. Ohne diese Unterscheidung sähe
    // eine leere Liste aus wie „alles gepflegt".
    return (
      <div className="rounded-(--radius) border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t("seo.pruefung.nichtsVeroeffentlicht")}
      </div>
    );
  }

  if (befunde.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-(--radius) border border-border px-4 py-4">
        <Icon
          icon="ph:check-circle"
          className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-500"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {t("seo.pruefung.allesGepflegt")}
          </p>
          {/* Der zweite Satz ist wichtig: „keine Befunde" heißt nicht „gutes
              Ranking". Diese Liste prüft, was wir prüfen können — nicht, was
              Google entscheidet. */}
          <p className="pt-1 text-sm text-muted-foreground">
            {t("seo.pruefung.allesGepflegtHinweis", { anzahl: geprueft })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {befunde.map((b) => {
        const stufe = STUFE[b.schwere];
        const ziel = ZIEL[b.code];
        return (
          <li
            key={b.code}
            className="flex items-start gap-3 rounded-(--radius) border border-border px-4 py-3"
          >
            <Icon
              icon={stufe.icon}
              className={`mt-0.5 size-5 shrink-0 ${stufe.klasse}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {/* Die Zahl steht im Titel, wenn es eine gibt: „3 Seiten ohne
                    Titel" ist eine Handlungsanweisung, „Seiten ohne Titel"
                    nicht. */}
                {b.anzahl > 0
                  ? t(`seo.pruefung.code.${b.code}.titelMit`, {
                      anzahl: b.anzahl,
                    })
                  : t(`seo.pruefung.code.${b.code}.titel`)}
              </p>
              <p className="pt-1 text-sm text-muted-foreground">
                {t(`seo.pruefung.code.${b.code}.hinweis`)}
              </p>
              {b.seiten.length > 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  {b.seiten
                    .map((s) => s.titel || s.slug || s.id)
                    .join(" · ")}
                  {/* Höchstens zehn werden genannt. Dass es mehr sind, muss
                      dastehen — sonst hält der Kunde die Liste für vollständig
                      und wundert sich, dass der Befund bleibt. */}
                  {b.anzahl > b.seiten.length
                    ? ` · ${t("seo.pruefung.weitere", {
                        anzahl: b.anzahl - b.seiten.length,
                      })}`
                    : ""}
                </p>
              ) : null}
            </div>
            {ziel ? (
              <Link
                href={ziel}
                className="shrink-0 rounded-(--radius) border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-secondary"
              >
                {t("seo.pruefung.beheben")}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
