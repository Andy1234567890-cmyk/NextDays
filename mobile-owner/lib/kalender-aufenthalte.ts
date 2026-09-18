// Belegungskalender: aus den Tagesdaten des Servers werden AUFENTHALTE, aus
// Aufenthalten SEGMENTE je Wochenzeile, aus Segmenten BAHNEN. Reine Funktionen
// ohne React — dieselbe Logik wie web/components/portal/portal-kalender.tsx,
// damit App und Web denselben Aufenthalt gleich schneiden und gleich beziffern.
//
// WARUM AUFENTHALTE STATT NÄCHTE (aus dem Web-Kalender übernommen): vorher
// stand in jeder Nacht ein eigener Kasten. Der zeigte `bookings[0]` — EINEN
// Vornamen, EIN Logo — darunter aber die Summe ALLER Einheiten dieser Nacht.
// Der Betrag stimmte, die Zuordnung war falsch. Ein Chip je Aufenthalt und
// Einheit beantwortet beides eindeutig: wer, woher, was bringt die Nacht.
import type { PortalCalendarDay } from "@/lib/ownerPortal";
import type { TextSchluessel } from "@/lib/sprache";
import type { Uebersetzer } from "@/lib/zeitraum";

/** EIN Aufenthalt EINER Einheit, über seine Nächte im geladenen Fenster. */
export type Aufenthalt = {
  reservationId: string;
  /** Mit `reservationId` der Schlüssel; trennt die Einheiten eines Typs. */
  unitId: string | null;
  /** Erste belegte Nacht IM FENSTER (nicht zwingend der Anreisetag). */
  von: string;
  /** Letzte belegte Nacht im Fenster. */
  bis: string;
  naechte: number;
  /** Netto-Auszahlung der ERSTEN Nacht — der Wert PRO NACHT, keine Summe. */
  proNacht: number | null;
  /** Spanne der Nachtwerte (Saisonwechsel). Kein Durchschnitt: der gälte in
   *  keiner einzigen Nacht (Wurzel 4). */
  minProNacht: number | null;
  maxProNacht: number | null;
  /** Mindestens eine Nacht ohne bestimmbaren Wert. */
  luecke: boolean;
  /** WARUM kein Betrag ausweisbar ist — ohne den Grund stünde ein stummes „—". */
  grund: string | null;
  currency: string | null;
  /** Vorname (immer nur das erste Namenstoken). */
  gast: string | null;
  /** Nachname — nur mit VIEW_GUEST_NAME, sonst null. Getrennt vom Vornamen,
   *  damit der Chip bei knappem Platz hinten abschneiden kann. */
  nachname: string | null;
  nationalitaet: string | null;
  /** Wohnsitzland — getrennt von der Staatsangehörigkeit. */
  land: string | null;
  /** Besetzung und Haustiere. null = nicht erfasst; bei Haustieren ist 0
   *  ausdrücklich etwas anderes („keins dabei"). */
  gaeste: number | null;
  erwachsene: number | null;
  kinder: number | null;
  haustiere: number | null;
  quelle: string | null;
  /** Eigennutzung (0241): kein Gast, kein Portal, kein Betrag — und KEINE Lücke. */
  eigennutzung: boolean;
};

/**
 * Gruppiert die Nächte des Fensters zu Aufenthalten. Schlüssel ist
 * `reservation_id` + `unit_id`: dieselbe Reservierung auf zwei Einheiten sind
 * zwei Chips, denn es sind zwei belegte Einheiten und zwei Beträge.
 */
