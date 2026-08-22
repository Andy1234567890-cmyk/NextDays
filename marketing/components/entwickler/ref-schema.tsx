// Schema-Baum: Felder eines Anfrage-Körpers oder einer Antwort.
//
// Referenz-UX: ReadMe zeigt je Feld „name  typ  required" und die Beschreibung
// darunter, verschachtelte Objekte eingerückt. Übernommen ist diese Form.
//
// Server-Komponente: das Auflösen der `$ref`s und das Ausklappen passiert beim
// Rendern, nicht im Browser. Damit bleibt die 120 kB große Spec auf dem Server
// und der Leser bekommt fertiges HTML — eine Doku muss ohne JavaScript lesbar
// sein.
import { Prosa } from "@/components/entwickler/doku";
import type { SchemaObjekt } from "@/lib/openapi";
import { aufloesen, erlaubteWerte, standardWert, typName } from "@/lib/openapi";

/** Tiefenbegrenzung gegen Selbstbezüge und gegen unlesbare Verschachtelung. */
const MAX_TIEFE = 3;

function Chip({ text }: { text: string }) {
  return (
    <span className="rounded bg-surface-warm px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
      {text}
    </span>
  );
}

export type SchemaLabels = {
  pflicht: string;
  standard: string;
  erlaubt: string;
};

function Feld({
  name,
  schema,
  pflicht,
  tiefe,
  labels,
}: {
  name: string;
  schema: SchemaObjekt;
  pflicht: boolean;
  tiefe: number;
  labels: SchemaLabels;
}) {
  const aufgeloest = aufloesen(schema);
  const werte = erlaubteWerte(schema);
  const standard = standardWert(schema);
  const unter = aufgeloest?.properties;
  const inArray = aufloesen(aufgeloest?.items)?.properties;

  return (
    <div className="border-b border-border py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="font-mono text-sm font-semibold">{name}</code>
        <span className="font-mono text-xs text-muted-foreground">
          {typName(schema)}
        </span>
        {pflicht ? (
          <span className="font-mono text-[0.6875rem] font-semibold text-destructive">
            {labels.pflicht}
          </span>
        ) : null}
        {standard !== undefined ? (
          <Chip text={`${labels.standard} ${standard}`} />
        ) : null}
      </div>

      {aufgeloest?.description ? (
        <p className="mt-1 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          <Prosa>{aufgeloest.description}</Prosa>
        </p>
      ) : null}

      {werte.length ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{labels.erlaubt}</span>
          {werte.map((w) => (
            <Chip key={w} text={w} />
          ))}
        </div>
      ) : null}

      {/* Verschachtelte Felder eingerückt — bei Arrays die Felder des
          Element-Typs, sonst wüsste niemand, was in der Liste steht. */}
      {tiefe < MAX_TIEFE && (unter || inArray) ? (
        <div className="mt-2 border-l border-border pl-4">
          <RefSchema
            schema={unter ? aufgeloest : aufloesen(aufgeloest?.items)}
            tiefe={tiefe + 1}
            labels={labels}
          />
        </div>
      ) : null}
    </div>
  );
}

export function RefSchema({
  schema,
  labels,
  tiefe = 0,
}: {
  schema?: SchemaObjekt;
  /** Übersetzte Beschriftungen — bewusst ohne Vorbelegung: ein deutscher oder
   *  englischer Vorgabewert würde in den 23 anderen Sprachen unbemerkt
   *  stehenbleiben. */
  labels: SchemaLabels;
  tiefe?: number;
}) {
  const aufgeloest = aufloesen(schema);
  if (!aufgeloest) return null;

  // Ein Körper, der selbst eine Liste ist: die Felder des Elements zeigen.
  const eigenschaften =
    aufgeloest.properties ?? aufloesen(aufgeloest.items)?.properties;

  if (!eigenschaften) {
    // Kein Objekt — also ein einfacher Typ. Dann ist die Typangabe die
    // vollständige Information, und eine leere Tabelle wäre irreführend.
    return (
      <p className="font-mono text-sm text-muted-foreground">
        {typName(aufgeloest)}
      </p>
    );
  }

  const pflichtfelder = new Set(
    (aufgeloest.required ?? aufloesen(aufgeloest.items)?.required) ?? [],
  );

  return (
    <div>
      {Object.entries(eigenschaften).map(([name, feldSchema]) => (
        <Feld
          key={name}
          name={name}
          schema={feldSchema}
          labels={labels}
          pflicht={pflichtfelder.has(name)}
          tiefe={tiefe}
        />
      ))}
    </div>
  );
}
