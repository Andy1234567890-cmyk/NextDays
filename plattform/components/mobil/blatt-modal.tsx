// Mobiles Blatt (Bottom-Sheet / Vollbild-Blatt) — ersetzt auf kleinen Displays
// die absolut positionierten Desktop-Dropdowns. Ein Dropdown mit `w-[42rem]`
// ragt bei 360 px aus dem Bild; ein Blatt hat immer die Breite des Geräts.
//
// Bewusst KEIN `md:hidden` hier drin: die Sichtbarkeit entscheidet die
// aufrufende Stelle. Sonst hätte jede Nutzung zwei Wahrheiten (Elternteil
// versteckt + Blatt versteckt sich selbst), und eine davon wird irgendwann
// falsch.
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

/** Fokussierbare Elemente innerhalb des Blatts — für die Fokus-Falle. */
const FOKUSSIERBAR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function BlattModal({
  offen,
  onSchliessen,
  titel,
  variante = "blatt",
  kopfAktion,
  fussleiste,
  children,
}: {
  offen: boolean;
  onSchliessen: () => void;
  titel?: string;
  /** `blatt` = von unten, max. 90 % Höhe. `vollbild` = ganzer Bildschirm. */
  variante?: "blatt" | "vollbild";
  /** Optionaler Knopf rechts im Kopf (z. B. „Löschen"). */
  kopfAktion?: React.ReactNode;
  /** Fest am unteren Rand stehende Aktionszeile (z. B. „Suchen"). */
  fussleiste?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("mobil");
  const [bereit, setBereit] = useState(false);
  const kasten = useRef<HTMLDivElement>(null);
  // Element, das den Fokus hatte, bevor das Blatt aufging — dorthin zurück.
  const vorher = useRef<HTMLElement | null>(null);

  useEffect(() => setBereit(true), []);

  // Seiten-Scroll sperren, solange das Blatt offen ist. Ohne das scrollt hinter
  // dem Blatt die Seite mit und man verliert die Position.
  useEffect(() => {
    if (!offen) return;
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, [offen]);

  // Escape schließt; Tab bleibt im Blatt (Fokus-Falle).
  useEffect(() => {
    if (!offen) return;
    vorher.current = document.activeElement as HTMLElement | null;
    const ziel = kasten.current?.querySelector<HTMLElement>(FOKUSSIERBAR);
    ziel?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSchliessen();
        return;
      }
      if (e.key !== "Tab" || !kasten.current) return;
      const liste = Array.from(
        kasten.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR),
      ).filter((el) => el.offsetParent !== null);
      if (liste.length === 0) return;
      const erst = liste[0];
      const letzt = liste[liste.length - 1];
      if (e.shiftKey && document.activeElement === erst) {
        e.preventDefault();
        letzt.focus();
      } else if (!e.shiftKey && document.activeElement === letzt) {
        e.preventDefault();
        erst.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      vorher.current?.focus?.();
    };
  }, [offen, onSchliessen]);

  if (!bereit || !offen) return null;

  const vollbild = variante === "vollbild";

  return createPortal(
    <div
      className={
        "fixed inset-0 z-[110] flex " +
        (vollbild ? "items-stretch" : "items-end")
      }
      role="dialog"
      aria-modal="true"
      aria-label={titel}
    >
      {/* Abdunkelung: Klick daneben schließt. Beim Vollbild-Blatt unsichtbar,
          weil das Blatt den ganzen Bildschirm füllt. */}
      <button
        type="button"
        aria-label={t("schliessen")}
        onClick={onSchliessen}
        className={
          "absolute inset-0 cursor-default " +
          (vollbild ? "bg-background" : "bg-foreground/40")
        }
      />

      <div
        ref={kasten}
        className={
          "relative flex w-full flex-col bg-background " +
          (vollbild
            ? "h-[100dvh]"
            : "max-h-[90dvh] rounded-t-3xl border-t border-border shadow-2xl")
        }
      >
        {/* Kopf: Griff (nur Blatt), Schließen links, Titel mittig */}
        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-3 py-3">
          {!vollbild && (
            <span
              aria-hidden
              className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border"
            />
          )}
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t("schliessen")}
            className="absolute left-2 flex size-11 items-center justify-center rounded-full hover:bg-secondary"
          >
            <Icon icon={vollbild ? "ph:arrow-left" : "ph:x"} className="size-5" />
          </button>
          {titel && <p className="px-12 text-sm font-semibold">{titel}</p>}
          {kopfAktion && <div className="absolute right-2">{kopfAktion}</div>}
        </div>

        {/* Inhalt scrollt, nicht das Blatt — `overscroll-contain` verhindert,
            dass der Wisch am Ende die Seite dahinter mitzieht. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {fussleiste && (
          <div
            className="shrink-0 border-t border-border bg-background px-4 py-3"
            style={{ paddingBottom: "calc(0.75rem + var(--safe-b))" }}
          >
            {fussleiste}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
