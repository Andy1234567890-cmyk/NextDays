// Die Reiter des Baukastens — EINE Wahrheit für Beschriftung, Route und
// Reihenfolge.
//
// Jeder Reiter ist ein PFAD, kein Zustand. Lodgify macht das genauso
// (`/website-builder/{id}/styles`, `/pages`, `/settings/...`, `/rentals`,
// `/external-widgets`; live abgelesen am 23.08.2026), und zwar aus einem
// handfesten Grund: der Baukasten hat viele Unterpunkte, und wer einem Kollegen
// „schau dir mal die Domain-Einstellung an" schicken will, braucht dafür eine
// Adresse. Mit `?reiter=design` gab es die nicht — der Link führte immer auf
// den Standard-Reiter zurück.
//
// Der aktive Reiter wird über den PRÄFIX des Pfads bestimmt, nicht über
// Gleichheit: `/website/design/logo` gehört noch zu „design", und
// `/website/seiten/<id>` (der Abschnitts-Editor) noch zu „seiten".

import { GRUPPEN } from "./abschnitte";

export const BAUKASTEN_BASIS = "/website";

/** Kennung der Sicht „zuletzt benutzt" im Katalog.
 *
 *  Als Konstante und nicht als nacktes `"zuletzt"` an drei Stellen: sie ist
 *  zugleich der i18n-Schlüssel und der Wert, gegen den das Panel filtert. Ein
 *  Tippfehler in einer der Kopien wäre eine Kategorie, die sich öffnen lässt
 *  und leer bleibt. */
export const ZULETZT_ID = "zuletzt";

/** Reiter-Kennungen in der Reihenfolge der Leiste.
 *
 *  Die Reihenfolge folgt Hostaways Editor-Leiste (Add · Pages · Layers · Theme ·
 *  SEO/AEO · More; live abgelesen am 24.08.2026): ganz oben, was man EINFÜGT,
 *  darunter die Struktur, dann das Aussehen, dann die Nebenbereiche. „Vorlagen"
 *  steht deshalb an Hostaways „Add"-Position — es ist der Einstieg für ein
 *  leeres Konto und der Ort, an dem man später eine ganze Seite dazunimmt. */
export const REITER_IDS = [
  // Die HAUPTHANDLUNG steht ganz oben und heißt „Hinzufügen" (Hostaway: „Add").
  //
  // Sie war vorher über zwei Orte verstreut: den Katalog-Dialog im
  // Abschnitts-Editor und den Reiter „Widgets". Wer etwas einfügen wollte,
  // musste erst wissen, ob das Gesuchte ein Abschnitt oder ein Widget ist —
  // eine Unterscheidung, die es aus Kundensicht gar nicht gibt.
  "hinzufuegen",
  "vorlagen",
  "seiten",
  // Ebenen (Hostaway: „Layers"): die Abschnitte der Seite als Liste, zum
  // Auswählen und Sortieren. Auf der Fläche trifft man einen Abschnitt nur,
  // wenn er sichtbar ist — ein auf diesem Gerät ausgeblendeter oder ein von
  // einem anderen überdeckter ist dort nicht anklickbar.
  "ebenen",
  "design",
  "seo",
  // Anfragen aus den Formular-Abschnitten (0436). Eigener Reiter und kein
  // Unterpunkt: es sind eingehende Nachrichten von Gästen, keine Einstellung.
  // Wer sie sucht, sucht sie nicht unter „SEO" und nicht unter „Design".
  "anfragen",
  // Personalisierungs-Regeln (0440): Auslöser × Aktion. Eigener Reiter und
  // kein Unterpunkt von „Seiten", weil eine Regel keine Seite ist — sie
  // entscheidet, WANN etwas erscheint. Hostaway versteckt das unter
  // „More → Personalize"; genau deshalb findet es dort kaum jemand.
  "regeln",
  "objekte",
  "widgets",
  "einstellungen",
  // Der Blog (Vorbild: „Blog"). Eigener Leisteneintrag und kein Unterpunkt:
  // im Foto steht er zwischen „SEO/AEO" und „More", mit eigenem breitem Panel
  // (Beiträge · Einstellungen). Bei uns lagen die Beiträge unter „Seiten" und
  // die Blog-Einstellungen unter „Einstellungen → Blog" — zwei Orte für eine
  // Sache, und keiner davon hieß „Blog".
  "blog",
  // Die MEDIATHEK (Vorbild: „Media Manager"). Eigener Leisteneintrag und kein
  // Unterpunkt: sie ist der Bestand der ganzen Website — Bilder, Symbole,
  // Videos, Audio, Dateien — und wird gepflegt, nicht nur benutzt. Bis 0479
  // war sie ausschließlich aus einem Bildfeld heraus erreichbar: wer ein Bild
  // umbenennen, Alt-Texte nachtragen oder Ordner sortieren wollte, musste
  // erst irgendeinen Block mit Bildfeld öffnen. Ein Bestand ohne eigene Tür.
  "mediathek",
  // „Mehr" (Hostaway: „More") — sammelt, was die ganze Website betrifft und
  // NICHT am offenen Seiten-Entwurf arbeitet. Es ist kein eigener Bereich mit
  // eigener Seite, sondern ein Ort für die Menüspalte; deshalb zeigt seine
  // Route auf den ersten Eintrag darin.
  "mehr",
] as const;

