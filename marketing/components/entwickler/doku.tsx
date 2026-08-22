// Die Bausteine der Doku-Seiten — bewusst wenige und bewusst schmucklos.
//
// Referenz-UX: docs.lodgify.com (ReadMe.io), live abgelesen am 22.08.2026. Eine
// Doku-Seite dort besteht aus genau vier Dingen: H1, Fließtext, H2-Abschnitte,
// Codeblöcke. Keine Kacheln, keine Icons in farbigen Quadraten, keine
// zweispaltigen Karten-Grids. Das ist kein Geschmack, sondern Funktion — man
// liest eine Doku im Zickzack und sucht Überschriften, und eine Kachel
// unterbricht diesen Blick, ohne etwas hinzuzufügen.
//
// Genau das war der Fehler der ersten Fassung: die Kapitel wurden aus dem
// Marketing-Baukasten (`SectionHeading`, Karten-Grid, Icon-Quadrate) gebaut und
// sahen deshalb aus wie eine Produktseite mit technischem Text darin.
//
// `Prosa` rendert Inline-Code aus Backticks. Die Texte in den 24 Sprachdateien
// enthalten Feldnamen wie `units_available`; als roher Text mit Backticks
// gelesen ist das Rauschen, als <code> ist es die Information.
import type { ReactNode } from "react";

/** Kopf einer Doku-Seite: eine H1 und ein Satz, worum es geht. */
export function DokuKopf({
  eyebrow,
  titel,
  lead,
}: {
  eyebrow?: string;
  titel: string;
  lead?: string;
}) {
  return (
    <header className="border-b border-border pb-8">
      {eyebrow ? (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {titel}
      </h1>
      {lead ? (
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          <Prosa>{lead}</Prosa>
        </p>
      ) : null}
    </header>
  );
}

/** Ein Abschnitt mit H2 und eigenem Anker — jede Überschrift ist verlinkbar. */
export function DokuAbschnitt({
  id,
  titel,
  children,
}: {
  id?: string;
  titel: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-border py-8 last:border-0">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {titel}
      </h2>
      <div className="mt-4 max-w-3xl space-y-4 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Untergeordnete Überschrift innerhalb eines Abschnitts. */
export function DokuTitel({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 font-display text-base font-semibold text-foreground">
      {children}
    </h3>
  );
}

/**
 * Der Satz, der die Integration richtig macht — die Konsequenz aus dem Absatz
 * darüber. Als Hinweisblock, wie ReadMe seine „Callouts" setzt: ein Balken
 * links, kein Kasten mit Schatten.
 */
export function Merksatz({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-accent bg-surface-accent/40 py-3 pl-4 pr-3 text-sm text-foreground">
      {children}
    </p>
  );
}

/** Eine schlichte Tabelle — Feld/Bedeutung, waagerecht scrollbar. */
export function DokuTabelle({
  kopf,
  children,
}: {
  kopf: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="border-b border-border">
          <tr>
            {kopf.map((k) => (
              <th key={k} className="py-2 pr-4 font-medium text-foreground">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

/** Aufzählung mit Punkten — für Regeln und Fälle. */
export function DokuListe({ punkte }: { punkte: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {punkte.map((p) => (
        <li key={p} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            <Prosa>{p}</Prosa>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Rendert `` `x` `` als <code> und `**x**` als Fettschrift.
 *
 * Bewusst kein Markdown-Parser: die Texte nutzen genau diese zwei
 * Auszeichnungen, und eine Bibliothek dafür wäre 40 kB für zwei Zeichenpaare.
 * Die Fettschrift kommt aus den Docstrings der Endpunkte — dort steht sie als
 * `**Warum nicht sofort erledigt:**`, und ohne diese Behandlung standen die
 * Sternchen sichtbar im Text.
 */
export function Prosa({ children }: { children: string }) {
  // Ein Ausdruck für beides, damit die Reihenfolge im Text erhalten bleibt:
  // Gruppe 1 = Inhalt zwischen Backticks, Gruppe 2 = Inhalt zwischen `**`.
  const teile = children.split(/`([^`]+)`|\*\*([^*]+)\*\*/g);
  return (
    <>
      {teile.map((teil, i) => {
        if (teil === undefined || teil === "") return null;
        const rest = i % 3;
        if (rest === 1) {
          return (
            <code
              key={i}
              className="rounded bg-surface-warm px-1 py-0.5 font-mono text-[0.8125em] text-foreground"
            >
              {teil}
            </code>
          );
        }
        if (rest === 2) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {teil}
            </strong>
          );
        }
        return teil;
      })}
    </>
  );
}
