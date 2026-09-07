"use server";

// Schreib- und Nachlade-Actions des Multi-Kalenders.
//
// Sperren und Preise gehen je Objekt einzeln an die bestehenden Kalender-
// Endpunkte (`/calendar/block|unblock`, `/calendar/price-override` je Tag) —
// dieselben Pfade wie das PMS, damit Channex-Push, Einheiten-Logik und die
// Gegenzustände (Wurzel 1) an EINER Stelle bleiben. Ein Fehler bei einem
// Objekt bricht ab und wird gemeldet; was vorher gespeichert wurde, bleibt
// gespeichert und ist nach dem Nachladen sichtbar — nichts wird stumm als
// „fertig" gemeldet (Wurzel 5).
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import {
  getKalenderFenster,
  tagPlus,
  type KalenderFenster,
  type Rabatt,
  type RegelsatzEingabe,
  type Saison,
} from "./kalender";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

function fehlerAus(exc: unknown, standard: string): { ok: false; fehler: string } {
  return { ok: false, fehler: exc instanceof ApiError ? exc.message : standard };
}

/** Ein weiteres Fenster nachladen (beim Blättern). */
export async function ladeKalenderFenster(
  propertyIds: string[],
  start: string,
  end: string,
): Promise<Ergebnis<KalenderFenster>> {
  try {
    return { ok: true, data: await getKalenderFenster(propertyIds, start, end) };
  } catch (exc) {
    return fehlerAus(exc, "Kalender konnte nicht geladen werden.");
  }
}

/**
 * Verfügbarkeit für einen Tagesbereich setzen. `letzterTag` ist der letzte
 * AUSGEWÄHLTE Tag (inklusiv) — der Kalender-Endpunkt erwartet `end` exklusiv.
 */
export async function setzeVerfuegbarkeit(
  propertyIds: string[],
  ersterTag: string,
  letzterTag: string,
  gesperrt: boolean,
): Promise<Ergebnis<{ tage: number }>> {
  let tage = 0;
  for (const property_id of propertyIds) {
    try {
      const res = await api<{ blocked_days?: number; unblocked_days?: number }>(
        gesperrt ? "/calendar/block" : "/calendar/unblock",
        {
          method: "POST",
          body: {
            property_id,
            range: { start: ersterTag, end: tagPlus(letzterTag, 1) },
          },
        },
      );
      tage += res.blocked_days ?? res.unblocked_days ?? 0;
    } catch (exc) {
      return fehlerAus(exc, "Verfügbarkeit konnte nicht gespeichert werden.");
    }
  }
  return { ok: true, data: { tage } };
}

/**
 * Alles, was das Bearbeiten-Panel in EINEM Zug setzt.
 *
 * Der Kalender-Endpunkt `/calendar/bulk-edit` nimmt Objekte × Zeitraum und
 * wendet nur an, was gesetzt ist. Vorher lief hier je Tag und Objekt ein
 * eigener Preis-Aufruf — bei drei Objekten und zwei Wochen 42 Anfragen, die
 * der Gastgeber als hängenden Knopf erlebt. Jetzt ist es einer.
 */
export interface BereichsAenderung {
  /** Fester Nachtpreis; null = nicht anfassen. */
  preis?: number | null;
  /** Mindestaufenthalt in Nächten. */
  mindestaufenthalt?: number | null;
  /** true = sperren, false = Sperre aufheben. */
  gesperrt?: boolean | null;
}

/**
 * Verfügbarkeit, Preis und Mindestaufenthalt für Objekte × Zeitraum setzen.
 * `letzterTag` ist der letzte AUSGEWÄHLTE Tag (inklusiv) — der Endpunkt
 * erwartet `end` exklusiv.
 */