export type ReiterId = (typeof REITER_IDS)[number];

/** Die Leiste in DREI Gruppen, getrennt durch eine Haarlinie.
 *
 *  Neun gleichwertige Symbole untereinander sind keine Gliederung: ab dem
 *  sechsten sucht man. Hostaway trennt aus demselben Grund
 *  `Add · Pages · Layers · Theme ┃ Content · SEO · Store ┃ ⋯ More` — die Frage
 *  „was füge ich ein" ist eine andere als „was betrifft die ganze Seite" und
 *  eine dritte als „wo stelle ich etwas ein".
 *
 *  Unsere drei Gruppen:
 *
 *  1. **Bauen** — was auf einer Seite passiert: Vorlagen (der Einstieg),
 *     Seiten, Ebenen, Design.
 *  2. **Inhalt & Auffindbarkeit** — was die ganze Website betrifft: Objekte,
 *     SEO, Regeln.
 *  3. **Nebenbereiche** — was nur gelegentlich gebraucht wird: Anfragen,
 *     Widgets, Einstellungen.
 */
export const REITER_GRUPPEN: readonly (readonly ReiterId[])[] = [
  ["hinzufuegen", "vorlagen", "seiten", "ebenen", "design"],
  ["objekte", "seo", "regeln"],
  ["anfragen", "widgets", "einstellungen"],
];

/** Symbol je Reiter für die senkrechte Leiste.
 *
 *  Sie trägt Icon UND Beschriftung, nicht nur das Icon: ein reines Icon-Menü
 *  zwingt zum Raten oder zum Hovern, und Hostaway beschriftet aus demselben
 *  Grund jedes seiner sechs Symbole. */
export const REITER_SYMBOL: Record<ReiterId, string> = {
  hinzufuegen: "ph:plus",
  vorlagen: "ph:squares-four",
  seiten: "ph:files",
  ebenen: "ph:stack-simple",
  design: "ph:paint-brush-broad",
  seo: "ph:magnifying-glass",
  anfragen: "ph:envelope-simple",
  regeln: "ph:sliders-horizontal",
  objekte: "ph:house-line",
  widgets: "ph:puzzle-piece",
  einstellungen: "ph:gear",
  blog: "ph:article",
  mediathek: "ph:images",
  mehr: "ph:dots-three",
};

/** Route eines Reiters. Einstellungen und Objekte/Widgets zeigen auf ihre
 *  jeweilige Einstiegsseite. */
