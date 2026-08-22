// Erzeugt die Code-Beispiele im rechten Panel der API-Referenz.
//
// Aus dem Endpunkt selbst gebaut, nicht handgepflegt: über 40 Endpunkte × 5 Sprachen
// wären 90 Schnipsel, von denen 89 beim nächsten neuen Parameter veralten.
// Was hier herauskommt, stimmt per Konstruktion mit der OpenAPI-Datei überein —
// und die stimmt per CI mit dem Code überein.
//
// Bewusst OHNE Fremdbibliothek: die Beispiele nutzen curl, `fetch`,
// `urllib`/`requests`, `cURL` in PHP und `net/http` in Ruby — also das, was
// überall vorhanden ist. Ein Beispiel, das erst eine Installation braucht, ist
// für den ersten Aufruf das falsche Beispiel.
import type { Endpunkt, SchemaObjekt } from "@/lib/openapi";
import { aufloesen, standardWert } from "@/lib/openapi";

export const SPRACHEN = [
  { id: "shell", label: "Shell" },
  { id: "node", label: "Node" },
  { id: "python", label: "Python" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
] as const;

export type SpracheId = (typeof SPRACHEN)[number]["id"];

/** Welche Werte der Nutzer im Panel eingetragen hat. */
export type Eingaben = Record<string, string>;

const TOKEN_PLATZHALTER = "<access_token>";

/**
 * Beispielwert für ein Schema — nur zum Ausfüllen eines Körpers.
 *
 * Nimmt bevorzugt, was in der Spec steht (`examples`, `default`), sonst einen
 * typgerechten Platzhalter. Die Platzhalter sind erkennbar als solche
 * (`"…"`, `0`): ein erfundener echt aussehender Wert wäre schlimmer, weil man
 * ihn kopiert und sich fragt, warum die Buchung auf einem fremden Objekt
 * landet.
 */
function beispielWert(rohSchema?: SchemaObjekt): unknown {
  const schema = aufloesen(rohSchema);
  if (!schema) return null;

  if (schema.examples?.length) return schema.examples[0];
  if (schema.default !== undefined && schema.default !== null) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  const zweige = schema.anyOf ?? schema.oneOf;
  if (zweige) {
    const echt = zweige.find((z) => aufloesen(z)?.type !== "null");
    return echt ? beispielWert(echt) : null;
  }
  if (schema.allOf?.length) return beispielWert(schema.allOf[0]);

  const typ = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;

  switch (typ) {
    case "string":
      if (schema.format === "date") return "2026-09-10";
      if (schema.format === "date-time") return "2026-09-10T14:00:00Z";
      if (schema.format === "uuid") return "8f14e45f-…";
      return "…";
    case "integer":
      return schema.minimum ?? 1;
    case "number":
      return schema.minimum ?? 0;
    case "boolean":
      return false;
    case "array":
      return [beispielWert(schema.items)];
    case "object": {
      const felder = schema.properties ?? {};
      // Nur Pflichtfelder ins Beispiel, sonst wird aus einer Buchung mit fünf
      // nötigen Angaben ein Block mit dreißig Zeilen, in dem man das Wesentliche
      // nicht findet.
      const pflicht = schema.required ?? Object.keys(felder).slice(0, 4);
      const raus: Record<string, unknown> = {};
      for (const name of pflicht) {
        if (felder[name]) raus[name] = beispielWert(felder[name]);
      }
      return raus;
    }
    default:
      return null;
  }
}

/** Der Körper als formatiertes JSON — oder `null`, wenn der Endpunkt keinen hat. */
export function koerperBeispiel(endpunkt: Endpunkt): string | null {
  if (!endpunkt.koerper) return null;
  const wert = beispielWert(endpunkt.koerper);
  if (!wert || (typeof wert === "object" && Object.keys(wert).length === 0)) {
    return null;
  }
  return JSON.stringify(wert, null, 2);
}

/** Pfad mit eingesetzten Pfad-Parametern. */
function pfadMitWerten(endpunkt: Endpunkt, eingaben: Eingaben): string {
  let pfad = endpunkt.pfad;
  for (const p of endpunkt.parameter.filter((x) => x.in === "path")) {
    const wert = eingaben[p.name]?.trim() || `<${p.name}>`;
    pfad = pfad.replace(`{${p.name}}`, encodeURIComponent(wert));
  }
  return pfad;
}

/**
 * Query-Zeichenkette aus den Eingaben.
 *
 * Ein Parameter erscheint nur, wenn ein Wert eingetragen ODER er Pflicht ist.
 * Alle Standardwerte mitzuschicken macht das Beispiel länger, ohne dass sich
 * die Antwort ändert — und verdeckt, welche Angaben wirklich nötig sind.
 */
function queryTeil(endpunkt: Endpunkt, eingaben: Eingaben): string {
  const paare: string[] = [];
  for (const p of endpunkt.parameter.filter((x) => x.in === "query")) {
    const eingabe = eingaben[p.name]?.trim();
    const wert = eingabe || (p.required ? (standardWert(p.schema) ?? `<${p.name}>`) : "");
    if (!wert) continue;
    paare.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(wert)}`);
  }
  return paare.length ? `?${paare.join("&")}` : "";
}

/** Zusatz-Header, die der Endpunkt verlangt (z. B. `Idempotency-Key`). */
function zusatzHeader(endpunkt: Endpunkt, eingaben: Eingaben): [string, string][] {
  return endpunkt.parameter
    .filter((p) => p.in === "header" && p.name.toLowerCase() !== "authorization")
    .map((p) => {
      const wert =
        eingaben[p.name]?.trim() ||
        (p.name === "Idempotency-Key"
          ? "8f9a1c30-6b1e-4d2a-9f77-4e0c1b2d3a55"
          : `<${p.name}>`);
      return [p.name, wert] as [string, string];
    });
}

type Bausteine = {
  methode: string;
  url: string;
  koerper: string | null;
  header: [string, string][];
};

function bausteine(
  endpunkt: Endpunkt,
  basis: string,
  eingaben: Eingaben,
  token: string,
): Bausteine {
  const header: [string, string][] = [
    ["Authorization", `Bearer ${token || TOKEN_PLATZHALTER}`],
  ];
  const koerper = koerperBeispiel(endpunkt);
  if (koerper) header.push(["Content-Type", "application/json"]);
  header.push(...zusatzHeader(endpunkt, eingaben));

  return {
    methode: endpunkt.methode.toUpperCase(),
    url: `${basis}${pfadMitWerten(endpunkt, eingaben)}${queryTeil(endpunkt, eingaben)}`,
    koerper,
    header,
  };
}

// -- Die fünf Erzeuger ------------------------------------------------------

function alsShell(b: Bausteine): string {
  const zeilen = [`curl -X ${b.methode} '${b.url}'`];
  for (const [name, wert] of b.header) zeilen.push(`  -H '${name}: ${wert}'`);
  if (b.koerper) {
    // Einzeilige Fortsetzung mit `-d @-` wäre kürzer, aber nicht kopierbar in
    // eine Shell, in der schon etwas anderes läuft. Heredoc-frei bleiben.
    zeilen.push(`  -d '${b.koerper.replace(/'/g, "'\\''")}'`);
  }
  return zeilen.join(" \\\n");
}

