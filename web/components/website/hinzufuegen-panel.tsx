"use client";

// Das „Hinzufügen"-Panel — die dritte Spalte des Editors.
//
// 1:1 nach `docs/UI` (Foto 19.02.58 bis 19.03.26):
//
//     ELEMENTS              ▣ ✕     ← Panel-Kopf (die Schale)
//     🔍 Search for widgets          ← Suchfeld als Pille
//     RECENT                         ← Kategorie, klein und versal
//     ┌────────────────────────┐
//     │ ▤   Text               │     ← umrandete Karte, Symbol im Kästchen
//     └────────────────────────┘
//     LAYOUT
//     ┌────────────────────────┐
//     │ ⊟   Inner Column       │
//     └────────────────────────┘
//
// WAS SICH GEÄNDERT HAT UND WARUM
// Dieses Panel brachte seine EIGENE Kategorienspalte mit (`w-36`, links im
// Panel). Damit gab es im Editor zwei Spalten mit derselben Aufgabe
// nebeneinander: die Menüspalte der Schale und diese hier. Im Vorbild ist es
// EINE — die Kategorie steht in der Menüspalte, dieses Panel zeigt nur, was
// darin liegt. Die Kategorie kommt deshalb jetzt von außen (`kategorie`), und
// das Panel führt sie nicht mehr selbst.
//
// DIE LISTE IST EINE LISTE, KEIN RASTER
// Untereinander eine Karte je Baustein, nicht drei nebeneinander. So steht es
// im Foto, und es hat einen Grund: die Namen sind lang („Ausgewählte Objekte",
// „Bewertungen der Gäste"), und in einer Drittelspalte bricht jeder zweite um
// oder wird abgeschnitten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { BlockType } from "@/lib/site-pages";

import {
  ABSCHNITTE,
  GRUPPEN,
  type Gruppe,
  LAYOUT_BAUSTEINE,
  type LayoutBaustein,
} from "./abschnitte";
import { ZULETZT_ID } from "./reiter";

/** Was das Panel gerade zeigt. Kommt aus der MENÜSPALTE, nicht aus eigenem
 *  Zustand — die Spalte ist die Wahrheit darüber, wo man steht. */
export type KatalogKategorie = Gruppe | typeof ZULETZT_ID | "mediathek" | "siteText";