export const REITER_HREF: Record<ReiterId, string> = {
  hinzufuegen: `${BAUKASTEN_BASIS}/hinzufuegen`,
  vorlagen: `${BAUKASTEN_BASIS}/vorlagen`,
  ebenen: `${BAUKASTEN_BASIS}/ebenen`,
  design: `${BAUKASTEN_BASIS}/design`,
  seiten: `${BAUKASTEN_BASIS}/seiten`,
  // SEO steht NEBEN den Einstellungen und nicht darin (0430): es sind fünf
  // Unterpunkte mit Tabellen und einer eigenen Import-Maske. Hostaway hat es
  // aus demselben Grund als eigenen Bereich („SEO/AEO" mit Untermenü) —
  // gedrängt unter „Einstellungen" wären es zehn Punkte in einer Spalte.
  seo: `${BAUKASTEN_BASIS}/seo`,
  anfragen: `${BAUKASTEN_BASIS}/anfragen`,
  regeln: `${BAUKASTEN_BASIS}/regeln`,
  einstellungen: `${BAUKASTEN_BASIS}/einstellungen/adresse`,
  objekte: `${BAUKASTEN_BASIS}/objekte`,
  widgets: `${BAUKASTEN_BASIS}/widgets`,
  blog: `${BAUKASTEN_BASIS}/blog`,
  mediathek: `${BAUKASTEN_BASIS}/mediathek`,
  // „Mehr" führt auf den ersten seiner sechs Bereiche. Die anderen fünf stehen
  // danach in der Menüspalte daneben — deshalb ist der Sprung kein Verlust
  // mehr, sondern der Einstieg in die Liste.
  mehr: `${BAUKASTEN_BASIS}/objekte`,
};

/** Unterpunkte des Einstellungen-Reiters — eigene Spalte links, wie bei
 *  Lodgify (`/settings/domain`, `/languages`, `/contact`, `/display`,
 *  `/advanced`). Reihenfolge = Reihenfolge in der Spalte: erst wo die Seite
 *  liegt, dann in welchen Sprachen sie steht, dann was sie zeigt, dann die
 *  Eingriffe für Fortgeschrittene. */
export const EINSTELLUNGEN_UNTERPUNKTE = [
  "adresse",
  "sprachen",
  "kontakt",
  "anzeige",
  // Der Blog (0457): Name, Nächster/Vorheriger-Navigation, RSS-Angaben und der
  // Import aus einem fremden Feed. Er steht hier und nicht unter „Seiten",
  // weil das Einstellungen des ganzen Blogs sind — die Felder EINES Beitrags
  // (Datum, Autor, Schlagwörter) stehen dort, wo der Beitrag steht.
  "blog",
  "erweitert",
] as const;

export type EinstellungenUnterpunkt =
  (typeof EINSTELLUNGEN_UNTERPUNKTE)[number];

/** Unterpunkte des SEO-Reiters (0430). Reihenfolge = Reihenfolge in der Spalte,
 *  und sie folgt der Arbeitsweise: erst die site-weiten Angaben (der Rückfall
 *  für alles), dann Seite für Seite, dann die strukturierten Daten, dann die
 *  Messung, zuletzt die Weiterleitungen — die braucht nur, wer umzieht.
 *
 *  Der erste Punkt heißt `uebersicht` und nicht `allgemein`: er zeigt nicht nur
 *  Felder, sondern auch, was daraus entsteht (sitemap.xml, robots.txt,
 *  llms.txt). Ohne diese Anzeige weiß niemand, dass es die Dateien gibt. */
export const SEO_UNTERPUNKTE = [
  "uebersicht",
  // Das Geschäftsprofil des KI-Assistenten (0463–0465): Tonfall, Zielgruppe,
  // Alleinstellung, verbotene Wörter. Es steht HIER und nicht in
  // „Einstellungen", weil es genau EINE Wirkung hat — wie die Texte klingen,
  // die dieser Reiter erzeugt (Titel, Beschreibungen, Alt-Texte) — und nicht
  // die Website selbst betrifft.
  "ki",
  "seiten",
  "schema",
  "messung",
  "weiterleitungen",
] as const;

export type SeoUnterpunkt = (typeof SEO_UNTERPUNKTE)[number];

/** Bereiche, die in der Leiste unter „Mehr" hängen statt ein eigenes Symbol zu
 *  haben.
 *
 *  Sie sind echte Bereiche mit eigener Route — nur führt in der Leiste kein
 *  eigenes Symbol dorthin, weil elf gleichrangige Symbole zu viele waren. Wer
 *  auf `/website/objekte` steht, steht für die Leiste also in „Mehr"; die
 *  Menüspalte daneben zeigt dann die sechs Geschwister.
 *
 *  Ohne diese Zuordnung wäre „Mehr" nie hervorgehoben, obwohl man mittendrin
 *  steht, und die Menüspalte zeigte die Unterpunkte des zuletzt aktiven
 *  anderen Bereichs. */
