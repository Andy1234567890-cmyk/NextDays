"use client";

// Die MENÜSPALTE — die zweite der vier Spalten des Editors.
//
// Hostaway (live abgelesen 25.08.2026, `docs/HOSTAWAY-EDITOR-UI.md` §18):
//
//     LEISTE ~60px   MENÜSPALTE ~140px     PANEL
//     + Add   ◄───   Elements        ⌃     « ELEMENTS   ▣ ✕
//     ⧉ Pages          Recent    ◄aktiv    🔍 Search for widgets
//     ◈ Layers         Layout              RECENT
//     ◫ Theme          Basic               ▤ Text
//     ─────            …                   LAYOUT
//     ⌕ SEO/AEO      Media                 ⊟ Inner Column
//     ⋯ More         Site Text             …
//
// WARUM ES DIESE SPALTE GIBT
// ==========================
// Unsere Unterpunkte hatten bisher KEINEN Ort. „SEO" hat sechs, „Einstellungen"
// hat sechs, „Hinzufügen" hat drei — sie lagen als eigene Routen herum, und man
// sah nie, dass es sie gibt, bevor man drin war. Genau darauf zielte die
// Beschwerde „auch die unter menü punkte" (25.08.2026).
//
// Es ist ein AKKORDEON, kein flaches Menü: eine Gruppe klappt auf und zeigt
// ihre Kinder darunter — auf DERSELBEN linken Kante wie alle anderen Zeilen,
// die Zugehörigkeit trägt die Überschrift. Dasselbe Muster benutzt Hostaway im
// Verwaltungsbereich (`Settings ⌃ → Branding · Domain & Security · …`), und es
// ist bewusst dasselbe: ein Produkt, ein Untermenü-Muster. Zwei verschiedene
// wären genau die Willkür, die man dem Baukasten bisher ansah.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";

import { type MenueEintrag, menueSymbol } from "./reiter";

export function MenueSpalte({
  titel,
  eintraege,
  aktiv,
  beschriften,
  onWaehle,
  vorNavigation,
}: {
  /** Überschrift der Spalte — der Name des Leisten-Bereichs. */
  titel: string;
  eintraege: MenueEintrag[];
  /** Kennung des gewählten Eintrags. */
  aktiv: string | null;
  /** Kennung → Beschriftung. Als Funktion und nicht als fertige Texte, weil
   *  die Kennungen aus drei verschiedenen i18n-Namensräumen stammen
   *  (`menue.*`, `seo.*`, `einstellungen.*`). */
  beschriften: (id: string) => string;
  /** Ein Eintrag OHNE `href` wird nicht navigiert, sondern gemeldet — dann
   *  wechselt nur das Panel und die Seite bleibt stehen. Das ist der Kern der
   *  Beschwerde „alles lädt neu statt realtime": ein Bereichswechsel darf
   *  keinen Seitenwechsel bedeuten. */
  onWaehle: (id: string) => void;
  /** Vor einem Eintrag MIT `href` — dasselbe wie in der Leiste: den offenen
   *  Stand wegschreiben, bevor die Route wechselt. Die „Mehr"-Ziele im Editor
   *  sind solche Links (05.09.2026); ohne den Aufruf ginge der ungespeicherte
   *  Abschnitt beim Sprung nach „Objekte" verloren. */
  vorNavigation?: () => void;
}) {
  // Welche Gruppen zugeklappt sind. Offen ist der Normalfall: eine Gruppe, die
  // man erst aufklappen muss, versteckt genau das, was diese Spalte zeigen soll.
  const [zu, setZu] = useState<Set<string>>(new Set());

  function umklappen(id: string) {
    setZu((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // ALLE Zeilen stehen auf EINER Kante — Symbolspalte bei 0,5 rem, Text
  // dahinter. Vorher rückte `tiefe` die Kinder einer Gruppe um 0,75 rem ein,
  // womit es in derselben Spalte drei linke Kanten gab: die Gruppen-
  // überschrift („Bausteine"), die Zeilen darunter (eingerückt) und die
  // gruppenlosen Zeilen darunter („Mediathek", „Website-Text") — deren
  // Symbole standen links von den Symbolen der Gruppenkinder. Zu welcher
  // Gruppe eine Zeile gehört, sagt die Überschrift darüber; die Einrückung
  // sagte es doppelt und dafür schief.
  function zeile(id: string, label: string, href: string | undefined) {
    const ist = id === aktiv;
    const klasse =
      "flex w-full items-center gap-1.5 rounded-(--radius) px-2 py-1.5 text-left text-[0.8125rem] transition " +
      (ist
        ? "bg-secondary font-medium text-foreground"
        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground");
    // Jede Zeile trägt ihr Symbol. Die Leiste links ist rein symbolisch, das
    // Panel rechts rein textlich — ohne Symbol hier bräche die Spur dazwischen
    // ab, und man müsste jede Zeile lesen statt sie zu erkennen.
    const inhalt = (
      <>
        <Icon
          icon={menueSymbol(id)}
          className="size-4 shrink-0 opacity-80"
        />
        <span className="min-w-0 truncate">{label}</span>
      </>
    );
    // Mit Adresse ein Link (Mittelklick, „in neuem Tab öffnen", Zurück-Knopf),
    // ohne Adresse ein Knopf. Ein Link auf `#` wäre eine Lüge über das Ziel.
    return href ? (
      <Link
        key={id}
        href={href}
        onClick={() => vorNavigation?.()}
        className={klasse}
      >
        {inhalt}
      </Link>
    ) : (
      <button
        key={id}
        type="button"
        onClick={() => onWaehle(id)}
        className={klasse}
      >
        {inhalt}
      </button>
    );
  }

  return (
    // 11 rem und nicht 9: seit die Zeilen ein Symbol tragen, bleiben rund zwei
    // Zeichen weniger für das Wort, und die längsten Beschriftungen messen 19
    // Zeichen („Prezentare generală" (ro), „Uudelleenohjaukset" (fi)). In 9 rem
    // wären sie abgeschnitten gewesen — in genau den Sprachen, in denen hier
    // niemand nachsieht.
    <div className="flex w-[11rem] shrink-0 select-none flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
      {eintraege.map((e) =>
        e.art === "gruppe" ? (
          <div key={e.id} className="flex flex-col gap-0.5">
            {/* Die Gruppenzeile ist selbst KEIN Ziel — sie klappt nur auf.
                Bei Hostaway trägt sie deshalb den Pfeil und sonst nichts. */}
            <button
              type="button"
              onClick={() => umklappen(e.id)}
              aria-expanded={!zu.has(e.id)}
              className="flex w-full items-center gap-1 rounded-(--radius) px-2 py-1.5 text-left text-[0.8125rem] font-medium text-foreground transition hover:bg-secondary/60"
            >
              <span className="min-w-0 flex-1 truncate">
                {beschriften(e.id)}
              </span>
              <Icon
                icon={zu.has(e.id) ? "ph:caret-down" : "ph:caret-up"}
                className="size-3 shrink-0 text-muted-foreground"
              />
            </button>
            {!zu.has(e.id)
              ? e.kinder.map((k) => zeile(k.id, beschriften(k.id), k.href))
              : null}
          </div>
        ) : (
          zeile(e.id, beschriften(e.id), e.href)
        ),
      )}
      {eintraege.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{titel}</p>
      ) : null}
    </div>
  );
}
