// Normalisierung des Startseiten-Layouts — reine Funktionen ohne React.
//
// Das gespeicherte Layout ist ein OVERLAY aus Positionen über dem Katalog
// (Migration 0402). Diese Datei macht daraus etwas, das das Raster sicher
// rendern kann:
//   · unbekannte IDs (Kachel im Code entfernt) fallen weg,
//   · Kacheln, die der Nutzer nicht sehen darf, fallen weg,
//   · neue Katalog-Kacheln (noch in keinem gespeicherten Layout) werden
//     ANGEHÄNGT, nicht ausgeblendet — der Betrieb soll Neues sehen,
//   · Dubletten werden auf den ersten Treffer reduziert,
//   · eine Größe, die die Kachel nicht trägt, wird auf ihre Standardgröße
//     gesetzt (das ist keine Erfindung, sondern der Katalogwert),
//   · x/y werden aus Reihenfolge + Breite NEU berechnet (Fließ-Packung im
//     12-Spalten-Raster). Damit gibt es keine Kollisionen: zwei Kacheln
//     können nie dieselbe Zelle beanspruchen, gleich was gespeichert war.
//
// Warum Fließ-Packung statt freier x/y-Platzierung: Drag-and-drop läuft über
// @dnd-kit/sortable, also über die REIHENFOLGE. x/y sind ein Ergebnis davon,
// das gespeichert wird, damit andere Clients (Mobile, Rollen-Standard-Vorschau)
// dieselbe Anordnung ohne eigenen Packer lesen können. CSS-Grid mit
// `grid-auto-flow: row` platziert dieselbe Reihenfolge exakt gleich.
import {
  BREITE,
  KATALOG,
  type KachelGroesse,
  type KachelId,
  SPALTEN,
  istKachelId,
  kachelDefinition,
} from "@/lib/dashboard-katalog";

export const SCHEMA_VERSION = 1;

export type KachelPosition = {
  id: KachelId;
  x: number;
  y: number;
  groesse: KachelGroesse;
};

export type DashboardLayout = {
  schema_version: number;
  kacheln: KachelPosition[];
  ausgeblendet: KachelId[];
};

/** Das, womit die UI intern arbeitet: geordnete Liste + Größe, ohne x/y. */
export type KachelEintrag = { id: KachelId; groesse: KachelGroesse };

export type Anordnung = {
  sichtbar: KachelEintrag[];
  ausgeblendet: KachelId[];
};

/** Katalog-Standard für die erlaubten Kacheln, in Katalog-Reihenfolge. */
export function standardAnordnung(erlaubt: readonly KachelId[]): Anordnung {
  const menge = new Set(erlaubt);
  return {
    sichtbar: KATALOG.filter((k) => menge.has(k.id)).map((k) => ({
      id: k.id,
      groesse: k.standardGroesse,
    })),
    ausgeblendet: [],
  };
}

function groesseGueltig(id: KachelId, groesse: unknown): KachelGroesse {
  const def = kachelDefinition(id);
  return typeof groesse === "string" &&
    (def.groessen as readonly string[]).includes(groesse)
    ? (groesse as KachelGroesse)
    : def.standardGroesse;
}

/**
 * Gespeichertes Layout (oder null) + erlaubte Kacheln → saubere Anordnung.
 *
 * Reihenfolge der gespeicherten Kacheln: erst y, dann x — so, wie sie im
 * Raster standen. Fehlt das Layout ganz, gilt der Katalog-Standard.
 */
export function anordnungAusLayout(
  layout: DashboardLayout | null | undefined,
  erlaubt: readonly KachelId[],
): Anordnung {
  if (!layout) return standardAnordnung(erlaubt);
  const menge = new Set(erlaubt);

  const ausgeblendet: KachelId[] = [];
  for (const id of layout.ausgeblendet ?? []) {
    if (istKachelId(id) && menge.has(id) && !ausgeblendet.includes(id)) {
      ausgeblendet.push(id);
    }
  }
  const versteckt = new Set(ausgeblendet);

  const sortiert = [...(layout.kacheln ?? [])].sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );
  const gesehen = new Set<KachelId>();
  const sichtbar: KachelEintrag[] = [];
  for (const k of sortiert) {
    if (!istKachelId(k.id) || !menge.has(k.id)) continue;
    if (versteckt.has(k.id) || gesehen.has(k.id)) continue;
    gesehen.add(k.id);
    sichtbar.push({ id: k.id, groesse: groesseGueltig(k.id, k.groesse) });
  }
  // Neue Kacheln anhängen — in Katalog-Reihenfolge, damit zwei neue Kacheln
  // nicht in zufälliger Ordnung landen.
  for (const def of KATALOG) {
    if (!menge.has(def.id) || gesehen.has(def.id) || versteckt.has(def.id)) {
      continue;
    }
    sichtbar.push({ id: def.id, groesse: def.standardGroesse });
  }
  return { sichtbar, ausgeblendet };
}