const UNTER_MEHR: ReadonlySet<string> = new Set([
  "objekte",
  "regeln",
  "anfragen",
  "widgets",
  "vorlagen",
  "einstellungen",
]);

/** Welcher Reiter zu einem Pfad gehört. `null`, wenn der Pfad nicht im
 *  Baukasten liegt — dann ist kein Reiter aktiv, statt willkürlich den ersten
 *  hervorzuheben. */
export function reiterAusPfad(pfad: string): ReiterId | null {
  const rest = pfad.startsWith(BAUKASTEN_BASIS)
    ? pfad.slice(BAUKASTEN_BASIS.length).replace(/^\//, "")
    : null;
  if (rest === null) return null;
  const erstes = rest.split("/")[0];
  if (UNTER_MEHR.has(erstes)) return "mehr";
  return REITER_IDS.find((r) => r === erstes) ?? null;
}

/** Welcher MENÜ-Eintrag zu einem Pfad gehört — der Unterpunkt innerhalb des
 *  Bereichs, den die Menüspalte hervorhebt.
 *
 *  Für `/website/einstellungen/sprachen` ist das `sprachen`, für
 *  `/website/objekte` ist es `objekte` selbst. `null`, sobald der Pfad keinen
 *  Unterpunkt benennt. */
export function menueAusPfad(pfad: string): string | null {
  const rest = pfad.startsWith(BAUKASTEN_BASIS)
    ? pfad.slice(BAUKASTEN_BASIS.length).replace(/^\//, "")
    : null;
  if (rest === null) return null;
  const [erstes, zweites] = rest.split("/");
  // `einstellungen/sprachen` und `seo/messung` → der zweite Teil benennt den
  // Unterpunkt. Ohne zweiten Teil ist der Bereich selbst der Eintrag (so steht
  // „Objekte" in der Menüspalte von „Mehr").
  //
  // AUSNAHME `seo`: dessen erster Unterpunkt („Übersicht") hat keine eigene
  // Route, er IST `/website/seo`. Ohne diese Zeile gab `menueAusPfad` dort
  // „seo" zurück — und weil kein Unterpunkt so heißt, wäre in der Spalte nie
  // einer hervorgehoben (Prüfbericht C3).
  if (erstes === "seo" && !zweites) return SEO_UNTERPUNKTE[0];
  return zweites || erstes || null;
}

// ───────────────────────────────────────────────────────────────────────────
// DIE MENÜSPALTE (25.08.2026)
//
// Hostaways Editor hat DREI Spalten links, nicht zwei: Leiste → Menüspalte →
// Panel. Live abgelesen, siehe `docs/HOSTAWAY-EDITOR-UI.md` Abschnitt 18:
//
//     + Add  ◄──   Elements    ⌃      «  ELEMENTS      ▣ ✕
//     ⧉ Pages        Recent    ◄──    🔍 Search for widgets
//     ◈ Layers       Layout           RECENT
//     ◫ Theme        Basic            ▤ Text
//     ─────          …                LAYOUT
//     ⌕ SEO/AEO    Media              ⊟ Inner Column
//     ⋯ More       Site Text          …
//
// Die Menüspalte ist ein AKKORDEON: `Elements ⌃` klappt auf und hat eingerückte
// Kinder, `Media` und `Site Text` stehen daneben. Es ist DASSELBE Muster wie
// die Navigation im Verwaltungsbereich (Settings ⌃ → Branding, Domain, …).
// Das ganze Produkt kennt genau EIN Untermenü-Muster.
//
// Bei uns hatten die Unterpunkte bisher überhaupt keinen Ort: SEO hat sechs,
// Einstellungen hat sechs, „Hinzufügen" hat drei — sie lagen entweder als
// eigene Route herum oder gar nicht. Deshalb stimmte an der Seitenleiste
// nichts, und deshalb steht diese Spalte jetzt hier.

/** Ein Eintrag der Menüspalte: entweder ein Ziel oder eine aufklappbare
 *  Gruppe. Mehr Ebenen gibt es nicht — Hostaway hat genau zwei, und eine
 *  dritte wäre wieder ein Ort, an dem man sucht. */
export type MenueEintrag =
  | { art: "ziel"; id: string; href?: string }
  | { art: "gruppe"; id: string; kinder: { id: string; href?: string }[] };

/**
 * Das Symbol eines Menü-Eintrags.
 *
 * Die Einträge der Schublade tragen dieselben Symbole wie die Leiste darüber:
 * wer „Objekte" einmal am Haus erkannt hat, erkennt es in der Schublade
 * wieder. Ein Untermenü aus reinem Text neben einer Leiste aus reinen Symbolen
 * liest sich wie zwei verschiedene Menüs.
 *
 * Einträge ohne eigenes Symbol erben es aus `REITER_SYMBOL`, wenn ihre Kennung
 * dort steht (`objekte`, `regeln`, `anfragen`, `widgets`, `vorlagen`,
 * `einstellungen`, `blog`). Deshalb stehen hier nur die, die es NICHT gibt:
 * die Unterpunkte von SEO und Einstellungen.
 */
export const MENUE_SYMBOL: Record<string, string> = {
  // Einstellungen
  adresse: "ph:globe-simple",
  sprachen: "ph:translate",
  kontakt: "ph:address-book",
  anzeige: "ph:eye",
  erweitert: "ph:code",
  // SEO/AEO
  uebersicht: "ph:list-checks",
  ki: "ph:sparkle",
  schema: "ph:tree-structure",
  messung: "ph:chart-line",
  weiterleitungen: "ph:arrow-bend-up-right",
  // Blog
  beitraege: "ph:note-pencil",
  blogEinstellungen: "ph:gear-six",
  // „Hinzufügen" — die Katalog-Kategorien UND die zwei Extras darunter.
  //
  // Die fünf Kategorien fehlten hier, deshalb trug jede von ihnen den
  // neutralen Punkt aus `menueSymbol` — dieselbe Lücke wie bei den
  // Theme-Unterpunkten (B1), nur einen Bereich weiter. Ein Auffangwert, der an
  // fünf Stellen gleichzeitig greift, sieht nicht wie ein Fehler aus, sondern
  // wie eine Gestaltungsentscheidung.
  //
  // Die Kennungen sind `ZULETZT_ID` und `GRUPPEN` aus `abschnitte.ts`; ändert
  // sich dort eine, fällt sie hier auf den Punkt zurück. Der Prüflauf
  // `blocktypen-pruefen.mjs` hält die Gruppen deckungsgleich.
  zuletzt: "ph:clock-counter-clockwise",
  layout: "ph:columns",
  inhalt: "ph:text-align-left",
  buchung: "ph:calendar-check",
  medien: "ph:image-square",
  sonstiges: "ph:dots-three-circle",
  mediathek: "ph:images",
  siteText: "ph:text-aa",
  // Theme. Fehlten bis 27.08.2026 komplett, deshalb trug jeder der sieben
  // Einträge den neutralen Punkt (Prüfbericht B1).
  "site-layout": "ph:layout",
  farben: "ph:palette",
  text: "ph:text-aa",
  buttons: "ph:cursor-click",
  bilder: "ph:image",
  "breite-abstand": "ph:arrows-out-line-horizontal",
  logo: "ph:sticker",
};

/**
 * Menü-Kennungen, deren Wort NICHT unter ihrem eigenen Namen steht.
 *
 * Die Theme-Unterpunkte heißen `site-layout`/`breite-abstand` — mit Bindestrich,
 * weil sie Routen sind. Ihre Wörter liegen aber seit immer unter
 * `website.design.layoutTitel`/`.breiteTitel`, also unter dem Namen, den das
 * PANEL trägt. Ohne diese Tabelle fand die Suche in `rahmen.tsx` nichts und
 * schrieb die rohe ID auf den Bildschirm: „site-layout · farben · text …"
 * kleingeschrieben und mit Bindestrich (Prüfbericht B1).
 *
 * Neue Schlüssel wären hier der falsche Weg — dieselben sieben Wörter ein
 * zweites Mal in 24 Sprachen, die beim nächsten Umbenennen auseinanderlaufen.
 */
export const MENUE_I18N_SCHLUESSEL: Record<string, string> = {
  "site-layout": "design.layoutTitel",
  farben: "design.farbenTitel",
  text: "design.textTitel",
  buttons: "design.buttonsTitel",
  bilder: "design.bilderTitel",
  "breite-abstand": "design.breiteTitel",
  logo: "design.logoTitel",
};

/** Minimale Sicht auf `useTranslations` — nur das, was die Beschriftung
 *  braucht. Kein Import aus next-intl, damit diese Datei serverseitig wie
 *  clientseitig ladbar bleibt. */
export type MenueUebersetzer = {
  (schluessel: string): string;
  has: (schluessel: string) => boolean;
};

/**
 * Das Wort zu einer Menü-Kennung.
 *
 * EINE Stelle für alle Aufrufer. Vorher stand diese Kette zweimal da — in
 * `rahmen.tsx` und, Zeile für Zeile abgeschrieben, in `abschnitts-editor.tsx`.
 * Der Nachschlag in `MENUE_I18N_SCHLUESSEL` wurde nur in der ersten Kopie
 * ergänzt, weshalb dieselbe Spalte im Editor weiterhin „site-layout · farben ·
 * text …" zeigte (Nachprüfung B1). Zwei Kopien derselben Zuordnung sind zwei
 * Wahrheiten (Wurzel 2) — die zweite ist die, die beim nächsten Mal wieder
 * niemand mitpflegt.
 *
 * Reihenfolge der Suche:
 * 1. `MENUE_I18N_SCHLUESSEL` — Kennungen, deren Wort woanders steht als ihr
 *    Name (die Theme-Unterpunkte sind Routen mit Bindestrich).
 * 2. die Namensräume, in denen dieselben Wörter schon stehen: Katalog-
 *    Kategorien unter `menue.*`, dessen Gruppen unter `editor.gruppe.*`, die
 *    site-weiten Bereiche unter `reiter.*` (dieselben wie in der Leiste), die
 *    Unterpunkte von SEO und Einstellungen unter ihren eigenen.
 *
 * `t` muss auf den Namensraum `website` zeigen.
 */
export function menueBeschriftung(t: MenueUebersetzer, id: string): string {
  const abweichend = MENUE_I18N_SCHLUESSEL[id];
  if (abweichend && t.has(abweichend)) return t(abweichend);
  for (const ns of [
    "menue",
    "editor.gruppe",
    "reiter",
    "seo",
    "einstellungen",
  ] as const) {
    // Unter `seo.*` und `einstellungen.*` ist ein Unterpunkt kein Wort, sondern
    // der ganze Namensraum SEINER Seite — die Überschrift steht darin als
    // `.titel`. `t.has()` sagt für so einen Knoten ebenfalls `true`, und `t()`
    // darauf wirft INSUFFICIENT_PATH und rendert den rohen Schlüssel. Deshalb
    // zuerst `.titel`, dann der Schlüssel selbst.
    const k = `${ns}.${id}`;
    if (t.has(`${k}.titel`)) return t(`${k}.titel`);
    if (t.has(k)) return t(k);
  }
  return id;
}

/** Das Symbol zu einer Menü-Kennung. Erst die eigene Tabelle, dann die der
 *  Leiste; bleibt beides leer, steht ein neutraler Punkt — ein Eintrag ohne
 *  Symbol säße sonst schief neben allen anderen. */
export function menueSymbol(id: string): string {
  const gefunden = MENUE_SYMBOL[id] ?? REITER_SYMBOL[id as ReiterId];
  if (gefunden) return gefunden;
  // Der Auffangwert ist die eigentliche Falle: ein grauer Punkt sieht nicht
  // wie ein Fehler aus, sondern wie eine Gestaltungsentscheidung. Deshalb ist
  // eine fehlende Zuordnung in der ENTWICKLUNG laut — dreimal in Folge wurde
  // sie sonst vom Nutzer gemeldet statt vom System (Theme-Unterpunkte, die
  // fünf Katalog-Kategorien, dann „layout").
  //
  // Nur eine Warnung und kein Wurf: ein fehlendes Symbol ist kein Grund, die
  // Oberfläche abzuschalten. In Produktion bleibt es still — dort ist der
  // Punkt besser als eine leere Stelle.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[baukasten] Menü-Kennung ohne Symbol: "${id}" — in MENUE_SYMBOL ` +
        `(components/website/reiter.ts) eintragen. Bis dahin steht dort ein ` +
        `neutraler Punkt, der wie Absicht aussieht.`,
    );
  }
  return "ph:dot-outline";
}

