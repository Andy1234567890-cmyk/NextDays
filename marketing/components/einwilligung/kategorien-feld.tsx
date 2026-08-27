"use client";

// Der Einwilligungs-Dialog — EIN Baustein für beide Orte: die Leiste unten und
// das Einstellungsfeld auf der Cookie-Richtlinie. Zwei Kopien würden
// auseinander laufen, und dann stünde in der Leiste ein anderer Zweck als im
// Widerruf.
//
// AUFBAU nach der Vorlage von Booking.com (Cookiebot und Usercentrics machen es
// gleich): links eine Navigationsspalte mit einer Übersichtsseite und darunter
// den Kategorien, rechts der gewählte Eintrag — Titel mit Schalter oben rechts,
// Beschreibung, darunter „Von uns genutzte Cookies". Dieser Link führt auf eine
// ZWEITE Ebene, die nach Host gruppiert ist und je Cookie Name, Host, Dauer,
// Art, Kategorie und Beschreibung zeigt.
//
// Warum diese Schichtung zulässig ist: die Orientierungshilfe der
// Aufsichtsbehörden (OH Telemedien 2021, S. 14) erlaubt mehrschichtige Banner
// ausdrücklich. Bedingung ist, dass die erste Ebene je Zweck KONKRET informiert
// (keine vagen Angaben wie „besseres Nutzungserlebnis") UND dort auch abgelehnt
// werden kann. Beides ist erfüllt: jeder Zweck nennt seinen Dienst, und jeder
// hat seinen eigenen Schalter.
//
// Bei schmalem Bildschirm (< sm) wird aus den zwei Spalten eine Liste
// übereinander: eine Seitenleiste bei 320 px Breite ist kein Layout, sondern
// zwei unlesbare Spalten.
//
// Die notwendige Kategorie hat KEINEN Schalter, auch keinen ausgegrauten: ein
// Schalter, den man nicht bewegen kann, verspricht eine Wahl, die es nicht
// gibt. Technisch notwendige Cookies sind nach § 25 Abs. 2 TDDDG
// einwilligungsfrei — dort steht „immer aktiv" als Text, wie bei Booking.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import {
  type Auswahl,
  istKonfiguriert,
  OPTIONALE_KATEGORIEN,
  type OptionaleKategorie,
} from "@/lib/einwilligung";
import { DIENST_ANGABEN } from "@/lib/einwilligung-angaben";
import { cn } from "@/lib/utils";

/**
 * Die Einträge der linken Spalte: die Übersicht, die notwendige Kategorie und
 * die einwilligungspflichtigen Zwecke.
 */
type Eintrag = "uebersicht" | "notwendig" | OptionaleKategorie;

const EINTRAEGE: readonly Eintrag[] = [
  "uebersicht",
  "notwendig",
  ...OPTIONALE_KATEGORIEN,
];