export async function setzeBereich(
  propertyIds: string[],
  ersterTag: string,
  letzterTag: string,
  aenderung: BereichsAenderung,
): Promise<Ergebnis<{ objekte: number; tage: number; angewendet: string[] }>> {
  const body: Record<string, unknown> = {
    property_ids: propertyIds,
    range: { start: ersterTag, end: tagPlus(letzterTag, 1) },
  };
  if (aenderung.preis != null) body.price = aenderung.preis;
  if (aenderung.mindestaufenthalt != null) body.min_stay = aenderung.mindestaufenthalt;
  if (aenderung.gesperrt != null) body.block = aenderung.gesperrt;
  if (Object.keys(body).length === 2) {
    return { ok: false, fehler: "Es gibt nichts zu speichern." };
  }
  try {
    const data = await api<{ properties: number; days: number; applied: string[] }>(
      "/calendar/bulk-edit",
      { method: "POST", body },
    );
    return {
      ok: true,
      data: { objekte: data.properties, tage: data.days, angewendet: data.applied },
    };
  } catch (exc) {
    return fehlerAus(exc, "Änderung konnte nicht gespeichert werden.");
  }
}

/**
 * Saisons der genannten Objekte. Der Endpunkt liefert je Aufruf EIN Objekt —
 * deshalb in Blöcken, damit 20 Objekte nicht 20 Anfragen nacheinander sind.
 * Ein Objekt, dessen Saisons nicht ladbar sind, fehlt in der Antwort, statt
 * die ganze Liste scheitern zu lassen (die Ebene ist eine Zugabe, kein Muss).
 */
export async function ladeSaisons(
  propertyIds: string[],
): Promise<Ergebnis<Saison[]>> {
  const aus: Saison[] = [];
  for (let i = 0; i < propertyIds.length; i += GLEICHZEITIG) {
    const block = propertyIds.slice(i, i + GLEICHZEITIG);
    const teile = await Promise.allSettled(
      block.map((id) =>
        api<{ items: Saison[] }>(
          `/calendar/seasons?property_id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        ).then((r) => r.items.map((s) => ({ ...s, property_id: id }))),
      ),
    );
    for (const t of teile) if (t.status === "fulfilled") aus.push(...t.value);
  }
  return { ok: true, data: aus };
}

/**
 * Rabattregeln der genannten Objekte (`/pricing/discounts/{id}`).
 *
 * Sie gehören zum Regelsatz, den das rechte Panel zeigt: Der Saisonname sagt,
 * was eine Nacht kostet, die Rabatte sagen, wann davon etwas abgeht. Ohne sie
 * zeigte die Karte nur die halbe Wahrheit über den Preis.
 */
export async function ladeRabatte(
  propertyIds: string[],
): Promise<Ergebnis<Rabatt[]>> {
  const aus: Rabatt[] = [];
  for (let i = 0; i < propertyIds.length; i += GLEICHZEITIG) {
    const block = propertyIds.slice(i, i + GLEICHZEITIG);
    const teile = await Promise.allSettled(
      block.map((id) =>
        api<Rabatt[]>(`/pricing/discounts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        }),
      ),
    );
    for (const t of teile) if (t.status === "fulfilled") aus.push(...t.value);
  }
  return { ok: true, data: aus };
}

/** Einen Regelsatz anlegen (Editor „Neue Regeln erstellen"). */
export async function legeRegelsatzAn(
  propertyId: string,
  eingabe: RegelsatzEingabe,
): Promise<Ergebnis<Saison>> {
  try {
    const data = await api<Saison>("/calendar/seasons", {
      method: "POST",
      body: { property_id: propertyId, ...eingabe },
    });
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Regelsatz konnte nicht angelegt werden.");
  }
}

/**
 * Einen Regelsatz ändern (Editor „Regeln bearbeiten").
 *
 * Es geht der VOLLE Stand hinaus, nicht nur das geänderte Feld: die
 * Wochentag-Sperren sind Listen, und eine ausgelassene Liste bedeutete
 * „unverändert", eine leere „keine Sperre mehr". Wer nur ein Feld schickt,
 * kann die Sperre nie wieder aufheben.
 */
