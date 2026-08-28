// Die VORLAGENFELDER eines Beitrags auf der Website (0483/0485).
//
// WARUM ES DIESE DATEI GIBT
// =========================
// Die Felder aus der Framer-Feldliste — Branche, Kunde, voller Titel,
// Einleitung, Aufforderung, drei Galerien, Abschluss, Karussell — wurden seit
// 0483 im CMS gepflegt, gespeichert und in der Beitragstabelle angezeigt. Auf
// der WEBSITE erschien nichts davon: der öffentliche Ladeweg holte die Spalten
// gar nicht erst, und die Beitragsseite kannte sie nicht.
//
// Gemeldet am 28.08.2026 mit der ganzen Feldliste und dem Satz „das alles wird
// im Preview nicht angezeigt (im blog)". Ein Feld, das man ausfüllen kann und
// das nirgends erscheint, ist eine Attrappe mit Datenhaltung — genau die
// Sorte, die niemand als Fehler erkennt, weil das Speichern ja funktioniert.
//
// DIE REIHENFOLGE IST DIE DER MASKE
// =================================
// Einordnung → voller Titel → Einleitung → Aufforderung → Galerie oben →
// Beitragstext → Galerie links/rechts → Galerie unten → Abschluss → Karussell.
// Dieselbe Folge wie im Dialog und in der Tabelle. Drei verschiedene
// Reihenfolgen für dieselben Felder wären drei Orte, an denen man suchen muss.
//
// WAS NICHT PASSIERT
// ==================
// Ein leeres Feld erzeugt NICHTS — keine Überschrift, keinen Abstand, keine
// leere Kachel. Ein Beitrag, der nur Titel und Text hat, sieht deshalb genauso
// aus wie vorher. Das ist die Bedingung dafür, dass diese Ergänzung keinen
// bestehenden Blog umbaut.
import type { BeitragsFelder } from "@/lib/site";
import { texte as rendererTexte } from "@/lib/texte";

import { Karussell } from "./karussell";

/** Eine Bildreihe. Ein Bild füllt die Breite, mehrere stehen im Raster.
 *
 *  `loading="lazy"` überall: diese Bilder stehen unter der Falz. Das
 *  Titelbild oben lädt weiterhin sofort — es ist das LCP-Element. */
