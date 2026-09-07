"use client";

// Die acht Symbole der Ausrichtungsreihe — Framers eigene Pfade, aus dem DOM
// der rechten Leiste abgelesen (05.09.2026, vom Nutzer eingefügt; Klasse
// `.alignment-button`, `<title>` Align Left … Distribute Vertical).
//
// Aufbau jedes Symbols: eine feine Linie oder zwei (die Kante, an der
// ausgerichtet wird, 1 px, voll gefüllt) und ein abgerundeter Block, der
// mit 30 % gefüllt und mit 2 px in voller Farbe umrandet ist — die Umrandung
// über `clip-path` auf die Innenseite beschnitten, damit der Block seine
// Maße behält. Die Phosphor-Symbole davor waren nah dran, aber nicht gleich:
// andere Proportionen, keine Halbtransparenz, andere Strichstärken.
import { useId } from "react";

type Props = { className?: string };

/** Block mit 30 % Füllung und 2 px Innenrand, wie Framer ihn zeichnet. */
function Block({ d }: { d: string }) {
  const id = useId();
  const pfad = `p${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const clip = `c${pfad}`;
  return (
    <g>
      <defs>
        <path d={d} id={pfad} />
        <clipPath id={clip}>
          <use href={`#${pfad}`} />
        </clipPath>
      </defs>
      <use
        href={`#${pfad}`}
        fill="currentColor"
        fillOpacity={0.3}
        clipPath={`url(#${clip})`}
        strokeWidth={2}
        stroke="currentColor"
      />
    </g>
  );
}

export function AlignLeft({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16" className={className} aria-hidden>
      <path d="M 0 0.5 C 0 0.224 0.224 0 0.5 0 L 0.5 0 C 0.776 0 1 0.224 1 0.5 L 1 15.5 C 1 15.776 0.776 16 0.5 16 L 0.5 16 C 0.224 16 0 15.776 0 15.5 Z" fill="currentColor" />
      <Block d="M 3 7 C 3 5.895 3.895 5 5 5 L 12 5 C 13.105 5 14 5.895 14 7 L 14 9 C 14 10.105 13.105 11 12 11 L 5 11 C 3.895 11 3 10.105 3 9 Z" />
    </svg>
  );
}

export function AlignCenter({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 15 16" className={className} aria-hidden>
      <path d="M 7 0.5 C 7 0.224 7.224 0 7.5 0 L 7.5 0 C 7.776 0 8 0.224 8 0.5 L 8 6 L 7 6 Z" fill="currentColor" />
      <path d="M 7 10 L 8 10 L 8 15.5 C 8 15.776 7.776 16 7.5 16 L 7.5 16 C 7.224 16 7 15.776 7 15.5 Z" fill="currentColor" />
      <Block d="M 1 7 C 1 5.895 1.895 5 3 5 L 12 5 C 13.105 5 14 5.895 14 7 L 14 9 C 14 10.105 13.105 11 12 11 L 3 11 C 1.895 11 1 10.105 1 9 Z" />
    </svg>
  );
}

export function AlignRight({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16" className={className} aria-hidden>
      <path d="M 13 0.5 C 13 0.224 13.224 0 13.5 0 L 13.5 0 C 13.776 0 14 0.224 14 0.5 L 14 15.5 C 14 15.776 13.776 16 13.5 16 L 13.5 16 C 13.224 16 13 15.776 13 15.5 Z" fill="currentColor" />
      <Block d="M 0 7 C 0 5.895 0.895 5 2 5 L 9 5 C 10.105 5 11 5.895 11 7 L 11 9 C 11 10.105 10.105 11 9 11 L 2 11 C 0.895 11 0 10.105 0 9 Z" />
    </svg>
  );
}