/**
 * Was die Menüspalte je Leisten-Bereich zeigt.
 *
 * `id` ist der i18n-Schlüssel unter `website.menue.*` bzw. der schon
 * vorhandene Unterpunkt-Schlüssel. Fehlt ein Bereich hier, hat er KEINE
 * Menüspalte — dann rückt das Panel direkt an die Leiste, wie bei „Layers"
 * und „Theme".
 */
export const REITER_MENUE: Partial<Record<ReiterId, MenueEintrag[]>> = {
  // „Add": der Katalog nach Sachgebieten, daneben die Mediathek und der
  // Website-Text. Dieselbe Aufteilung wie im Vorbild.
  //
  // Die Kinder kommen aus `GRUPPEN` (`abschnitte.ts`) und stehen NICHT von Hand
  // hier. Vorher taten sie das, und es waren neun frei erfundene Kategorien
  // (`layout`, `basis`, `formular`, `medienBloecke`, `geschaeft`, `sozial`,
  // `blog`, `sonstige`) — abgeschrieben von Hostaways Katalog, obwohl KEINE
  // davon in unserem Katalog vorkommt. Jeder dieser Einträge hätte eine leere
  // Liste geöffnet: eine Menüspalte voller Attrappen.
  //
  // „Zuletzt" steht vorn und ist keine Gruppe aus dem Katalog, sondern eine
  // Sicht darauf — die zuletzt eingesetzten Bausteine. Im Vorbild steht sie an
  // derselben Stelle („Recent"), und aus demselben Grund: wer eine Seite baut,
  // setzt dieselben fünf Bausteine immer wieder.
  hinzufuegen: [
    {
      art: "gruppe",
      id: "bausteine",
      kinder: [{ id: ZULETZT_ID }, ...GRUPPEN.map((g) => ({ id: g }))],
    },
    { art: "ziel", id: "mediathek" },
    { art: "ziel", id: "siteText" },
  ],

  // Design (Hostaway: „Theme"). Die sieben Unterpunkte standen bisher als
  // LISTE IM PANEL („Wählen Sie einen Bereich" → Layout · Farben · Text · …).
  // Damit war das Panel eine Sackgasse: man sah die Unterpunkte erst, nachdem
  // man den Bereich geöffnet hatte, und musste für jeden Wechsel zurück.
  // In der Menüspalte stehen sie nebeneinander und bleiben stehen.
  design: [
    { art: "ziel", id: "site-layout", href: `${BAUKASTEN_BASIS}/design/site-layout` },
    { art: "ziel", id: "farben", href: `${BAUKASTEN_BASIS}/design/farben` },
    { art: "ziel", id: "text", href: `${BAUKASTEN_BASIS}/design/text` },
    { art: "ziel", id: "buttons", href: `${BAUKASTEN_BASIS}/design/buttons` },
    { art: "ziel", id: "bilder", href: `${BAUKASTEN_BASIS}/design/bilder` },
    { art: "ziel", id: "breite-abstand", href: `${BAUKASTEN_BASIS}/design/breite-abstand` },
    { art: "ziel", id: "logo", href: `${BAUKASTEN_BASIS}/design/logo` },
  ],

  // SEO hatte sechs Unterpunkte, die nur als eigene Routen existierten — man
  // sah nie, dass es sie gibt, bevor man drin war.
  // Die ÜBERSICHT liegt auf `/website/seo` selbst — eine Route
  // `/website/seo/uebersicht` gibt es NICHT. Bis 27.08.2026 baute diese
  // Tabelle sie trotzdem, und der erste Eintrag der Spalte war damit ein 404.
  // Sichtbar wurde es nur nicht, weil die Menüspalte für SEO gar nicht
  // rendert (C2) — zwei Definitionen derselben Navigation nebeneinander, von
  // denen die eine falsch war und zufällig nicht gezeigt wurde
  // (Prüfbericht C3).
  seo: SEO_UNTERPUNKTE.map((u) => ({
    art: "ziel" as const,
    id: u,
    href:
      u === SEO_UNTERPUNKTE[0]
        ? `${BAUKASTEN_BASIS}/seo`
        : `${BAUKASTEN_BASIS}/seo/${u}`,
  })),

  // Der Blog. Im Foto trägt sein Panel vier Punkte (Posts · Settings ·
  // Layouts · Import); bei uns sind es ZWEI, weil es die anderen beiden nicht
  // gibt — ein Menüpunkt, der eine leere Seite öffnet, ist eine Attrappe, und
  // davon hatte diese Spalte gerade neun (Wurzel 4).
  blog: [
    { art: "ziel", id: "beitraege", href: `${BAUKASTEN_BASIS}/blog` },
    {
      art: "ziel",
      id: "blogEinstellungen",
      href: `${BAUKASTEN_BASIS}/einstellungen/blog`,
    },
  ],

  // „More" sammelt, was die ganze Website betrifft und NICHT am offenen
  // Seiten-Entwurf arbeitet. Hostaway führt dort Blog · Store · Bookings ·
  // Personalization · Settings · Site Dashboard.
  //
  // Diese sechs Bereiche standen bei uns als gleichrangige Symbole in der
  // Leiste — elf Symbole, von denen sechs den Editor verließen. Genau das war
  // die Beschwerde „alles lädt neu statt realtime": es lag nicht am Realtime,
  // sondern daran, dass die halbe Leiste Weg-Navigation war.
  mehr: [
    { art: "ziel", id: "objekte", href: `${BAUKASTEN_BASIS}/objekte` },
    { art: "ziel", id: "regeln", href: `${BAUKASTEN_BASIS}/regeln` },
    { art: "ziel", id: "anfragen", href: `${BAUKASTEN_BASIS}/anfragen` },
    { art: "ziel", id: "widgets", href: `${BAUKASTEN_BASIS}/widgets` },
    { art: "ziel", id: "vorlagen", href: `${BAUKASTEN_BASIS}/vorlagen` },
    {
      art: "gruppe",
      id: "einstellungen",
      kinder: EINSTELLUNGEN_UNTERPUNKTE.map((u) => ({
        id: u,
        href: `${BAUKASTEN_BASIS}/einstellungen/${u}`,
      })),
    },
  ],
};

