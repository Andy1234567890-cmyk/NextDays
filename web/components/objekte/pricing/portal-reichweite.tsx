"use client";

// Kopfzeile jedes Preis-Editors: „Gilt für <Kanäle> · Nicht unterstützt von
// <Portale>".
//
// Der Branchenstandard schreibt sie in JEDEN Editor der Preise-Seite (live
// abgelesen 04.08.2026, Lodgify: im Kurzaufenthalts-Editor stand „Gilt für
// [Lodgify][Airbnb] | Nicht unterstützt von [Booking.com]"). Ohne sie sieht
// jede Eingabe gleich verbindlich aus — auch die, die kein Portal je sieht. Der
// Betrieb pflegt dann einen Kurzaufenthalts-Aufschlag und wundert sich, warum
// Booking-Gäste ihn nicht zahlen.
//
// Die Aussage kommt VOM SERVER (`getAbgabenStatus` → `items[key]`), aus derselben
// Quelle, aus der der Sync sendet. Eine Regeltabelle in der Oberfläche wäre die
// zweite Wahrheit, die genau dann auseinanderläuft, wenn es darauf ankommt
// (dieselbe Begründung wie beim Chip „Manuelle Synchronisierung" an den
// Gebühren, channel_manager/abgaben_status.py).
import { useTranslations } from "next-intl";

import { channelLabel, channelLogoLoose } from "@/lib/channel-logos";
import type { AbgabePostenStatus } from "@/lib/channex";

/** Die eigenen Buchungsstrecken. Sie bekommen JEDEN Preisbestandteil — der
 *  Preis-Resolver rechnet für sie mit dem vollen Preis-Block. Deshalb stehen sie
 *  immer links („Gilt für") und tauchen rechts nie auf. */
const EIGENE = ["direct", "portal"] as const;

/**
 * Liegt dieser Posten bei diesem Portal? Die EINE Regel dafür.
 *
 * Sie steht hier einmal, weil zwei Darstellungen sie brauchen (der Chip am
 * Betrag und die Kopfzeile „Gilt für") und eine zweite Auslegung genau die Sorte
 * Widerspruch erzeugt, bei der ein Chip „liegt dort" sagt und die Zeile darüber
 * „nicht unterstützt von".
 *
 * Reihenfolge nach Beweiskraft:
 *   1. Ein Gast hat sie bezahlt (`belegt_bei_portalen`) — stärkster Nachweis.
 *   2. Sie steht im Inserat (`live`, zurückgelesen) — gilt auch ohne Buchung.
 *   3. Unser Sync überträgt sie (nicht in `manual_portals`/`restricted_portals`).
 *
 * `internal_only` schlägt alles: ein intern gedachter Posten (optionale Gebühr,
 * Kaution) geht an kein Portal, und ein Beleg dafür wäre ein Datenfehler.
 */
function liegtBeimPortal(posten: AbgabePostenStatus, code: string): boolean {
  if (posten.internal_only) return false;
  if (posten.belegt_bei_portalen?.includes(code)) return true;
  if (posten.live?.some((l) => l.portal === code)) return true;
  return (
    !posten.restricted_portals.includes(code) &&
    !posten.manual_portals.includes(code)
  );
}

/** WO die Gebühr liegt — als Logo-Reihe für einen Chip am Betrag („kr 450
 *  [Airbnb][Booking.com]", genau so im Standard).
 *
 *  DIE AUSSAGE WAR VORHER UMGEKEHRT und dadurch falsch zu lesen: der Chip zeigte
 *  die Portale, die den Posten per Sync BEKOMMEN, und blendete jedes aus, dem
 *  unser Sync ihn nicht überträgt (`manual_portals`). Der Betrieb liest daran
 *  aber ab, wo die Gebühr steht — und für eine im Extranet gepflegte Gebühr sagte
 *  der Chip weiterhin nichts. Live am 11.08.2026: die Reinigungsgebühr stand bei
 *  Airbnb UND Booking.com, der Chip zeigte sie bei keinem von beiden.
 *
 *  Ein Portal ist jetzt aktiv, wenn die Gebühr dort NACHWEISLICH liegt:
 *    1. `belegt_bei_portalen` — eine echte Buchung dieses Portals hat die Art dem
 *       Gast berechnet. Das ist ein Zahlungsvorgang, kein Regelschluss.
 *    2. `live` — der zurückgelesene Stand des Inserats. Gilt auch ohne Buchung
 *       und ist damit die einzige Quelle für ein neu gepflegtes Objekt.
 *    3. unser Sync überträgt sie dorthin — dann steht sie dort, sobald gesendet
 *       wurde.
 *  Die drei ergänzen sich; jede allein hätte eine Lücke (Beleg braucht eine
 *  Buchung, Rücklesen gibt es nur für Airbnb, Sync deckt die Extranet-Pflege
 *  nicht ab).
 *
 *  Die eigenen Strecken stehen hier NICHT mit: sie bekommen alles, ihr Logo in
 *  jeder Zeile wäre Rauschen. Ohne ladbaren Stand bleibt die Reihe leer. */
