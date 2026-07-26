"use client";

// Animierter Briefumschlag für den Leerzustand „Noch keine Co-Gastgeber".
//
// Warum SVG + Framer Motion statt eines GIFs oder Lottie-JSON: Die Bewegung
// muss sich an `prefers-reduced-motion` halten, in beiden Farbschemata
// funktionieren und beliebig skalieren — alles Dinge, die eine Rasterdatei
// nicht kann. Zudem kommt kein zusätzliches Asset dazu.
//
// Die Bewegung erzählt genau das, worum es geht: Ein Umschlag öffnet sich, der
// Brief gleitet heraus. Das ist die Einladung.
import { motion, useReducedMotion } from "framer-motion";

// Dieselbe weiche Feder wie die Editor-Kacheln — der „Finger-Zieh"-Charakter,
// kein hartes Snap. Bewusst importiert statt neu erfunden.
import { KACHEL_SPRING } from "./foto-kacheln";

export function BriefIllustration({ className = "" }: { className?: string }) {
  const reduziert = useReducedMotion();

  // Bei reduzierter Bewegung: der fertige Zustand, ohne jede Animation. Nicht
  // etwa eine schnellere Version — wer das einstellt, will Ruhe.
  const brief = reduziert
    ? { initial: false as const, animate: { y: -34, opacity: 1 } }
    : {
        initial: { y: 8, opacity: 0 },
        animate: { y: -34, opacity: 1 },
      };

  const klappe = reduziert
    ? { initial: false as const, animate: { rotateX: 180 } }
    : { initial: { rotateX: 0 }, animate: { rotateX: 180 } };

  return (
    <motion.svg
      viewBox="0 0 200 150"
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="Ein Briefumschlag, aus dem eine Einladung gleitet"
      // Sanftes Schweben des Ganzen — gibt der Szene Leben, ohne abzulenken.
      animate={reduziert ? undefined : { y: [0, -6, 0] }}
      transition={
        reduziert
          ? undefined
          : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {/* Weicher Schatten unter dem Umschlag — verankert die Szene, damit sie
          nicht im Nichts schwebt. */}
      <motion.ellipse
        cx="100"
        cy="139"
        rx="46"
        ry="5"
        className="fill-foreground/10"
        animate={reduziert ? undefined : { rx: [46, 41, 46], opacity: [1, 0.7, 1] }}
        transition={
          reduziert
            ? undefined
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Der Brief. Liegt VOR der Rückwand, aber HINTER der Vorderseite —
          dadurch wirkt er beim Herausgleiten wie im Umschlag steckend. */}
      <motion.g
        initial={brief.initial}
        animate={brief.animate}
        transition={
          reduziert
            ? { duration: 0 }
            : { ...KACHEL_SPRING, delay: 0.45 }
        }
      >
        <rect
          x="62"
          y="42"
          width="76"
          height="62"
          rx="6"
          className="fill-background stroke-foreground/15"
          strokeWidth="1.5"
        />
        {/* Angedeutete Textzeilen — kein echter Text, damit nichts übersetzt
            werden muss und die Illustration in jeder Sprache stimmt. */}
        <rect x="73" y="56" width="42" height="4" rx="2" className="fill-foreground/25" />
        <rect x="73" y="67" width="54" height="4" rx="2" className="fill-foreground/15" />
        <rect x="73" y="78" width="34" height="4" rx="2" className="fill-foreground/15" />
      </motion.g>

      {/* Umschlag-Rückwand */}
      <rect
        x="46"
        y="60"
        width="108"
        height="74"
        rx="8"
        className="fill-muted stroke-foreground/15"
        strokeWidth="1.5"
      />

      {/* Vorderseite mit der charakteristischen V-Falz. Nach dem Brief
          gezeichnet, damit er dahinter verschwindet. */}
      <path
        d="M46 68 L100 106 L154 68 L154 126 Q154 134 146 134 L54 134 Q46 134 46 126 Z"
        className="fill-muted stroke-foreground/15"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Die Klappe. Kippt über die Oberkante nach hinten — transformOrigin auf
          der Falzlinie (y=68), sonst rotiert sie um die eigene Mitte und sieht
          aus wie ein Flackern statt wie ein Öffnen. */}
      <motion.path
        d="M46 68 Q46 60 54 60 L146 60 Q154 60 154 68 L100 102 Z"
        className="fill-muted stroke-foreground/15"
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ transformOrigin: "100px 68px", transformBox: "view-box" }}
        initial={klappe.initial}
        animate={klappe.animate}
        transition={
          reduziert ? { duration: 0 } : { ...KACHEL_SPRING, delay: 0.1 }
        }
      />
    </motion.svg>
  );
}