export function AlignTop({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14" className={className} aria-hidden>
      <path d="M 0 0.5 C 0 0.224 0.224 0 0.5 0 L 15.5 0 C 15.776 0 16 0.224 16 0.5 L 16 0.5 C 16 0.776 15.776 1 15.5 1 L 0.5 1 C 0.224 1 0 0.776 0 0.5 Z" fill="currentColor" />
      <Block d="M 5 5 C 5 3.895 5.895 3 7 3 L 9 3 C 10.105 3 11 3.895 11 5 L 11 12 C 11 13.105 10.105 14 9 14 L 7 14 C 5.895 14 5 13.105 5 12 Z" />
    </svg>
  );
}

export function AlignMiddle({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="13" viewBox="0 0 16 13" className={className} aria-hidden>
      <path d="M 0 6.5 C 0 6.224 0.224 6 0.5 6 L 6 6 L 6 7 L 0.5 7 C 0.224 7 0 6.776 0 6.5 Z" fill="currentColor" />
      <path d="M 10 6 L 15.5 6 C 15.776 6 16 6.224 16 6.5 L 16 6.5 C 16 6.776 15.776 7 15.5 7 L 10 7 Z" fill="currentColor" />
      <Block d="M 5 2 C 5 0.895 5.895 0 7 0 L 9 0 C 10.105 0 11 0.895 11 2 L 11 11 C 11 12.105 10.105 13 9 13 L 7 13 C 5.895 13 5 12.105 5 11 Z" />
    </svg>
  );
}

export function AlignBottom({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14" className={className} aria-hidden>
      <path d="M 0 13.5 C 0 13.224 0.224 13 0.5 13 L 15.5 13 C 15.776 13 16 13.224 16 13.5 L 16 13.5 C 16 13.776 15.776 14 15.5 14 L 0.5 14 C 0.224 14 0 13.776 0 13.5 Z" fill="currentColor" />
      <Block d="M 5 2 C 5 0.895 5.895 0 7 0 L 9 0 C 10.105 0 11 0.895 11 2 L 11 9 C 11 10.105 10.105 11 9 11 L 7 11 C 5.895 11 5 10.105 5 9 Z" />
    </svg>
  );
}

export function DistributeHorizontal({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 12 16" className={className} aria-hidden>
      <path d="M 0 0.5 C 0 0.224 0.224 0 0.5 0 L 0.5 0 C 0.776 0 1 0.224 1 0.5 L 1 15.5 C 1 15.776 0.776 16 0.5 16 L 0.5 16 C 0.224 16 0 15.776 0 15.5 Z" fill="currentColor" />
      <path d="M 11 0.5 C 11 0.224 11.224 0 11.5 0 L 11.5 0 C 11.776 0 12 0.224 12 0.5 L 12 15.5 C 12 15.776 11.776 16 11.5 16 L 11.5 16 C 11.224 16 11 15.776 11 15.5 Z" fill="currentColor" />
      <Block d="M 3 5 C 3 3.895 3.895 3 5 3 L 7 3 C 8.105 3 9 3.895 9 5 L 9 11 C 9 12.105 8.105 13 7 13 L 5 13 C 3.895 13 3 12.105 3 11 Z" />
    </svg>
  );
}

export function DistributeVertical({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 12" className={className} aria-hidden>
      <path d="M 0 0.5 C 0 0.224 0.224 0 0.5 0 L 15.5 0 C 15.776 0 16 0.224 16 0.5 L 16 0.5 C 16 0.776 15.776 1 15.5 1 L 0.5 1 C 0.224 1 0 0.776 0 0.5 Z" fill="currentColor" />
      <path d="M 0 11.5 C 0 11.224 0.224 11 0.5 11 L 15.5 11 C 15.776 11 16 11.224 16 11.5 L 16 11.5 C 16 11.776 15.776 12 15.5 12 L 0.5 12 C 0.224 12 0 11.776 0 11.5 Z" fill="currentColor" />
      <Block d="M 3 5 C 3 3.895 3.895 3 5 3 L 11 3 C 12.105 3 13 3.895 13 5 L 13 7 C 13 8.105 12.105 9 11 9 L 5 9 C 3.895 9 3 8.105 3 7 Z" />
    </svg>
  );
}