function alsNode(b: Bausteine): string {
  const header = b.header
    .map(([n, w]) => `    ${JSON.stringify(n)}: ${JSON.stringify(w)},`)
    .join("\n");
  const koerper = b.koerper ? `,\n  body: JSON.stringify(${b.koerper})` : "";
  return `const antwort = await fetch(${JSON.stringify(b.url)}, {
  method: ${JSON.stringify(b.methode)},
  headers: {
${header}
  }${koerper}
});

if (!antwort.ok) {
  // Fehler kommen als application/problem+json — auf \`code\` verzweigen,
  // nicht auf den Text.
  const problem = await antwort.json();
  throw new Error(\`\${problem.code}: \${problem.detail}\`);
}
const daten = await antwort.json();`;
}

function alsPython(b: Bausteine): string {
  const header = b.header
    .map(([n, w]) => `    ${JSON.stringify(n)}: ${JSON.stringify(w)},`)
    .join("\n");
  const koerper = b.koerper ? `\njson=${b.koerper.replace(/"/g, '"')}` : "";
  return `import requests

antwort = requests.${b.methode.toLowerCase()}(
    ${JSON.stringify(b.url)},
    headers={
${header}
    },${koerper ? `\n    json=${b.koerper},` : ""}
    timeout=30,
)
antwort.raise_for_status()
daten = antwort.json()`;
}

function alsPhp(b: Bausteine): string {
  const header = b.header.map(([n, w]) => `    '${n}: ${w}',`).join("\n");
  const koerper = b.koerper
    ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, <<<'JSON'\n${b.koerper}\nJSON);`
    : "";
  return `<?php
$ch = curl_init(${JSON.stringify(b.url)});
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${b.methode}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
${header}
]);${koerper}

$antwort = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

$daten = json_decode($antwort, true);`;
}

function alsRuby(b: Bausteine): string {
  const header = b.header.map(([n, w]) => `anfrage[${JSON.stringify(n)}] = ${JSON.stringify(w)}`).join("\n");
  const koerper = b.koerper ? `\nanfrage.body = <<~JSON\n${b.koerper.replace(/^/gm, "  ")}\nJSON` : "";
  const klasse = `Net::HTTP::${b.methode.charAt(0)}${b.methode.slice(1).toLowerCase()}`;
  return `require "net/http"
require "json"

adresse = URI(${JSON.stringify(b.url)})
anfrage = ${klasse}.new(adresse)
${header}${koerper}

antwort = Net::HTTP.start(adresse.hostname, adresse.port, use_ssl: true) do |http|
  http.request(anfrage)
end

daten = JSON.parse(antwort.body)`;
}

/** Das Beispiel für eine Sprache. */
export function codeBeispiel(
  endpunkt: Endpunkt,
  sprache: SpracheId,
  basis: string,
  eingaben: Eingaben = {},
  token = "",
): string {
  const b = bausteine(endpunkt, basis, eingaben, token);
  switch (sprache) {
    case "node":
      return alsNode(b);
    case "python":
      return alsPython(b);
    case "php":
      return alsPhp(b);
    case "ruby":
      return alsRuby(b);
    default:
      return alsShell(b);
  }
}

/** Die tatsächliche Anfrage für „Ausprobieren" — dieselben Bausteine. */
export function anfrageDaten(
  endpunkt: Endpunkt,
  basis: string,
  eingaben: Eingaben,
  token: string,
): { url: string; init: RequestInit } {
  const b = bausteine(endpunkt, basis, eingaben, token);
  return {
    url: b.url,
    init: {
      method: b.methode,
      headers: Object.fromEntries(b.header),
      ...(b.koerper ? { body: b.koerper } : {}),
    },
  };
}

/** Beispielantwort zu einem Statuscode — für das untere Panel. */
export function antwortBeispiel(endpunkt: Endpunkt, code: string): string {
  const antwort = endpunkt.antworten.find((a) => a.code === code);
  if (!antwort?.schema) {
    return JSON.stringify(
      { hinweis: antwort?.beschreibung ?? "Kein Antwortkörper dokumentiert." },
      null,
      2,
    );
  }
  return JSON.stringify(beispielWert(antwort.schema), null, 2);
}