export function PortalReichweiteChip({
  schluessel,
  status,
  portale,
}: {
  schluessel: string;
  status: AbgabePostenStatus[] | null;
  portale: string[];
}) {
  const posten = status?.find((x) => x.key === schluessel);
  if (!posten) return null;
  const codes = portale.filter((code) => liegtBeimPortal(posten, code));
  if (codes.length === 0) return null;
  // Eigene Gruppe mit Trennstrich und größerem Abstand: die echten Logos sind
  // Wortmarken unterschiedlicher Breite (Booking.com breit, Airbnb schmal) und
  // klebten mit dem Chip-Abstand von 0.25rem aneinander wie ein Wort. Der Strich
  // trennt den BETRAG von der Frage „wohin geht er".
  return (
    <span className="ml-0.5 inline-flex items-center gap-2 border-l border-border pl-2">
      {codes.map((code) => (
        <PortalZeichen key={code} code={code} />
      ))}
    </span>
  );
}

export function PortalReichweite({
  /** Schlüssel des Postens in der Status-Antwort: „base_price", „extra_guest",
   *  „short_stay", „addons" — oder die Kennung eines Längenpreises. */
  schluessel,
  status,
  portale,
}: {
  schluessel: string;
  /** Alle Posten aus `getAbgabenStatus`. `null` = Stand nicht ladbar → die Zeile
   *  bleibt WEG. Eine Reichweite zu behaupten, die niemand belegt hat, ist
   *  schlimmer als keine (Wurzel 4). */
  status: AbgabePostenStatus[] | null;
  /** Verbundene Portale des Objekts, wie der Server sie meldet. */
  portale: string[];
}) {
  const t = useTranslations("objects");
  const posten = status?.find((x) => x.key === schluessel);
  if (!posten) return null;

  // Dieselbe Regel wie am Chip (`liegtBeimPortal`) — sonst behauptete die
  // Kopfzeile „nicht unterstützt von Airbnb", während der Chip darunter das
  // Airbnb-Logo aktiv zeigt. Ein Posten, der dort NACHWEISLICH liegt, ist
  // unterstützt; auf welchem Weg er hingekommen ist (Sync oder Extranet-Pflege),
  // ist für diese Zeile nicht die Frage.
  const gilt = portale.filter((p) => liegtBeimPortal(posten, p));
  const nicht = portale.filter((p) => !liegtBeimPortal(posten, p));

  // Zwei Blöcke („gilt für" / „gilt nicht für"), jeder mit seiner eigenen
  // Marken-Reihe. Vorher lagen Beschriftung und Logos in EINER Flex-Reihe mit
  // 0.5rem Abstand — die Wortmarken klebten dann optisch am Text und
  // untereinander, weil sie unterschiedlich breit und hoch wirken.
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{t("pricingForm.reachAppliesTo")}</span>
        {EIGENE.map((code) => (
          <span
            key={code}
            className="inline-flex h-4 shrink-0 items-center rounded-sm bg-muted px-1 text-[0.6875rem] font-medium leading-none text-foreground"
          >
            {t(`pricingForm.ownChannel.${code}`)}
          </span>
        ))}
        {gilt.map((code) => (
          <PortalZeichen key={code} code={code} />
        ))}
      </span>
      {nicht.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-2 border-l border-border pl-3">
          <span>{t("pricingForm.reachNotSupportedBy")}</span>
          {nicht.map((code) => (
            <PortalZeichen key={code} code={code} gedimmt />
          ))}
        </span>
      )}
    </div>
  );
}

/** Ein Portal als echtes Markenlogo, sonst als Name. KEIN generisches
 *  Ersatz-Icon (ausdrückliche Vorgabe, lib/channel-logos): ein Platzhalter sähe
 *  nach „irgendein Kanal" aus.
 *
 *  Feste HÖHE, freie Breite — die echten Logos sind teils Wortmarken
 *  (Booking.com, Expedia) und werden in einem Quadrat zum grauen Strich. Wo kein
 *  Logo existiert, trägt der Name dieselbe optische Masse wie ein Logo (kleine
 *  Fläche, gleiche Höhe): sonst stand „Vrbo" als Fließtext zwischen zwei Bildern
 *  und die Reihe wirkte gekippt. */
function PortalZeichen({ code, gedimmt }: { code: string; gedimmt?: boolean }) {
  const name = channelLabel(code);
  const logo = channelLogoLoose(code) ?? channelLogoLoose(name);
  if (!logo) {
    return (
      <span
        title={name}
        className={
          gedimmt
            ? "inline-flex h-4 shrink-0 items-center rounded-sm bg-muted px-1 text-[0.6875rem] font-medium leading-none text-muted-foreground line-through"
            : "inline-flex h-4 shrink-0 items-center rounded-sm bg-muted px-1 text-[0.6875rem] font-medium leading-none text-foreground"
        }
      >
        {name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      title={name}
      className={
        gedimmt
          ? "h-4 w-auto max-w-16 shrink-0 self-center rounded-sm object-contain opacity-40 grayscale"
          : "h-4 w-auto max-w-16 shrink-0 self-center rounded-sm object-contain"
      }
    />
  );
}
