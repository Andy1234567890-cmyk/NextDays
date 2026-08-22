// Leser für die eingecheckte OpenAPI-Datei der öffentlichen API.
//
// Die Datei (`content/api/openapi.json`) wird von
// `scripts/api/openapi-export.py` aus dem Code erzeugt und vom CI gegen einen
// frischen Export geprüft. Hier wird sie NUR gelesen — kein Wert wird ergänzt,
// korrigiert oder erfunden. Fehlt etwas im Schema, fehlt es in der Doku, und
// das ist die richtige Richtung: eine Referenz, die mehr behauptet als der
// Code hergibt, ist schlimmer als eine lückenhafte.
//
// Warum ein eigener Leser und kein fertiger Renderer: die Referenz soll
// aussehen wie unsere Seite und auf unserer Domain liegen. Ein eingebetteter
// Fremd-Renderer bringt sein eigenes Design, seine eigene Navigation und im
// Zweifel seine eigenen Fremd-Requests mit.
import spec from "@/content/api/openapi.json";

// -- Die Teile der Spec, die wir anfassen ---------------------------------
// Bewusst schmal typisiert: nur was die Referenz rendert. Ein vollständiger
// OpenAPI-Typ wäre 600 Zeilen, von denen wir 40 benutzen.

export type SchemaObjekt = {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  anyOf?: SchemaObjekt[];
  allOf?: SchemaObjekt[];
  oneOf?: SchemaObjekt[];
  items?: SchemaObjekt;
  properties?: Record<string, SchemaObjekt>;
  required?: string[];
  additionalProperties?: boolean | SchemaObjekt;
  $ref?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  examples?: unknown[];
};

export type Parameter = {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObjekt;
};

type Inhalt = { schema?: SchemaObjekt };

export type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: { required?: boolean; content?: Record<string, Inhalt> };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, Inhalt> }
  >;
};

type Spec = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, SchemaObjekt> };
};

const DOK = spec as unknown as Spec;

export const METHODEN = ["get", "post", "put", "patch", "delete"] as const;
export type Methode = (typeof METHODEN)[number];

/** Ein Endpunkt, wie die Referenz ihn braucht. */
export type Endpunkt = {
  /** Stabiler URL-Teil, z. B. `get-v1-reservations`. */
  slug: string;
  methode: Methode;
  pfad: string;
  /** Volle Adresse inklusive Server — die Zeile unter der Überschrift. */
  url: string;
  titel: string;
  beschreibung?: string;
  gruppe: string;
  parameter: Parameter[];
  koerper?: SchemaObjekt;
  koerperPflicht: boolean;
  antworten: { code: string; beschreibung?: string; schema?: SchemaObjekt }[];
  /** Scopes, die der Endpunkt verlangt — aus der Beschreibung gelesen. */
  scopes: string[];
};

export type Gruppe = {
  name: string;
  beschreibung?: string;
  endpunkte: Endpunkt[];
};

export const API_INFO = {
  titel: DOK.info.title,
  version: DOK.info.version,
  openapi: DOK.openapi,
  basis: DOK.servers?.[0]?.url ?? "",
};

/**
 * `$ref` auflösen. Nur lokale Verweise (`#/components/schemas/…`) — die Spec
 * enthält keine anderen, und ein externer Verweis wäre ein Fremd-Request beim
 * Rendern.
 */
export function aufloesen(schema?: SchemaObjekt): SchemaObjekt | undefined {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace("#/components/schemas/", "");
  const ziel = DOK.components?.schemas?.[name];
  // Ein unauflösbarer Verweis wird NICHT stillschweigend zu einem leeren
  // Objekt: dann stünde in der Doku ein Feld ohne Typ, und niemand wüsste, dass
  // etwas fehlt. Der Titel macht es sichtbar.
  return ziel ?? { title: `⚠ unbekanntes Schema: ${name}` };
}

/**
 * Menschliche Typangabe für die Parameter-Tabelle: `int32`, `string`,
 * `date-time`, `array of string` …
 *
 * `anyOf` mit `null` ist die Form, in der Pydantic optionale Felder ausdrückt
 * (`str | None`). Für die Anzeige zählt der Nicht-Null-Zweig — sonst stünde bei
 * jedem optionalen Feld „string oder null", was nichts erklärt, weil „optional"
 * schon in der Pflicht-Spalte steht.
 */
export function typName(rohSchema?: SchemaObjekt): string {
  const schema = aufloesen(rohSchema);
  if (!schema) return "—";

  const zweige = schema.anyOf ?? schema.oneOf;
  if (zweige) {
    const echte = zweige.filter((z) => {
      const t = aufloesen(z)?.type;
      return t !== "null";
    });
    if (echte.length === 1) return typName(echte[0]);
    return echte.map((z) => typName(z)).join(" | ") || "null";
  }
  if (schema.allOf?.length) return typName(schema.allOf[0]);

  if (schema.format) return schema.format;
  const typ = Array.isArray(schema.type)
    ? schema.type.filter((t) => t !== "null").join(" | ")
    : schema.type;
  if (typ === "array") return `array of ${typName(schema.items)}`;
  if (typ === "object" && schema.title) return schema.title;
  return typ ?? (schema.title ? schema.title : "—");
}

/** Erlaubte Werte eines Parameters — für die „Allowed"-Chips. */
export function erlaubteWerte(rohSchema?: SchemaObjekt): string[] {
  const schema = aufloesen(rohSchema);
  if (!schema) return [];
  if (schema.enum) return schema.enum.map((w) => String(w));
  const zweige = schema.anyOf ?? schema.oneOf ?? schema.allOf ?? [];
  for (const zweig of zweige) {
    const treffer = erlaubteWerte(zweig);
    if (treffer.length) return treffer;
  }
  return [];
}