function Schalter({
  an,
  label,
  umschalten,
}: {
  an: boolean;
  label: string;
  umschalten: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={label}
      onClick={umschalten}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        an ? "bg-accent" : "bg-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-background shadow-card transition-transform",
          an ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/**
 * Die zweite Ebene: die Cookies dieses Zwecks, nach Host gruppiert.
 *
 * Die Gruppierung nach Host ist die Vorlage von Booking und sachlich richtig:
 * wer wissen will, wohin Daten gehen, sucht die Domain, nicht den Cookie-Namen.
 * Sie zeigt außerdem auf einen Blick, was Erst- und was Drittanbieter ist.
 *
 * Aufgeklappt wird je Host einzeln — bei einem Dienst mit vielen Cookies wäre
 * alles-offen wieder die Wand aus Text, die dieser Dialog vermeidet.
 */
function CookieListe({
  kategorie,
  zurueck,
}: {
  kategorie: OptionaleKategorie;
  zurueck: () => void;
}) {
  const t = useTranslations("einwilligung");
  const dienst = DIENST_ANGABEN[kategorie];
  const [offenerHost, setOffenerHost] = useState<string | null>(null);

  // Nach Host gruppieren. `Map` hält die Reihenfolge der ersten Nennung — so
  // steht die eigene Domain oben, wenn sie zuerst eingetragen ist.
  const nachHost = new Map<string, typeof dienst.cookies>();
  for (const c of dienst.cookies) {
    nachHost.set(c.host, [...(nachHost.get(c.host) ?? []), c]);
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={zurueck}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="text-base leading-none">
          &lsaquo;
        </span>
        {t("angaben.listeTitel")}
      </button>

      <ul className="flex min-w-0 flex-col gap-2">
        {[...nachHost.entries()].map(([host, cookies]) => {
          const offen = offenerHost === host;
          return (
            <li
              key={host}
              className="min-w-0 rounded-xl border border-border bg-card"
            >
              <button
                type="button"
                aria-expanded={offen}
                onClick={() => setOffenerHost(offen ? null : host)}
                className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 break-words text-sm font-semibold">
                  {host}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-accent">
                  {t("angaben.listeAnzeigen")}
                  <span aria-hidden>{offen ? "⌄" : "›"}</span>
                </span>
              </button>

              {offen ? (
                <ul className="flex min-w-0 flex-col gap-2 px-3 pb-3">
                  {cookies.map((c) => (
                    <li
                      key={c.name}
                      className="min-w-0 rounded-lg bg-surface-warm p-3 text-xs text-muted-foreground"
                    >
                      {/* Definitionsliste statt <table>: bei 320 px bricht eine
                          Tabelle mit sechs Zeilen quer aus dem Bild, eine dl
                          legt sich um. Die Beschriftungen bleiben trotzdem
                          Beschriftungen — für Screenreader wie fürs Auge. */}
                      <dl className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">{t("angaben.name")}</dt>
                          <dd className="min-w-0 break-words font-semibold text-foreground">
                            {c.name}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">{t("angaben.host")}</dt>
                          <dd className="min-w-0 break-words">{c.host}</dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">{t("angaben.dauer")}</dt>
                          <dd className="min-w-0 break-words">
                            {t(`dauer.${c.dauerSchluessel}`)}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">{t("angaben.art")}</dt>
                          <dd className="min-w-0 break-words">
                            {c.art === "erst"
                              ? t("angaben.artErst")
                              : t("angaben.artDritt")}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">
                            {t("angaben.kategorie")}
                          </dt>
                          <dd className="min-w-0 break-words">
                            {t(`kategorien.${kategorie}.titel`)}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-x-2">
                          <dt className="font-medium">
                            {t("angaben.beschreibung")}
                          </dt>
                          <dd className="min-w-0 break-words">
                            {t(`zweck.${c.zweckSchluessel}`)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function KategorienFeld({
  auswahl,
  setzen,
}: {
  auswahl: Auswahl;
  setzen: (kategorie: OptionaleKategorie, an: boolean) => void;
}) {
  const t = useTranslations("einwilligung");
  const [offen, setOffen] = useState<Eintrag>("uebersicht");
  // Zweite Ebene: welche Cookie-Liste ist aufgeschlagen? `null` = erste Ebene.
  const [liste, setListe] = useState<OptionaleKategorie | null>(null);

  // Die zweite Ebene ERSETZT die erste, statt darunter zu erscheinen — genau
  // wie bei Booking. Sonst wächst der Dialog beim Aufklappen über den
  // Bildschirm und die Entscheidungsknöpfe verschwinden.
  if (liste) {
    return <CookieListe kategorie={liste} zurueck={() => setListe(null)} />;
  }

  const istKategorie = offen !== "uebersicht";
  const istOptional = offen !== "uebersicht" && offen !== "notwendig";

  return (
    // `min-w-0` durchgehend: Ohne das wächst ein langes Kompositum (Deutsch,
    // Finnisch, Ungarisch) die Spalte über die Bildschirmbreite hinaus und die
    // ganze Seite scrollt quer — dieselbe Ursache wie an den Überschriften
    // (app/globals.css).
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:gap-5">
      {/* Linke Spalte. Bewusst kein `role="tablist"` mit Pfeiltasten-Steuerung:
          es sind Knöpfe, die den rechten Bereich wechseln, und `aria-current`
          sagt einem Screenreader, welcher gerade gilt. */}
      <ul className="flex min-w-0 shrink-0 flex-col sm:w-56">
        {EINTRAEGE.map((eintrag) => {
          const aktiv = offen === eintrag;
          return (
            <li key={eintrag} className="min-w-0 border-b border-border">
              <button
                type="button"
                aria-current={aktiv || undefined}
                onClick={() => setOffen(eintrag)}
                className={cn(
                  "w-full min-w-0 break-words px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  aktiv
                    ? "border-l-2 border-l-accent bg-surface-warm font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-surface-warm/60",
                )}
              >
                {eintrag === "uebersicht"
                  ? t("uebersicht.titel")
                  : t(`kategorien.${eintrag}.titel`)}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Rechte Spalte. `sm:min-h-48` hält den Kasten stabil, damit die Knöpfe
          darunter beim Wechseln der Kategorie nicht springen. */}
      <div className="min-w-0 flex-1 sm:min-h-48">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-semibold">
            {istKategorie ? t(`kategorien.${offen}.titel`) : t("uebersicht.titel")}
          </p>
          {offen === "notwendig" ? (
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              {t("immerAktiv")}
            </p>
          ) : null}
          {istOptional ? (
            <Schalter
              an={auswahl[offen]}
              label={t(`kategorien.${offen}.titel`)}
              umschalten={() => setzen(offen, !auswahl[offen])}
            />
          ) : null}
        </div>

        <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
          {istKategorie ? t(`kategorien.${offen}.text`) : t("uebersicht.text")}
        </p>

        {/* Auf der Übersichtsseite steht der Verweis auf die
            Datenschutzerklärung — wie bei Booking. */}
        {offen === "uebersicht" ? (
          <Link
            href="/datenschutz"
            className="mt-3 inline-block break-words text-xs text-accent underline underline-offset-4"
          >
            {t("uebersicht.datenschutz")}
          </Link>
        ) : null}

        {/* Bei fehlender Einrichtung wird die Kategorie NICHT versteckt — sonst
            wäre der Zweck nicht abwählbar, sondern unsichtbar. Stattdessen
            steht es hier. */}
        {istOptional && !istKonfiguriert(offen) ? (
          <p className="mt-2 break-words text-xs font-medium text-muted-foreground">
            {t("nichtEingerichtet")}
          </p>
        ) : null}

        {/* „Von uns genutzte Cookies" — führt auf die zweite Ebene. Bei
            „notwendig" gibt es keine Liste im Dialog: diese Cookies sind
            einwilligungsfrei und in der Cookie-Richtlinie einzeln beschrieben. */}
        {istOptional ? (
          <button
            type="button"
            onClick={() => setListe(offen)}
            className="mt-3 inline-block break-words text-xs text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("angaben.listeAnzeigen")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