/**
 * Fließ-Packung: Kacheln in Reihenfolge von links nach rechts, Zeilenumbruch,
 * wenn die Breite nicht mehr in die Zeile passt. Genau das, was CSS-Grid mit
 * `grid-auto-flow: row` (nicht `dense`) aus derselben Reihenfolge macht.
 */
export function packen(sichtbar: readonly KachelEintrag[]): KachelPosition[] {
  const ergebnis: KachelPosition[] = [];
  let x = 0;
  let y = 0;
  for (const k of sichtbar) {
    const w = BREITE[k.groesse];
    if (x + w > SPALTEN) {
      x = 0;
      y += 1;
    }
    ergebnis.push({ id: k.id, x, y, groesse: k.groesse });
    x += w;
    if (x >= SPALTEN) {
      x = 0;
      y += 1;
    }
  }
  return ergebnis;
}

/** Anordnung → das Layout, das der Server annimmt (Pydantic-Form 0402). */
export function layoutAusAnordnung(anordnung: Anordnung): DashboardLayout {
  return {
    schema_version: SCHEMA_VERSION,
    kacheln: packen(anordnung.sichtbar),
    ausgeblendet: [...anordnung.ausgeblendet],
  };
}

/** Prüft, dass keine zwei Kacheln eine Zelle teilen. Nur für Tests/Debug —
 *  `packen` kann keine Kollision erzeugen, der Test beweist das. */
export function hatKollision(kacheln: readonly KachelPosition[]): boolean {
  const belegt = new Set<string>();
  for (const k of kacheln) {
    for (let dx = 0; dx < BREITE[k.groesse]; dx += 1) {
      const zelle = `${k.x + dx}:${k.y}`;
      if (belegt.has(zelle)) return true;
      belegt.add(zelle);
    }
    if (k.x + BREITE[k.groesse] > SPALTEN) return true;
  }
  return false;
}

// --- Operationen des Anpassen-Modus -----------------------------------------

export function verschieben(
  anordnung: Anordnung,
  von: KachelId,
  nach: KachelId,
): Anordnung {
  const alt = anordnung.sichtbar;
  const i = alt.findIndex((k) => k.id === von);
  const j = alt.findIndex((k) => k.id === nach);
  if (i < 0 || j < 0 || i === j) return anordnung;
  const neu = [...alt];
  const [bewegt] = neu.splice(i, 1);
  neu.splice(j, 0, bewegt);
  return { ...anordnung, sichtbar: neu };
}

export function groesseSetzen(
  anordnung: Anordnung,
  id: KachelId,
  groesse: KachelGroesse,
): Anordnung {
  const def = kachelDefinition(id);
  if (!def.groessen.includes(groesse)) return anordnung;
  return {
    ...anordnung,
    sichtbar: anordnung.sichtbar.map((k) =>
      k.id === id ? { ...k, groesse } : k,
    ),
  };
}

export function ausblenden(anordnung: Anordnung, id: KachelId): Anordnung {
  if (!anordnung.sichtbar.some((k) => k.id === id)) return anordnung;
  return {
    sichtbar: anordnung.sichtbar.filter((k) => k.id !== id),
    ausgeblendet: [...anordnung.ausgeblendet, id],
  };
}

/** Wieder einblenden: die Kachel kommt ans ENDE — dort sieht der Nutzer sie
 *  sicher, statt sie an einer alten Stelle suchen zu müssen. */
export function einblenden(anordnung: Anordnung, id: KachelId): Anordnung {
  if (!anordnung.ausgeblendet.includes(id)) return anordnung;
  return {
    sichtbar: [
      ...anordnung.sichtbar,
      { id, groesse: kachelDefinition(id).standardGroesse },
    ],
    ausgeblendet: anordnung.ausgeblendet.filter((k) => k !== id),
  };
}

export function anordnungGleich(a: Anordnung, b: Anordnung): boolean {
  if (a.sichtbar.length !== b.sichtbar.length) return false;
  if (a.ausgeblendet.length !== b.ausgeblendet.length) return false;
  for (let i = 0; i < a.sichtbar.length; i += 1) {
    if (
      a.sichtbar[i].id !== b.sichtbar[i].id ||
      a.sichtbar[i].groesse !== b.sichtbar[i].groesse
    ) {
      return false;
    }
  }
  return a.ausgeblendet.every((id, i) => b.ausgeblendet[i] === id);
}
