"use client";

// „Co-Gastgeber" (Airbnb „Co-Hosts") — Zugriff auf DIESES Objekt.
//
// Zweispaltig wie Ausstattung/Preise/Lage: Links die Liste, rechts fährt der
// Einladungs-Wizard aus und schiebt sie zusammen. Kein Ansichtswechsel.
//
// Ein Co-Gastgeber ist eine Person mit EIGENEM Konto, die hier mithilft — nicht
// ein Mitarbeiter im eigenen Betrieb. Die Rechte erzwingt ausschließlich das
// Backend; diese Oberfläche zeigt sie nur an.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import {
  aendereCohostZugriff,
  entferneCohost,
  ziehEinladungZurueck,
} from "@/lib/cohost-actions";
import type { Cohost, CohostInvitation } from "@/lib/cohosts";

import { BriefIllustration } from "./brief-illustration";
import { CohostBeteiligung } from "./cohost-beteiligung";
import { stufeVon, ZUGRIFFS_STUFEN } from "./cohost-katalog";
import { CohostWizard } from "./cohost-wizard";

/** Anfangsbuchstaben als Avatar — kein Foto, aber persönlicher als ein Icon. */
function Initialen({ name, email }: { name: string | null; email: string | null }) {
  const quelle = (name || email || "?").trim();
  const teile = quelle.split(/\s+/).filter(Boolean);
  const kuerzel =
    teile.length > 1
      ? `${teile[0][0]}${teile[teile.length - 1][0]}`
      : quelle.slice(0, 2);
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
      {kuerzel}
    </span>
  );
}