/**
 * Die Leiste selbst — SIEBEN Einträge, in der Reihenfolge des Fotos
 * (`docs/UI`, 19.02.58):
 *
 *     +   Hinzufügen
 *     ⧉   Seiten
 *     ◈   Ebenen
 *     ◫   Theme
 *         ← Lücke
 *     ⌕   SEO/AEO
 *         ← Lücke
 *     ▤   Blog
 *         ← Lücke
 *     ⋯   Mehr
 *
 * Vorher standen hier elf gleichrangige Symbole, danach sechs — „Blog" fehlte,
 * obwohl er im Vorbild eigener Eintrag ist. Alles Weitere erscheint in der
 * Menüspalte.
 *
 * Die Trennung ist Weißraum, keine Haarlinie: eine Linie zwischen zwei
 * Symbolen liest sich als Abgrenzung, ein Abstand als Gruppierung.
 */
export const LEISTE_GRUPPEN: readonly (readonly ReiterId[])[] = [
  ["hinzufuegen", "seiten", "ebenen", "design"],
  ["seo"],
  // Blog und Mediathek stehen zusammen: beides sind BESTÄNDE der Website
  // (Beiträge bzw. Medien), keine Arbeit am offenen Seitenentwurf.
  ["blog", "mediathek"],
  ["mehr"],
];