/** Standardwert als Text, oder `undefined` wenn keiner gesetzt ist. */
export function standardWert(rohSchema?: SchemaObjekt): string | undefined {
  const schema = aufloesen(rohSchema);
  if (schema?.default === undefined || schema.default === null) return undefined;
  return typeof schema.default === "string"
    ? schema.default
    : JSON.stringify(schema.default);
}

/**
 * Slug eines Endpunkts: `get-v1-reservations-id`.
 *
 * Aus Methode und Pfad gebaut, NICHT aus der `operationId` — die heißt bei
 * FastAPI `liste_v1_reservations_get` und wäre als URL unlesbar. Der Slug ist
 * Teil der Adresse, die jemand verlinkt und im Zweifel jahrelang aufruft;
 * er darf sich nur ändern, wenn sich der Pfad ändert.
 */
export function slugVon(methode: string, pfad: string): string {
  const teile = pfad
    .replace(/[{}]/g, "")
    // Unterstriche werden zu Bindestrichen: aus `{reservation_id}` wird
    // `reservation-id`. Eine Adresse mit gemischten Trennern
    // (`…-reservations-reservation_id-cancel`) liest sich wie ein Tippfehler,
    // und sie wird in Chats und Mails am Unterstrich umgebrochen.
    .replace(/_/g, "-")
    .split("/")
    .filter(Boolean)
    .join("-");
  return `${methode}-${teile}`.toLowerCase();
}

/**
 * Scope-Namen aus der Beschreibung eines Endpunkts lesen.
 *
 * Die Scopes stehen im Code am `Depends(scope_erforderlich("…"))`, nicht im
 * Schema — OpenAPI kennt sie nur, wenn man ein `security`-Objekt pflegt, und
 * das wäre eine zweite Stelle, die driften kann. Gelesen wird deshalb, was in
 * `summary`/`description` steht; die Endpunkt-Übersicht des Leitfadens nennt
 * sie zusätzlich je Gruppe.
 */
function scopesAus(text: string): string[] {
  const treffer = text.match(/\b[a-z_]+:(read|write)\b/g) ?? [];
  return [...new Set(treffer)];
}

function endpunktAus(pfad: string, methode: Methode, op: Operation): Endpunkt {
  const antworten = Object.entries(op.responses ?? {})
    .map(([code, wert]) => ({
      code,
      beschreibung: wert.description,
      schema: wert.content?.["application/json"]?.schema,
    }))
    // Erfolg zuerst, dann aufsteigend — dieselbe Reihenfolge wie im
    // Statuscode-Wähler des Code-Panels.
    .sort((a, b) => a.code.localeCompare(b.code));

  const koerperInhalt =
    op.requestBody?.content?.["application/json"]?.schema ?? undefined;

  return {
    slug: slugVon(methode, pfad),
    methode,
    pfad,
    url: `${API_INFO.basis}${pfad}`,
    titel: op.summary ?? `${methode.toUpperCase()} ${pfad}`,
    beschreibung: op.description,
    gruppe: op.tags?.[0] ?? "Sonstige",
    parameter: (op.parameters ?? []).filter((p) => p.in !== "cookie"),
    koerper: koerperInhalt,
    koerperPflicht: Boolean(op.requestBody?.required),
    antworten,
    scopes: scopesAus(`${op.summary ?? ""} ${op.description ?? ""}`),
  };
}

/**
 * Alle Endpunkte, gruppiert wie in der Spec (`tags`) und in deren Reihenfolge.
 *
 * Die Reihenfolge kommt aus `tags` der Spec, nicht aus der Sortierung der
 * Pfade: „Auth" muss vor „Objekte" stehen, weil man ohne Token nichts anderes
 * aufrufen kann. Eine alphabetische Liste würde mit „Aufgaben" beginnen.
 */
export function gruppen(): Gruppe[] {
  const nachGruppe = new Map<string, Endpunkt[]>();

  for (const [pfad, operationen] of Object.entries(DOK.paths)) {
    for (const methode of METHODEN) {
      const op = operationen[methode];
      if (!op) continue;
      const endpunkt = endpunktAus(pfad, methode, op);
      const liste = nachGruppe.get(endpunkt.gruppe) ?? [];
      liste.push(endpunkt);
      nachGruppe.set(endpunkt.gruppe, liste);
    }
  }

  const reihenfolge = (DOK.tags ?? []).map((t) => t.name);
  const bekannt = reihenfolge.filter((name) => nachGruppe.has(name));
  const unbekannt = [...nachGruppe.keys()].filter((n) => !reihenfolge.includes(n));

  return [...bekannt, ...unbekannt].map((name) => ({
    name,
    beschreibung: DOK.tags?.find((t) => t.name === name)?.description,
    endpunkte: (nachGruppe.get(name) ?? []).sort((a, b) => {
      // Innerhalb einer Gruppe: erst nach Pfad (kürzere zuerst — die Liste vor
      // dem Detail), dann Lesen vor Schreiben.
      if (a.pfad !== b.pfad) return a.pfad.length - b.pfad.length;
      return METHODEN.indexOf(a.methode) - METHODEN.indexOf(b.methode);
    }),
  }));
}

/** Flache Liste aller Endpunkte — für Suche und `generateStaticParams`. */
export function alleEndpunkte(): Endpunkt[] {
  return gruppen().flatMap((g) => g.endpunkte);
}

/** Einen Endpunkt über seinen Slug finden. */
export function endpunktMitSlug(slug: string): Endpunkt | undefined {
  return alleEndpunkte().find((e) => e.slug === slug);
}