export function CohostPanel({
  propertyId,
  cohosts,
  einladungen,
  waehrung,
  plattformBps,
  onAendern,
  onDetailOffen,
}: {
  propertyId: string;
  cohosts: Cohost[];
  einladungen: CohostInvitation[];
  /** Währung des Objekts. Kann fehlen — dann rendert formatCurrency
   *  symbollos, statt ein erfundenes € zu zeigen (Wurzel 4). */
  waehrung: string | null;
  /** Feste Plattform-Gebühr in Basispunkten (800 = 8 %). */
  plattformBps: number;
  /** Meldet dem Editor neue Daten (Realtime pflegt den State inkrementell). */
  onAendern: (cohosts: Cohost[], einladungen: CohostInvitation[]) => void;
  /** Blendet die linke Abschnittsliste aus, solange eine Sidebar offen ist. */
  onDetailOffen?: (offen: boolean) => void;
}) {
  const reduziert = useReducedMotion();
  const [wizardOffen, setWizardOffenState] = useState(false);
  // Co-Gastgeber, dessen Beteiligung gerade bearbeitet wird (null = keine).
  const [beteiligungFuer, setBeteiligungFuerState] = useState<Cohost | null>(
    null,
  );
  const [laeuft, setLaeuft] = useState<string | null>(null);

  function setWizardOffen(offen: boolean) {
    setWizardOffenState(offen);
    onDetailOffen?.(offen);
  }

  function setBeteiligungFuer(c: Cohost | null) {
    setBeteiligungFuerState(c);
    onDetailOffen?.(c != null);
  }

  /** Beteiligung als kurzer Text für die Liste. */
  function beteiligungText(c: Cohost): string {
    if (c.share_kind === "percent" && c.share_bps) {
      return `${c.share_bps / 100} % je Buchung`;
    }
    if (c.share_kind === "fixed" && c.share_fixed_cents) {
      return `${formatCurrency(c.share_fixed_cents / 100, c.share_currency ?? waehrung)} je Buchung`;
    }
    return "Unentgeltlich";
  }

  const leer = cohosts.length === 0 && einladungen.length === 0;
  // Airbnb-Grenze: 10 je Objekt. Offene Einladungen zählen mit — das erzwingt
  // auch das Backend, hier wird der Knopf nur ehrlich deaktiviert.
  const voll = cohosts.length + einladungen.length >= 10;

  async function zugriffAendern(c: Cohost, access: Cohost["access"]) {
    setLaeuft(c.id);
    const res = await aendereCohostZugriff(propertyId, c.id, access);
    setLaeuft(null);
    if (res.ok) {
      onAendern(
        cohosts.map((x) => (x.id === c.id ? res.data : x)),
        einladungen,
      );
      toast.success("Zugriff geändert.");
    } else {
      toast.error(res.fehler);
    }
  }

  async function entfernen(c: Cohost) {
    setLaeuft(c.id);
    const res = await entferneCohost(propertyId, c.id);
    setLaeuft(null);
    if (res.ok) {
      onAendern(
        cohosts.filter((x) => x.id !== c.id),
        einladungen,
      );
      toast.success("Zugriff entzogen.");
    } else {
      toast.error(res.fehler);
    }
  }

  async function einladungZurueck(inv: CohostInvitation) {
    setLaeuft(inv.id);
    const res = await ziehEinladungZurueck(propertyId, inv.id);
    setLaeuft(null);
    if (res.ok) {
      onAendern(
        cohosts,
        einladungen.filter((x) => x.id !== inv.id),
      );
      toast.success("Einladung zurückgezogen.");
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                Co-Gastgeber
              </h2>
              <p className="mt-2 text-[0.9375rem] text-muted-foreground">
                Hol dir Unterstützung bei diesem Objekt. Du legst fest, worauf
                jede Person Zugriff hat.
              </p>
            </div>
            {!leer && (
              <button
                type="button"
                disabled={voll}
                onClick={() => setWizardOffen(true)}
                className="shrink-0 rounded-full bg-muted px-5 py-2.5 text-sm font-semibold outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
              >
                Einladen
              </button>
            )}
          </div>

          {leer ? (
            /* Leerzustand mit animiertem Briefumschlag. Die Bewegung erzählt,
               worum es geht: eine Einladung geht raus. */
            <div className="mt-12 flex flex-col items-center text-center">
              <BriefIllustration className="max-w-[15rem]" />
              <p className="mt-8 text-lg font-semibold">
                Lade einen Co-Gastgeber ein
              </p>
              <p className="mt-2 max-w-md text-[0.9375rem] text-muted-foreground">
                Ein Co-Gastgeber kann dich bei allem unterstützen — von der
                Kalenderpflege bis zur Betreuung deiner Gäste.
              </p>
              <button
                type="button"
                onClick={() => setWizardOffen(true)}
                className="mt-8 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20"
              >
                Co-Gastgeber einladen
              </button>
            </div>
          ) : (
            <div className="mt-8">
              {/* Aktive Co-Gastgeber */}
              {cohosts.map((c) => {
                const stufe = stufeVon(c.access);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 border-b border-border py-5"
                  >
                    <Initialen name={c.full_name} email={c.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {c.full_name || c.email || "Unbekannt"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Icon icon={stufe.icon} className="size-4 shrink-0" />
                        {stufe.label}
                      </p>
                      {/* Beteiligung als eigene Zeile — Geld gehört nicht in
                          eine Nebenbemerkung. */}
                      <button
                        type="button"
                        onClick={() => setBeteiligungFuer(c)}
                        className="mt-1 flex items-center gap-1.5 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foreground/20"
                      >
                        <Icon
                          icon={
                            c.share_kind === "none" ? "ph:hand-heart" : "ph:coins"
                          }
                          className="size-4 shrink-0"
                        />
                        {beteiligungText(c)}
                      </button>
                    </div>
                    {/* Stufe direkt änderbar — ein eigener Dialog dafür wäre
                        ein unnötiger Umweg. */}
                    <select
                      value={c.access}
                      disabled={laeuft === c.id}
                      onChange={(e) =>
                        void zugriffAendern(c, e.target.value as Cohost["access"])
                      }
                      aria-label={`Zugriff von ${c.full_name || c.email}`}
                      className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus-visible:border-foreground disabled:opacity-50"
                    >
                      {ZUGRIFFS_STUFEN.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={laeuft === c.id}
                      onClick={() => void entfernen(c)}
                      aria-label={`${c.full_name || c.email} entfernen`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50"
                    >
                      <Icon icon="ph:x" className="size-4" />
                    </button>
                  </div>
                );
              })}

              {/* Offene Einladungen — deutlich als „noch nicht angenommen"
                  gekennzeichnet, sonst hält man sie für aktive Zugriffe. */}
              {einladungen.map((inv) => {
                const stufe = stufeVon(inv.access);
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-4 border-b border-border py-5"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
                      <Icon
                        icon="ph:envelope-simple"
                        className="size-5 text-muted-foreground"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{inv.email}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Eingeladen · {stufe.label} · noch nicht angenommen
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={laeuft === inv.id}
                      onClick={() => void einladungZurueck(inv)}
                      className="shrink-0 text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50"
                    >
                      Zurückziehen
                    </button>
                  </div>
                );
              })}

              {voll && (
                <p className="mt-5 text-sm text-muted-foreground">
                  Ein Objekt kann höchstens 10 Co-Gastgeber haben.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Inline-Wizard (kein Overlay): fährt aus, schiebt die Liste zusammen —
          dieselbe Mechanik wie die Ausstattungs-Auswahl. */}
      <AnimatePresence initial={false}>
        {beteiligungFuer && (
          <motion.aside
            key="cohost-beteiligung"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert
                ? { duration: 0 }
                : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              <CohostBeteiligung
                key={beteiligungFuer.id}
                propertyId={propertyId}
                cohost={beteiligungFuer}
                waehrung={waehrung}
                plattformBps={plattformBps}
                onGeaendert={(neu) =>
                  onAendern(
                    cohosts.map((x) => (x.id === neu.id ? neu : x)),
                    einladungen,
                  )
                }
                onSchliessen={() => setBeteiligungFuer(null)}
              />
            </div>
          </motion.aside>
        )}
        {wizardOffen && (
          <motion.aside
            key="cohost-wizard"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert
                ? { duration: 0 }
                : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              <CohostWizard
                propertyId={propertyId}
                onFertig={(neu) => {
                  onAendern(cohosts, [...einladungen, neu]);
                  setWizardOffen(false);
                }}
                onAbbrechen={() => setWizardOffen(false)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