export function HinzufuegenPanel({
  kategorie,
  zuletzt,
  onWaehlen,
  onLayout,
  onZiehen,
  medien,
  siteText,
  deaktiviert = false,
}: {
  kategorie: KatalogKategorie;
  /** Die zuletzt eingesetzten Bausteine, neueste zuerst. Für die Sicht
   *  „Zuletzt" — sie ist keine Gruppe des Katalogs, sondern eine Sicht darauf. */
  zuletzt?: BlockType[];
  /** Ein Baustein wurde gewählt. */
  onWaehlen: (typ: BlockType) => void;
  /** Ein LAYOUT wurde gewählt — ein Container, kein Baustein.
   *
   *  Eigener Rückruf und nicht `onWaehlen` mit einem Sonderwert: ein Container
   *  entsteht über einen anderen Weg (`addContainer`, mit `kind`/`span`) und
   *  trägt keinen `content`. Beides durch denselben Rückruf zu schicken hieße,
   *  am anderen Ende wieder auseinanderzusortieren, was hier schon getrennt
   *  ist. */
  onLayout?: (bs: LayoutBaustein) => void;
  /** Ein Baustein wird gezogen (`typ`) bzw. losgelassen (`null`).
   *
   *  Ziehen ist im Vorbild der Hauptweg — man zieht den Baustein an die Stelle,
   *  an der er stehen soll, und ein blauer Balken zeigt sie an. Der Klick
   *  bleibt daneben bestehen: er fügt ans Ende an und ist der Weg für alle, die
   *  nicht ziehen können oder wollen (Tastatur, Vorlese-Bedienung). */
  onZiehen?: (typ: BlockType | null) => void;
  /** Die Mediathek als Inhalt der Kategorie „Mediathek". Wird von außen
   *  gereicht, weil sie Daten lädt und dieses Panel rein darstellend bleiben
   *  soll. */
  medien?: React.ReactNode;
  /** Der Website-Text als Inhalt der gleichnamigen Kategorie. */
  siteText?: React.ReactNode;
  deaktiviert?: boolean;
}) {
  const t = useTranslations("website");
  const [suche, setSuche] = useState("");

  if (kategorie === "mediathek") {
    return <div className="min-h-0 flex-1 overflow-y-auto">{medien}</div>;
  }
  if (kategorie === "siteText") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {siteText ?? (
          <p className="p-4 text-xs text-muted-foreground">
            {t("hinzufuegen.texteHinweis")}
          </p>
        )}
      </div>
    );
  }

  // Die Kategorie „Layout" zeigt CONTAINER und keine Bausteine. Sie hat
  // deshalb ihren eigenen Zweig: die Einträge stammen aus `LAYOUT_BAUSTEINE`,
  // haben keinen `BlockType` und werden über `addContainer` angelegt.
  //
  // Sie steht NICHT in der gemeinsamen Liste darunter, obwohl die alle Gruppen
  // führt. Der Grund ist derselbe, aus dem `mediathek` einen eigenen Zweig
  // hat: es sind keine Karten desselben Bestands. Ein Layout, das zwischen
  // „Titelbild" und „Text" steht, sieht aus wie ein Baustein und legt etwas
  // anderes an.
  if (kategorie === "layout") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p className="shrink-0 px-4 pb-2 pt-4 text-xs text-muted-foreground">
          {t("layout.hinweis")}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-1.5">
            {LAYOUT_BAUSTEINE.map((bs) => (
              <li key={bs.id}>
                <button
                  type="button"
                  disabled={deaktiviert || !onLayout}
                  onClick={() => onLayout?.(bs)}
                  title={t(`layout.${bs.hinweis}`)}
                  className="flex w-full items-center gap-2.5 rounded-(--radius) border border-border px-2.5 py-2.5 text-left text-sm transition hover:border-(--brand) hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
                    <Icon icon={bs.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {t(`layout.${bs.label}`)}
                    </span>
                    {/* Die Teilung als Zahlenreihe — „6 · 6", „4 · 8". Sie
                        sagt in einem Blick, was das Layout tut, und zwar
                        genauer als jedes Symbol in 32 Pixeln. */}
                    {bs.breiten ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {bs.breiten.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const suchtext = suche.trim().toLowerCase();
  // Gefiltert wird über den ÜBERSETZTEN Namen, nicht über den technischen Typ:
  // wer „Galerie" sucht, tippt nicht „gallery".
  const passtZurSuche = (typ: BlockType, label: string) =>
    !suchtext || t(`abschnitte.${label}`).toLowerCase().includes(suchtext);

  // Die Suche gilt über ALLE Kategorien, nicht nur über die offene.
  //
  // Wer „Karte" tippt, weiß nicht, ob der Kartenbaustein unter „Inhalt" oder
  // unter „Sonstiges" liegt — genau deshalb tippt er. Eine Suche, die nur die
  // gerade offene Kategorie durchsieht, antwortet auf „Karte" mit „kein
  // Baustein gefunden", obwohl es ihn gibt.
  // Der KATALOG steht vollständig untereinander, nach Gruppen überschrieben —
  // nicht eine Gruppe je Ansicht.
  //
  // Vorher zeigte das Panel ausschließlich die in der Menüspalte gewählte
  // Gruppe. Von 46 Bausteinen waren damit 18 zu sehen und 28 nicht, und nichts
  // an der Oberfläche sagte, dass es sie gibt: die Spalte daneben trug vier
  // Wörter („inhalt", „buchung", „Medien", „sonstiges"), die aussehen wie eine
  // Filterleiste über demselben Bestand, nicht wie vier getrennte Bestände.
  // Gemeldet wurde es als „es fehlen alle Bausteine" (25.08.2026) — die
  // Bausteine fehlten nie, nur ihr Weg.
  //
  // Im Vorbild (`docs/UI`, Foto 19.02.58) scrollt eine einzige Liste durch
  // RECENT · LAYOUT · BASIC · FORM …, und die Kategorien links sind
  // SPRUNGZIELE in diese Liste, keine Filter. Genau das ist der Unterschied
  // zwischen „ich sehe, was es gibt" und „ich muss wissen, wonach ich suche".
  const gewaehlteGruppe = kategorie === ZULETZT_ID ? null : kategorie;
  const treffer = suchtext
    ? ABSCHNITTE.filter((a) => passtZurSuche(a.typ, a.label))
    : kategorie === ZULETZT_ID
      ? // Reihenfolge der Benutzung, nicht die des Katalogs: „zuletzt" heißt
        // zuletzt. `filter(Boolean)` fällt weg, weil ein Typ aus dem Verlauf,
        // den der Katalog nicht mehr kennt (entfernter Baustein), sonst als
        // `undefined` in der Liste stünde.
        (zuletzt ?? [])
          .map((typ) => ABSCHNITTE.find((a) => a.typ === typ))
          .filter((a): a is (typeof ABSCHNITTE)[number] => Boolean(a))
      : // Alle Gruppen, die GEWÄHLTE zuerst: der Klick in der Menüspalte
        // bleibt damit wirksam (man landet oben bei dem, was man wollte), und
        // der Rest steht trotzdem darunter statt zu verschwinden.
        [...ABSCHNITTE].sort((a, b) => {
          if (a.gruppe === b.gruppe) return 0;
          if (a.gruppe === gewaehlteGruppe) return -1;
          if (b.gruppe === gewaehlteGruppe) return 1;
          return GRUPPEN.indexOf(a.gruppe) - GRUPPEN.indexOf(b.gruppe);
        });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-1 pt-3">
        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 focus-within:border-(--brand)">
          <Icon
            icon="ph:magnifying-glass"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("hinzufuegen.suchen")}
            aria-label={t("hinzufuegen.suchen")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {suche ? (
            <button
              type="button"
              onClick={() => setSuche("")}
              aria-label={t("hinzufuegen.sucheLeeren")}
              title={t("hinzufuegen.sucheLeeren")}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Der Ziehen-Hinweis steht im Vorbild direkt unter der Suche und sagt,
          dass es diesen Weg überhaupt gibt. Ohne ihn klickt jeder, und der
          Baustein landet immer unten — der Weg, ihn GENAU dorthin zu setzen,
          wo er hinsoll, bliebe unentdeckt. */}
      <p className="shrink-0 px-3 pb-2 pt-1 text-[0.6875rem] text-muted-foreground">
        {t("hinzufuegen.ziehenHinweis")}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {treffer.length === 0 ? (
          <p className="px-1 py-3 text-xs text-muted-foreground">
            {kategorie === ZULETZT_ID && !suchtext
              ? t("hinzufuegen.nochNichtsBenutzt")
              : t("hinzufuegen.keinTreffer")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {treffer.map((a, i) => {
              // Die Kategorie-Überschrift steht über jedem WECHSEL. Sie ist
              // die Orientierung in einer Liste, die alle Gruppen führt —
              // ohne sie wären es 46 Karten am Stück.
              //
              // Ausgenommen „Zuletzt": dort ist die Reihenfolge die der
              // Benutzung, quer durch alle Gruppen. Überschriften würden sie
              // in Blöcke zerschneiden, die es nicht gibt.
              const vorherige = treffer[i - 1];
              const kopf =
                kategorie !== ZULETZT_ID &&
                (i === 0 || vorherige?.gruppe !== a.gruppe)
                  ? a.gruppe
                  : null;
              return (
                <li key={a.typ}>
                  {kopf ? (
                    <h3 className="px-1 pb-1 pt-3 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`editor.gruppe.${kopf}`)}
                    </h3>
                  ) : null}
                  <button
                    type="button"
                    disabled={deaktiviert}
                    onClick={() => onWaehlen(a.typ)}
                    // Der Baustein ist ziehbar. `dataTransfer` trägt den Typ,
                    // damit auch ein Abwurf außerhalb unserer Fläche nichts
                    // Halbes hinterlässt.
                    draggable={!deaktiviert}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", a.typ);
                      e.dataTransfer.effectAllowed = "copy";
                      onZiehen?.(a.typ);
                    }}
                    onDragEnd={() => onZiehen?.(null)}
                    title={t(`abschnitte.${a.hinweis}`)}
                    className="flex w-full cursor-grab items-center gap-2.5 rounded-(--radius) border border-border px-2.5 py-2.5 text-left text-sm transition hover:border-(--brand) hover:bg-secondary/50 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
                      <Icon icon={a.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {t(`abschnitte.${a.label}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
