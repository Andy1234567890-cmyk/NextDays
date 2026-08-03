"use client";

// Oberflächen-Bausteine der Preis-Seite im Branchenstandard-Layout (Referenz:
// Lodgify „Preise"): eine Spalte 57.5rem, Sektion = Kopf + Kartenliste, Karte =
// 13px-Titel/12px-Hinweis/Wert-Chips, Aktionen als Ghost (kein Rahmen, keine
// Füllung). Bewusst EIGENE Bausteine statt der generischen `Card`/`Pill`: dort
// gelten Radius 0.5rem, Innenabstand 1.25rem und 14px-Chips, die die anderen
// Objekt-Reiter tragen — dieses Layout wäre dort ein Fremdkörper.
import { Icon } from "@iconify/react";
import { Children } from "react";

import { Button } from "@nextdays/ui/button";
import { cn } from "@nextdays/ui/utils";

/** Hat der Block überhaupt sichtbaren Inhalt? `Children.toArray` wirft `null`,
 *  `undefined` und Booleans heraus — ein leeres Array oder ein `false` aus einer
 *  Bedingung darf KEINE leere Zeile aufziehen (die Karte trüge sonst 0.75rem
 *  Luft für nichts). */
function hatInhalt(children: React.ReactNode): boolean {
  return Children.toArray(children).length > 0;
}

/** Inhaltsspalte der Seite: 57.5rem breit, im Restplatz zentriert. */
export function PreisSpalte({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[57.5rem] flex-col">{children}</div>;
}

/** Seitenkopf: Titel im Display-Font, 2rem/2.5rem, danach 2rem Luft. */
export function PreisSeitenkopf({ title }: { title: string }) {
  return (
    <header className="pb-8">
      <h1 className="font-display text-[2rem] font-bold leading-10">{title}</h1>
    </header>
  );
}

/** Abschnitt: Kopfzeile (Titel + Hinweis + Aktion), darunter die Kartenliste. */
export function PreisAbschnitt({
  title,
  hint,
  badge,
  action,
  children,
}: {
  title: string;
  hint?: string;
  /** Kleiner Zusatz direkt neben dem Titel (z. B. „nur Direktbuchungen"). */
  badge?: React.ReactNode;
  /** Rechts in der Kopfzeile — im Normalfall `<PreisHinzufuegen>`. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="pb-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold leading-6">
            {title}
            {badge}
          </h2>
          {hint && (
            <p className="text-[0.8125rem] leading-5 text-muted-foreground">{hint}</p>
          )}
        </div>
        {action}
      </header>
      {hatInhalt(children) && <div className="mt-6 flex flex-col gap-4">{children}</div>}
    </section>
  );
}

/** Karte: Titelblock links, Aktion rechts, Wert-Chips in der Zeile darunter. */
export function PreisKarte({
  title,
  hint,
  badge,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Wert-Chips o. Ä. — füllt die zweite Zeile der Karte. */
  children?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {/* `font-sans!`/`font-semibold!`: `globals.css` setzt h1–h3 ungeschichtet
            auf Fraunces 800 — ungeschichtetes CSS gewinnt gegen Tailwind-
            Utilities. Ein Kartentitel ist aber Fließschrift 600 (13px), keine
            Display-Überschrift; ohne das `!` stünde hier eine fette Serifen-
            Zeile in 13px. */}
        <h3 className="flex items-center gap-2 font-sans! text-[0.8125rem] font-semibold! leading-5">
          {title}
          {badge}
        </h3>
        {hint && <p className="mt-2 text-xs leading-4 text-muted-foreground">{hint}</p>}
      </div>
      {action}
      {hatInhalt(children) && (
        <div className="flex w-full flex-wrap items-center gap-2">{children}</div>
      )}
    </article>
  );
}

/** Wert-Chip in einer Karte (13px, flacher Radius, gedeckte Fläche). */
export function PreisChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-[0.25rem] bg-muted px-[0.4rem] py-[0.125rem] text-[0.8125rem] leading-5 text-muted-foreground">
      {children}
    </span>
  );
}

/** Kleiner Status-Zusatz neben einem Titel. `info` = Einschränkung/Umfang,
 *  `success` = aktiv geschaltet — genau die zwei Töne des Branchenstandards. */
export function PreisBadge({
  tone = "info",
  children,
}: {
  tone?: "info" | "success";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        // `font-sans font-normal`: das Badge steht auch in einer Abschnitts-
        // Überschrift und erbte dort sonst Fraunces 800 aus der h2.
        "shrink-0 rounded-[0.25rem] px-1 py-0.5 font-sans text-xs font-normal leading-4",
        tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-950",
      )}
    >
      {children}
    </span>
  );
}

/* Die drei Aktions-Bausteine geben ALLE übrigen Props weiter (`...rest`). Das
   ist keine Bequemlichkeit: `DropdownMenuTrigger asChild` klont das Kind und
   hängt ihm `onClick`, `aria-expanded`, `data-state` und die `ref` an. Ohne
   Durchreichen verschluckt der Baustein sie — der Knopf sieht dann richtig aus,
   öffnet aber nichts. */

type AktionProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size">;

/** Abschnitts-Aktion „+ Hinzufügen": 2.25rem hoch, Pille, ohne Rahmen. */
export function PreisHinzufuegen({
  label,
  className,
  children,
  ...rest
}: AktionProps & { label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-9 shrink-0 gap-1 px-3 text-[0.8125rem] font-normal leading-5",
        className,
      )}
      {...rest}
    >
      {children ?? (
        <>
          <Icon icon="ph:plus" className="size-5" />
          {label}
        </>
      )}
    </Button>
  );
}

/** Karten-Aktion als Symbol (1.75rem): Stift, Papierkorb, Drei-Punkte. */
export function PreisSymbolAktion({
  icon,
  label,
  className,
  children,
  ...rest
}: AktionProps & { icon?: string; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      title={label}
      className={cn("size-7 shrink-0 rounded-full p-1", className)}
      {...rest}
    >
      {children ?? <Icon icon={icon ?? "ph:pencil-simple"} className="size-5" />}
    </Button>
  );
}

/** Karten-Aktion als Text (1.5rem, 12px) — steht dort, wo noch nichts
 *  eingerichtet ist und deshalb kein Stift passt. */
export function PreisTextAktion({
  label,
  className,
  children,
  ...rest
}: AktionProps & { label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-6 shrink-0 gap-1 px-2 text-xs font-normal leading-4",
        className,
      )}
      {...rest}
    >
      {children ?? label}
    </Button>
  );
}

/** Leer-Zustand eines Abschnitts: nur Text, keine leere Karte. */
export function PreisLeer({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.8125rem] leading-5 text-muted-foreground">{children}</p>;
}