export function aufenthalteBilden(tage: PortalCalendarDay[]): Aufenthalt[] {
  const map = new Map<string, Aufenthalt>();
  const sortiert = [...tage].sort((a, b) => a.date.localeCompare(b.date));
  for (const tag of sortiert) {
    for (const b of tag.bookings ?? []) {
      const key = `${b.reservation_id}|${b.unit_id ?? ""}`;
      const wert = b.owner_payout_per_night;
      const vorhanden = map.get(key);
      if (!vorhanden) {
        map.set(key, {
          reservationId: b.reservation_id,
          unitId: b.unit_id,
          von: tag.date,
          bis: tag.date,
          naechte: 1,
          proNacht: wert,
          minProNacht: wert,
          maxProNacht: wert,
          // Eine Eigennutzung hat KEINE Lücke: es fehlt nichts, es gibt nichts
          // auszuzahlen. Sonst trüge die eigene Sperre „k. A." und der
          // Eigentümer suchte einen Datenfehler, den es nicht gibt.
          luecke: !b.is_owner_stay && wert == null,
          grund: !b.is_owner_stay && wert == null ? b.payout_unknown_reason : null,
          currency: b.currency,
          gast: b.guest_first_name?.trim() || null,
          nachname: b.guest_last_name?.trim() || null,
          nationalitaet: b.guest_nationality?.trim() || null,
          land: b.guest_country?.trim() || null,
          // `?? null`, nicht `|| null`: eine 0 ist hier eine echte Aussage
          // („keine Haustiere") und darf nicht zu „keine Angabe" werden.
          gaeste: b.num_guests ?? null,
          erwachsene: b.adults ?? null,
          kinder: b.children ?? null,
          haustiere: b.pets ?? null,
          quelle: b.booking_source?.trim() || null,
          eigennutzung: b.is_owner_stay,
        });
        continue;
      }
      vorhanden.bis = tag.date;
      vorhanden.naechte += 1;
      // Eigennutzung: nichts fortzuschreiben. Ohne dieses Weiter liefe sie in
      // den Währungsvergleich und behauptete einen Datenfehler (`currency`
      // ist bei ihr erwartungsgemäß null).
      if (b.is_owner_stay) continue;
      if (wert == null) {
        vorhanden.luecke = true;
        // Der ERSTE Grund bleibt stehen — ein Überschreiben ließe den Text je
        // Monatswechsel springen.
        vorhanden.grund = vorhanden.grund ?? b.payout_unknown_reason;
      } else {
        vorhanden.minProNacht =
          vorhanden.minProNacht == null ? wert : Math.min(vorhanden.minProNacht, wert);
        vorhanden.maxProNacht =
          vorhanden.maxProNacht == null ? wert : Math.max(vorhanden.maxProNacht, wert);
      }
      // Verschiedene Währungen in einem Aufenthalt sind ein Datenfehler: dann
      // gibt es keinen ausweisbaren Betrag — und einen Grund dafür.
      if (vorhanden.currency !== b.currency) {
        vorhanden.currency = null;
        vorhanden.proNacht = null;
        vorhanden.minProNacht = null;
        vorhanden.maxProNacht = null;
        vorhanden.luecke = true;
        vorhanden.grund = vorhanden.grund ?? "betrag";
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.von.localeCompare(b.von) || a.reservationId.localeCompare(b.reservationId),
  );
}

/** Ein sichtbares Chip-Stück innerhalb EINER Wochenzeile. */
export type Segment = {
  key: string;
  aufenthalt: Aufenthalt;
  /** Spalte 0–6, an der das Stück beginnt. */
  spalte: number;
  /** Überdeckte Spalten. */
  breite: number;
  /** Beginnt hier die ECHTE erste Nacht? Nur dann ist die Kante gerundet. */
  echterAnfang: boolean;
  echtesEnde: boolean;
};

/** Felder eines Monatsblatts (ISO-Datum oder null) in Wochenzeilen à 7. */
export function wochenBilden(felder: (string | null)[]): (string | null)[][] {
  const voll = [...felder];
  while (voll.length % 7 !== 0) voll.push(null);
  const wochen: (string | null)[][] = [];
  for (let i = 0; i < voll.length; i += 7) wochen.push(voll.slice(i, i + 7));
  return wochen;
}

/**
 * Schneidet die Aufenthalte an jeder Wochengrenze. `echterAnfang`/`echtesEnde`
 * bezeichnen nur die ECHTEN Kanten — an einer bloßen Schnittkante bleibt das
 * Segment ungerundet, damit ein durchlaufender Aufenthalt nicht wie zwei
 * getrennte Buchungen aussieht.
 */
/** Kalendertag um n Tage verschoben — rein über die ISO-Zeichenkette, ohne
 *  `Date` und damit ohne Zeitzonen-Versatz. */
function tagPlus(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const d = new Date(j, (m || 1) - 1, (t || 1) + n, 12);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const tt = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${tt}`;
}

export function segmenteBilden(woche: (string | null)[], aufenthalte: Aufenthalt[]): Segment[] {
  const segmente: Segment[] = [];
  for (const a of aufenthalte) {
    // Der Chip läuft bis zum ABREISETAG, nicht bis zur letzten Nacht: dort
    // endet er zur Tagesmitte (`HALBER_TAG`), weil vormittags abgereist und
    // nachmittags neu angereist wird. Endete er an der letzten Nacht, sähe
    // eine Buchung mit Abreise am 28. so aus, als ende sie am 27. — gemeldet
    // am 08.09.2026. Am Wechseltag teilen sich beide Aufenthalte den Tag.
    const abreise = tagPlus(a.bis, 1);
    const treffer: number[] = [];
    for (let i = 0; i < woche.length; i += 1) {
      const d = woche[i];
      if (d && d >= a.von && d <= abreise) treffer.push(i);
    }
    if (treffer.length === 0) continue;
    const start = treffer[0];
    const ende = treffer[treffer.length - 1];
    segmente.push({
      key: `${a.reservationId}|${a.unitId ?? ""}|${woche[start]}`,
      aufenthalt: a,
      spalte: start,
      breite: ende - start + 1,
      echterAnfang: woche[start] === a.von,
      echtesEnde: woche[ende] === abreise,
    });
  }
  return segmente;
}

/** Höchstens so viele Chips übereinander; der Rest wird je Spalte zu „+n". */
export const MAX_BAHNEN = 2;

export type Bahn = { segment: Segment; bahn: number };
export type Ueberlauf = {
  anzahl: number;
  summe: number | null;
  currency: string | null;
  grund: string | null;
};

/**
 * Verteilt die Segmente einer Woche auf Bahnen (erste freie gewinnt) und fasst
 * alles ab der dritten gleichzeitigen Buchung je SPALTE zu „+n" zusammen —
 * fünf belegte Studios ergäben sonst fünf Bahnen und eine unlesbare Zeile.
 */
export function bahnenVerteilen(segmente: Segment[]): {
  sichtbar: Bahn[];
  ueberlauf: Map<number, Ueberlauf>;
} {
  const belegt: number[][] = Array.from({ length: MAX_BAHNEN }, () => []);
  const sichtbar: Bahn[] = [];
  const ueberlauf = new Map<number, Ueberlauf>();
  const sortiert = [...segmente].sort(
    (a, b) => a.spalte - b.spalte || b.breite - a.breite || a.key.localeCompare(b.key),
  );
  for (const seg of sortiert) {
    const spalten = Array.from({ length: seg.breite }, (_, i) => seg.spalte + i);
    const bahn = belegt.findIndex((b) => spalten.every((s) => !b.includes(s)));
    if (bahn === -1) {
      // Eine Eigennutzung wird MITGEZÄHLT (sie belegt eine Einheit), trägt aber
      // nichts zur Summe bei — sonst zöge sie die Sammelsumme auf null.
      const eigen = seg.aufenthalt.eigennutzung;
      const beitrag = eigen ? null : seg.aufenthalt.proNacht;
      const beitragWaehrung = eigen ? null : seg.aufenthalt.currency;
      for (const s of spalten) {
        const vorhanden = ueberlauf.get(s);
        if (!vorhanden) {
          ueberlauf.set(s, {
            anzahl: 1,
            summe: beitrag,
            currency: beitragWaehrung,
            grund: eigen || beitrag != null ? null : seg.aufenthalt.grund,
          });
          continue;
        }
        vorhanden.anzahl += 1;
        if (eigen) continue;
        vorhanden.summe =
          vorhanden.summe == null || beitrag == null ? null : vorhanden.summe + beitrag;
        if (beitrag == null) vorhanden.grund = vorhanden.grund ?? seg.aufenthalt.grund;
        if (vorhanden.currency !== beitragWaehrung) {
          vorhanden.currency = null;
          vorhanden.summe = null;
          vorhanden.grund = vorhanden.grund ?? "betrag";
        }
      }
      continue;
    }
    belegt[bahn].push(...spalten);
    sichtbar.push({ segment: seg, bahn });
  }
  return { sichtbar, ueberlauf };
}

// Dieselben Texte wie das Web (web/messages/de.json, portal.calendar). Ein
// unbekannter Grund fällt auf die allgemeine Aussage zurück — nie auf den
// rohen Slug.
//
// Hier stehen SCHLÜSSEL, nicht Texte: der Grund kommt vom Server als Slug und
// wird in der Sprache der Oberfläche ausgegeben.
export const GRUND_SCHLUESSEL: Record<string, TextSchluessel> = {
  provision: "grund.provisionLang",
  provision_ungueltig: "grund.provisionUngueltigLang",
  provision_zeitraum: "grund.provisionZeitraumLang",
  betrag: "grund.betragLang",
  naechte: "grund.naechteLang",
  waehrung_vertrag: "grund.waehrungVertragLang",
};

export function grundText(txt: Uebersetzer, grund: string | null): string {
  const schluessel = grund ? GRUND_SCHLUESSEL[grund] : undefined;
  return txt(schluessel ?? "grund.allgemein");
}

/** „k. A." — steht für einen Betrag, den der Server nicht ausweist. */
export function betragKurz(txt: Uebersetzer): string {
  return txt("grund.betragKurz");
}