export async function aendereRegelsatz(
  seasonId: string,
  eingabe: RegelsatzEingabe,
): Promise<Ergebnis<Saison>> {
  try {
    const data = await api<Saison>(
      `/calendar/seasons/${encodeURIComponent(seasonId)}`,
      { method: "PATCH", body: eingabe },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Regelsatz konnte nicht gespeichert werden.");
  }
}

/** Einen Regelsatz löschen. Die zugewiesenen Tage fallen auf den Grundpreis. */
export async function loescheRegelsatz(
  seasonId: string,
): Promise<Ergebnis<{ ok: true }>> {
  try {
    await api(`/calendar/seasons/${encodeURIComponent(seasonId)}`, {
      method: "DELETE",
    });
    return { ok: true, data: { ok: true } };
  } catch (exc) {
    return fehlerAus(exc, "Regelsatz konnte nicht gelöscht werden.");
  }
}

/** Einen Rabatt des Regelsatzes anlegen. */
export async function legeRabattAn(
  propertyId: string,
  rabatt: {
    season_id: string | null;
    discount_type: Rabatt["discount_type"];
    discount_bps: number;
    min_nights?: number | null;
    lead_min_days?: number | null;
    lead_max_days?: number | null;
  },
): Promise<Ergebnis<Rabatt>> {
  try {
    const data = await api<Rabatt>(
      `/pricing/discounts/${encodeURIComponent(propertyId)}`,
      { method: "POST", body: rabatt },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Rabatt konnte nicht angelegt werden.");
  }
}

/** Einen Rabatt löschen. */
export async function loescheRabatt(
  propertyId: string,
  discountId: string,
): Promise<Ergebnis<{ ok: true }>> {
  try {
    await api(
      `/pricing/discounts/${encodeURIComponent(propertyId)}/${encodeURIComponent(discountId)}`,
      { method: "DELETE" },
    );
    return { ok: true, data: { ok: true } };
  } catch (exc) {
    return fehlerAus(exc, "Rabatt konnte nicht gelöscht werden.");
  }
}

/**
 * Den Betrag einer Saison ändern (Prozentsatz bzw. fester Nachtpreis).
 *
 * Das ist der „Speichern"-Knopf auf der Regelsatz-Karte: der häufigste
 * Eingriff („Hochsaison von +30 auf +35") soll nicht über zwei Seiten gehen.
 * Alles andere an einer Saison (Name, Farbe, Modus) bleibt dem Preisbereich
 * des Objekts vorbehalten — eine zweite volle Bearbeitung wäre eine zweite
 * Wahrheit über dieselben Daten.
 */
export async function setzeSaisonBetrag(
  seasonId: string,
  betrag: number,
): Promise<Ergebnis<Saison>> {
  if (!Number.isFinite(betrag)) {
    return { ok: false, fehler: "Bitte einen Wert eingeben." };
  }
  try {
    const data = await api<Saison>(
      `/calendar/seasons/${encodeURIComponent(seasonId)}`,
      { method: "PATCH", body: { amount: betrag } },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Saison konnte nicht gespeichert werden.");
  }
}

/** Einen Zeitraum einer Saison zuweisen (ein Objekt — Saisons hängen am Objekt). */
export async function weiseSaisonZu(
  propertyId: string,
  seasonId: string,
  ersterTag: string,
  letzterTag: string,
): Promise<Ergebnis<{ ok: true }>> {
  try {
    await api("/calendar/seasons/assign", {
      method: "POST",
      body: {
        property_id: propertyId,
        season_id: seasonId,
        range: { start: ersterTag, end: tagPlus(letzterTag, 1) },
      },
    });
    return { ok: true, data: { ok: true } };
  } catch (exc) {
    return fehlerAus(exc, "Saison konnte nicht zugewiesen werden.");
  }
}

/**
 * Einen Regelsatz auf eine Kalenderauswahl ANWENDEN — der Knopf, der im
 * Vorbild „Speichern" heißt und dort `onApply` auslöst.
 *
 * Zwei Fälle, weil unsere Regelsätze am OBJEKT hängen und nicht am Konto:
 *   • Das Objekt der Auswahl hat den Satz selbst → Zeitraum zuweisen.
 *   • Es hat ihn nicht → der Satz wird zuerst als eigenständige KOPIE dorthin
 *     übertragen (`/seasons/{id}/apply`, ohne Zeiträume), dann zugewiesen.
 * Beides zusammen ergibt genau das, was das Vorbild mit konto-weiten Sätzen
 * macht — ohne die Objektbindung aufzugeben, die unser Datenmodell trägt.
 *
 * Zurück kommt, welche Objekte bedient wurden. Ein stilles „fertig" bei
 * teilweisem Erfolg wäre derselbe Fehler wie ein verschluckter Fehler
 * (Wurzel 5): der Gastgeber sieht sonst 3 von 8 Objekten gefärbt und hält es
 * für einen Anzeigefehler.
 */
export async function wendeRegelsatzAn(
  saison: Saison,
  propertyIds: string[],
  ersterTag: string,
  letzterTag: string,
): Promise<Ergebnis<{ gesetzt: string[]; fehlgeschlagen: string[] }>> {
  const fremde = propertyIds.filter((id) => id !== saison.property_id);
  if (fremde.length > 0) {
    try {
      await api(`/calendar/seasons/${encodeURIComponent(saison.id)}/apply`, {
        method: "POST",
        body: { property_ids: fremde, mit_zeitraeumen: false },
      });
    } catch (exc) {
      return fehlerAus(exc, "Regelsatz konnte nicht übertragen werden.");
    }
  }
  // Nach dem Übertragen trägt jedes Zielobjekt einen gleichnamigen Satz mit
  // EIGENER id (UNIQUE property_id, name) — die brauchen wir zum Zuweisen.
  const frisch = await ladeSaisons(propertyIds);
  if (!frisch.ok) return frisch;

  const gesetzt: string[] = [];
  const fehlgeschlagen: string[] = [];
  for (const id of propertyIds) {
    const ziel =
      id === saison.property_id
        ? saison
        : frisch.data.find((s) => s.property_id === id && s.name === saison.name);
    if (!ziel) {
      fehlgeschlagen.push(id);
      continue;
    }
    const res = await weiseSaisonZu(id, ziel.id, ersterTag, letzterTag);
    if (res.ok) gesetzt.push(id);
    else fehlgeschlagen.push(id);
  }
  return { ok: true, data: { gesetzt, fehlgeschlagen } };
}

/** Einen Zeitraum aus allen Saisons lösen (fällt auf den Basispreis zurück). */
export async function loeseSaison(
  propertyId: string,
  ersterTag: string,
  letzterTag: string,
): Promise<Ergebnis<{ ok: true }>> {
  try {
    await api("/calendar/seasons/clear", {
      method: "POST",
      body: {
        property_id: propertyId,
        range: { start: ersterTag, end: tagPlus(letzterTag, 1) },
      },
    });
    return { ok: true, data: { ok: true } };
  } catch (exc) {
    return fehlerAus(exc, "Saison konnte nicht gelöst werden.");
  }
}

/**
 * Höchstens so viele Schreib-Aufrufe gleichzeitig. Der Preis-Endpunkt nimmt
 * EINEN Tag je Aufruf; eine Auswahl über drei Objekte und zwei Wochen sind 42
 * Aufrufe. Streng nacheinander dauert das viele Sekunden, und der Gastgeber
 * hält den Knopf für kaputt (live gemessen am 06.09.2026: 12 Aufrufe ≈ 5 s).
 * Unbegrenzt parallel wäre die andere Falle — der Rate-Limiter der API.
 */
const GLEICHZEITIG = 6;

/** Aufgaben in Blöcken abarbeiten; der erste Fehler bricht ab und wird gemeldet. */
async function inBloecken<T>(
  aufgaben: (() => Promise<T>)[],
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  for (let i = 0; i < aufgaben.length; i += GLEICHZEITIG) {
    const block = aufgaben.slice(i, i + GLEICHZEITIG);
    const ergebnisse = await Promise.allSettled(block.map((fn) => fn()));
    const schlecht = ergebnisse.find((e) => e.status === "rejected");
    if (schlecht && schlecht.status === "rejected") {
      // Was in diesem Block schon durchging, BLEIBT gespeichert — das sagt die
      // Meldung, statt einen sauberen Zustand zu behaupten (Wurzel 5).
      return fehlerAus(schlecht.reason, "Preis konnte nicht gespeichert werden.");
    }
  }
  return { ok: true };
}

/**
 * Tagespreis für jeden Tag des Bereichs setzen (null = Überschreibung
 * zurücknehmen, dann gilt wieder Basis-/Saison-/dynamischer Preis).
 */
export async function setzeTagespreise(
  propertyIds: string[],
  ersterTag: string,
  letzterTag: string,
  preis: number | null,
): Promise<Ergebnis<{ tage: number }>> {
  if (preis !== null && (!Number.isFinite(preis) || preis <= 0)) {
    return { ok: false, fehler: "Bitte einen Preis größer als 0 eingeben." };
  }
  const tage: string[] = [];
  for (let d = ersterTag; d <= letzterTag; d = tagPlus(d, 1)) {
    tage.push(d);
    if (tage.length > 366) {
      return { ok: false, fehler: "Bitte höchstens ein Jahr auf einmal ändern." };
    }
  }
  const aufgaben = propertyIds.flatMap((property_id) =>
    tage.map(
      (date) => () =>
        api("/calendar/price-override", {
          method: "POST",
          body: { property_id, date, price: preis },
        }),
    ),
  );
  const res = await inBloecken(aufgaben);
  if (!res.ok) return res;
  return { ok: true, data: { tage: aufgaben.length } };
}

export interface BuchungDetail {
  id: string;
  property_id: string;
  property_title: string;
  guest_id: string | null;
  guest_name: string;
  channel: string;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: string;
  num_guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  currency: string;
  total_amount: number | null;
  paid_amount: number | null;
  guest_email: string | null;
  guest_phone: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  is_owner_stay: boolean;
  booked_at: string | null;
  created_at: string | null;
}

export interface BuchungsNotiz {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string | null;
}

/** Buchung + Notizverlauf für das Detail-Panel. */
export async function ladeBuchung(
  id: string,
): Promise<Ergebnis<{ buchung: BuchungDetail; notizen: BuchungsNotiz[] }>> {
  try {
    const [buchung, notizen] = await Promise.all([
      api<BuchungDetail>(`/reservations/${encodeURIComponent(id)}`, { cache: "no-store" }),
      api<{ items: BuchungsNotiz[] }>(`/reservations/${encodeURIComponent(id)}/notes`, {
        cache: "no-store",
      }),
    ]);
    return { ok: true, data: { buchung, notizen: notizen.items } };
  } catch (exc) {
    return fehlerAus(exc, "Buchung konnte nicht geladen werden.");
  }
}

/** Private Notiz an die Buchung hängen (Verlauf, nicht überschreibend). */
export async function notizAnlegen(
  reservationId: string,
  body: string,
): Promise<Ergebnis<BuchungsNotiz>> {
  const text = body.trim();
  if (!text) return { ok: false, fehler: "Die Notiz ist leer." };
  try {
    const data = await api<BuchungsNotiz>(
      `/reservations/${encodeURIComponent(reservationId)}/notes`,
      { method: "POST", body: { body: text } },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Notiz konnte nicht gespeichert werden.");
  }
}