function Bildreihe({ bilder }: { bilder: string[] }) {
  if (bilder.length === 0) return null;
  return (
    <div
      className={
        bilder.length === 1
          ? "mt-8"
          : "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
      }
    >
      {bilder.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${i}`}
          src={url}
          alt=""
          loading="lazy"
          className="w-full rounded-2xl object-cover"
        />
      ))}
    </div>
  );
}

/** Ein Textabschnitt mit optionaler Überschrift.
 *
 *  Die Überschrift ist `h2` und nicht `h1`: der Beitragstitel ist die `h1`
 *  dieser Seite, und eine zweite wäre für Suchmaschinen und Vorlesefunktion
 *  eine zweite Seitenüberschrift. */
function Abschnitt({
  ueberschrift,
  text,
}: {
  ueberschrift: string | null;
  text: string | null;
}) {
  if (!ueberschrift && !text) return null;
  return (
    <section className="mt-10">
      {ueberschrift ? (
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {ueberschrift}
        </h2>
      ) : null}
      {text ? (
        // `whitespace-pre-line`: die Felder sind Freitext aus einem
        // `textarea`. Absätze, die der Redakteur getippt hat, bleiben Absätze
        // — ohne das stünde alles in einer Zeile, und niemand fände den Grund
        // im Renderer.
        <p className="whitespace-pre-line pt-3 text-lg leading-relaxed text-foreground/90">
          {text}
        </p>
      ) : null}
    </section>
  );
}

export function BeitragFelder({
  felder,
  /** Die Sprache der Seite — die Karussell-Bedienung ist beschriftet, und
   *  ein deutsches „Nächstes Bild" im dänischen Blog wäre ein Fremdkörper. */
  sprache,
  /** Die eigenen Felder des Betriebs (0485) mit ihren Namen — ohne sie stünde
   *  über einem Wert sein technischer Schlüssel. Fehlt die Liste, werden die
   *  eigenen Werte NICHT gezeigt: ein Wert unter „lesedauer" wäre schlechter
   *  als keiner. */
  eigeneFelder = [],
}: {
  felder: BeitragsFelder | null;
  sprache: string;
  eigeneFelder?: readonly { feld_key: string; label: string }[];
}) {
  if (!felder) return null;
  const texte = rendererTexte(sprache);

  const eigene = eigeneFelder
    .map((f) => ({ name: f.label, wert: felder.custom?.[f.feld_key] }))
    // `false` faellt MIT weg: ein ausgeschalteter Schalter hat auf der Seite
    // nichts zu sagen. Ihn als „Nein" zu zeigen waere eine Aussage, die der
    // Betrieb nicht getroffen hat — er hat das Haekchen nur nicht gesetzt.
    .filter(
      (e) =>
        e.wert !== null &&
        e.wert !== undefined &&
        e.wert !== "" &&
        e.wert !== false &&
        !(Array.isArray(e.wert) && e.wert.length === 0),
    );

  return (
    <>
      {/* EINORDNUNG — Branche und Kunde als Zeile über dem Inhalt. Sie sind
          keine Überschrift, sondern die Einordnung des Beitrags; im Vorbild
          stehen sie ebenfalls klein und nebeneinander. */}
      {felder.industry || felder.client ? (
        <p className="mt-10 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {felder.industry ? <span>{felder.industry}</span> : null}
          {felder.industry && felder.client ? <span aria-hidden>·</span> : null}
          {felder.client ? <span>{felder.client}</span> : null}
        </p>
      ) : null}

      {/* Der VOLLE Titel. Er steht neben dem kurzen Listentitel und ist nicht
          dessen Ersatz (Analyse G: „ZWEI Felder, nicht ein gekürztes"). Als
          `h2` — die `h1` ist der Beitragstitel. */}
      {felder.full_title ? (
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">
          {felder.full_title}
        </h2>
      ) : null}

      <Abschnitt
        ueberschrift={felder.intro_heading}
        text={felder.intro_body}
      />

      {/* Die AUFFORDERUNG. Nur wenn beides da ist: ein Knopf ohne Ziel führt
          nirgendwohin, und ein Ziel ohne Beschriftung ist unsichtbar. */}
      {felder.button_text && felder.website_link ? (
        <p className="mt-6">
          <a
            href={felder.website_link}
            // Ein Ziel, das der Betrieb eingetragen hat, ist eine fremde
            // Adresse — `noopener` und `nofollow` gehören dran (Wurzel 8).
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {felder.button_text}
          </a>
        </p>
      ) : null}

      <Bildreihe bilder={felder.gallery_top} />

      {/* Die beiden EINZELBILDER stehen nebeneinander — im Vorbild sind es
          ausdrücklich zwei Image-Felder und keine Galerie (Analyse C, Feld
          14/15). Steht nur eines, füllt es die Breite. */}
      <Bildreihe
        bilder={[felder.gallery_left, felder.gallery_right].filter(
          (b): b is string => Boolean(b),
        )}
      />

      <Bildreihe bilder={felder.gallery_bottom} />

      <Abschnitt
        ueberschrift={felder.final_heading}
        text={felder.final_body}
      />

      {/* Das KARUSSELL. Es zeigt nur, was der Schalter erlaubt — ein
          ausgeschaltetes Karussell mit Bildern darin ist eine Entscheidung
          des Betriebs und keine leere Liste.

          Waagerecht scrollend und ohne JavaScript: `snap` reicht für vier
          Bilder, und eine Bibliothek dafür wäre auf jeder Beitragsseite
          Ballast. */}
      {/* DAS KARUSSELL — ein eigener Baustein mit Bedienung (`./karussell`).
          Es zeigt nur, was der Schalter erlaubt: ein ausgeschaltetes Karussell
          mit Bildern darin ist eine Entscheidung des Betriebs, keine leere
          Liste.

          Vorher stand hier ein blosser Scroll-Streifen. Er liess sich wischen,
          aber am Rechner gab es KEINEN Weg weiter — keine Pfeile, keine
          Punkte, die Bildlaufleiste ausgeblendet (gemeldet am 28.08.2026:
          „niergends geht das karousell"). */}
      {felder.show_carousel && felder.carousel.length > 0 ? (
        <Karussell
          bilder={felder.carousel}
          texte={{
            vorheriges: texte.galerieZurueck,
            naechstes: texte.galerieWeiter,
            zuBild: texte.sliderFolie,
          }}
        />
      ) : null}

      {/* Die EIGENEN Felder (0485). Als Beschreibungsliste, weil sie genau das
          sind: Name und Wert. Eine erfundene Gestaltung je Feldart wäre eine
          Behauptung darüber, wofür der Betrieb das Feld angelegt hat. */}
      {eigene.length > 0 ? (
        <dl className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-6 sm:grid-cols-[auto_1fr]">
          {eigene.map((e) => (
            <div key={e.name} className="contents">
              <dt className="text-sm text-muted-foreground">{e.name}</dt>
              <dd className="text-sm text-foreground">
                {Array.isArray(e.wert)
                  ? (e.wert as unknown[]).join(", ")
                  : e.wert === true
                    ? "\u2713"
                    : String(e.wert)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
