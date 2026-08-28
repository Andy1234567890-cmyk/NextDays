// Die Bausteine der Objektseite (0468) — die Buchungsstrecke im Baukasten.
//
// Alle fünf ziehen ihren Inhalt aus dem ANGEZEIGTEN Objekt, nicht aus dem Block.
// Was der Kunde im Editor einstellt, ist die Darstellung: wie viele Fotos, wie
// viele Ausstattungsmerkmale, wie hoch die Karte, welche Knöpfe.
//
// WOHER DAS OBJEKT KOMMT
// Auf der dynamischen Objektseite reicht der Renderer es als `objekt` durch —
// eine Seite je Objekt, gefüllt aus denselben Daten, die auch an die Portale
// gehen. Steht ein Baustein auf einer anderen Seite (der Buchungs-Block darf
// das), trägt sein Inhalt die Objekt-ID.
//
// WAS PASSIERT, WENN ES FEHLT
// Kein erfundener Ersatz (Wurzel 4). Ohne Objekt zeigt der Baustein im Editor
// den Leer-Zustand mit dem Grund, und im ausgelieferten Auftritt gar nichts —
// eine leere Kachel beim Gast wäre schlimmer als ihr Fehlen.
import { formatCurrency, type Listing } from "@/lib/listings";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Was die Objekt-Bausteine gemeinsam brauchen. */
type ObjektProps = {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Das Objekt der aktuellen Seite. `null` außerhalb der Objektseite. */
  objekt?: Listing | null;
};

/** Eine Zahl aus dem Inhalt, mit Rückfall auf den Standard des Schemas.
 *
 *  Der Rückfall ist KEIN erfundener Wert: er ist derselbe Standard, den das
 *  Backend beim Speichern setzt. Ein Block, der vor einer Schema-Erweiterung
 *  gespeichert wurde, trägt das Feld noch nicht. */
function zahl(v: unknown, standard: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : standard;
}

function fahne(v: unknown, standard: boolean): boolean {
  return typeof v === "boolean" ? v : standard;
}

// ---------------------------------------------------------------------------
// Buchungs-Block
// ---------------------------------------------------------------------------

/** Der Buchungs-Block („Property book-form").
 *
 *  Datumsfeld, Gästezahl, und zwei Wege: anfragen oder buchen.
 *
 *  WARUM DIE KNÖPFE NAVIGIEREN UND NICHT HIER BEZAHLEN
 *  Wir rechnen als Einzige der vier verglichenen Anbieter die Zahlung selbst ab
 *  (Stripe Connect, Destination-Charge mit Provision). Der Weg dorthin ist der
 *  bestehende Checkout auf UNSERER Domain — nicht ein zweiter Zahlungsweg im
 *  Block. Zwei Wege zu derselben Zahlung wären genau die Doppelung, gegen die
 *  Wurzel 2 steht: der zweite ist der, den beim nächsten Fehler niemand sucht.
 *
 *  Ein echtes `<form method="get">` und kein JavaScript-Handler: die Auswahl
 *  landet in der Adresse, der Checkout kennt sie beim ersten Rendern, und ein
 *  halb ausgefülltes Formular lässt sich verschicken. */
export function BuchungsBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: ObjektProps) {
  const t = texte(modus.locale);
  const eigenes = typeof content.property_id === "string" ? content.property_id : "";
  const ziel = objekt?.id ?? (eigenes || null);

  if (!ziel) {
    return (
      <AbschnittLeer
        modus={modus}
        grund={t.leerBuchung}
      />
    );
  }

  const intro = pickText(content.intro, modus.locale) || t.buchungIntro;
  const buchenText = pickText(content.book_label, modus.locale) || t.buchungBuchen;
  const anfrageText =
    pickText(content.inquiry_label, modus.locale) || t.buchungAnfrage;
  const zeigeBuchen = fahne(content.show_book, true);
  const zeigeAnfrage = fahne(content.show_inquiry, true);
  const zeigePreis = fahne(content.show_price, true);

  // Beide Knöpfe aus: der Baustein hätte keinen Zweck mehr. Das ist im Editor
  // eine Einstellung, die man versehentlich trifft — deshalb der Leer-Zustand
  // mit dem Grund, statt eines Kastens ohne Ausgang.
  if (!zeigeBuchen && !zeigeAnfrage) {
    return <AbschnittLeer modus={modus} grund={t.leerBuchungOhneKnopf} />;
  }

  const preis =
    zeigePreis && objekt?.preisProNacht != null
      ? formatCurrency(objekt.preisProNacht, objekt.currency)
      : null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-sm text-muted-foreground" data-feld="intro">
          {intro}
        </p>

        {preis ? (
          <p className="pt-2 text-lg font-semibold">
            {preis} <span className="text-sm font-normal">{t.proNacht}</span>
          </p>
        ) : null}

        <form
          action={`/checkout/${encodeURIComponent(ziel)}`}
          method="get"
          className="flex flex-col gap-3 pt-4"
        >
          {/* Die Sprache als verstecktes FELD und nicht als `?lang=` in der
              `action`: bei `method="get"` baut der Browser die Adresse aus den
              Feldern neu zusammen und wirft alles weg, was in der `action`
              stand. Ein `?lang=` dort wäre also stumm verschwunden — die Art
              Fehler, die man nur daran merkt, dass der Checkout plötzlich
              deutsch ist. */}
          <input type="hidden" name="lang" value={modus.locale} />
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">{t.buchungAnreise}</span>
              <input
                type="date"
                name="start"
                className="rounded-(--radius) border border-border px-3 py-2"
              />
            </label>
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">{t.buchungAbreise}</span>
              <input
                type="date"
                name="end"
                className="rounded-(--radius) border border-border px-3 py-2"
              />
            </label>
            <label className="flex min-w-28 flex-col gap-1 text-sm">
              <span className="font-medium">{t.buchungGaeste}</span>
              <input
                type="number"
                name="guests"
                min={1}
                // Der Deckel ist die Kapazität des Objekts, nicht eine runde
                // Zahl: ein Feld, in dem zwölf Gäste stehen dürfen, obwohl vier
                // hineinpassen, erzeugt eine Anfrage, die abgelehnt werden muss.
                max={objekt?.gaeste || undefined}
                defaultValue={1}
                className="rounded-(--radius) border border-border px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {zeigeBuchen ? (
              <button
                type="submit"
                className="rounded-full bg-(--brand) px-5 py-2.5 font-medium text-(--brand-contrast)"
              >
                {buchenText}
              </button>
            ) : null}
            {zeigeAnfrage ? (
              <button
                type="submit"
                // Dieselbe Strecke, anderer Ausgang: die Anfrage landet im
                // Checkout mit `modus=anfrage` und überspringt dort die
                // Zahlung. Ein eigener Endpunkt wäre ein zweiter Weg zu
                // denselben Daten.
                formAction={`/checkout/${encodeURIComponent(ziel)}?modus=anfrage`}
                className="rounded-full border border-(--brand) px-5 py-2.5 font-medium text-(--brand)"
              >
                {anfrageText}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Galerie
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Beschreibung
// ---------------------------------------------------------------------------

export function ObjektBeschreibungBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: ObjektProps) {
  const t = texte(modus.locale);
  const text = (objekt?.beschreibung ?? "").trim();
  const headline = pickText(content.headline, modus.locale);
  if (!text) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerObjektBeschreibung}
      />
    );
  }
  const deckel = zahl(content.truncate_at, 0);
  const gekuerzt = deckel > 0 && text.length > deckel;
  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      {headline ? (
        <h2 className="pb-3 font-display text-2xl font-bold" data-feld="headline">
          {headline}
        </h2>
      ) : null}
      {/* `details`/`summary` statt eines Schalters mit JavaScript: das
          Aufklappen funktioniert ohne ein einziges Byte Skript, und der
          vollständige Text steht für Suchmaschinen von Anfang an im HTML. */}
      {gekuerzt ? (
        <details>
          <summary className="cursor-pointer list-none">
            <span className="whitespace-pre-line">
              {text.slice(0, deckel).trimEnd()}…
            </span>
            <span className="block pt-2 font-medium underline">{t.mehrAnzeigen}</span>
          </summary>
          <p className="whitespace-pre-line pt-2">{text}</p>
        </details>
      ) : (
        <p className="whitespace-pre-line">{text}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ausstattung
// ---------------------------------------------------------------------------

export function ObjektAusstattungBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: ObjektProps) {
  const t = texte(modus.locale);
  // Code UND Bezeichnung als Paar (0474). Der Code bleibt der `key` — er ist
  // eindeutig, die Bezeichnung nicht (zwei Kataloge können denselben Text
  // führen). Fehlt die Bezeichnung, steht der Code da: sichtbar falsch ist
  // besser als still verschwunden (Wurzel 5).
  //
  // Die Labels kommen vom SERVER, nicht aus einem Katalog hier. Der Renderer
  // hatte nie einen — deshalb stand live „nd_parking_included" auf der
  // Objektseite, während das Dashboard „Parkmöglichkeit inklusive" zeigte.
  const codes = objekt?.ausstattung ?? [];
  const labels = objekt?.ausstattungTexte ?? [];
  const alle = codes.map((code, i) => ({
    code,
    text: labels[i] || code,
  }));
  const headline = pickText(content.headline, modus.locale);
  if (alle.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerObjektAusstattung}
      />
    );
  }
  const sichtbar = zahl(content.visible_count, 10);
  const spalten = zahl(content.columns, 2);
  const rest = alle.slice(sichtbar);
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      {headline ? (
        <h2 className="pb-3 font-display text-2xl font-bold" data-feld="headline">
          {headline}
        </h2>
      ) : null}
      <ul
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` }}
      >
        {alle.slice(0, sichtbar).map((m) => (
          <li key={m.code} className="text-sm">
            {m.text}
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="pt-3">
          <summary className="cursor-pointer font-medium underline">
            {t.alleAnzeigen}
          </summary>
          <ul
            className="grid gap-2 pt-2"
            style={{ gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` }}
          >
            {rest.map((m) => (
              <li key={m.code} className="text-sm">
                {m.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------

/** Die Lage des Objekts.
 *
 *  Gezeigt wird der ORT, nicht die Anschrift. `ort` ist bereits gast-sicher
 *  („Stadt, Land"), und `exact` entscheidet nur über die Zoomstufe der
 *  eingebetteten Karte — eine Nadel auf dem Haus eines bewohnten Objekts steht
 *  vor der Buchung nirgends, und die Portale halten es genauso.
 *
 *  Ohne Skript und ohne Google-Schlüssel: die Einbettung läuft über die
 *  öffentliche Karten-Adresse. Ein Skript von Google auf einer Kundenseite wäre
 *  ein Dritter mit Vollzugriff auf das Dokument — und einwilligungspflichtig
 *  obendrein. */
export function ObjektKarteBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: ObjektProps) {
  const t = texte(modus.locale);
  const ort = (objekt?.ort ?? "").trim();
  const headline = pickText(content.headline, modus.locale);
  if (!ort) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerObjektKarte}
      />
    );
  }
  const zoomStufe = fahne(content.exact, false) ? zahl(content.zoom, 13) : 11;
  const hoehe = zahl(content.height, 360);
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      {headline ? (
        <h2 className="pb-3 font-display text-2xl font-bold" data-feld="headline">
          {headline}
        </h2>
      ) : null}
      <iframe
        title={`${t.lage} — ${ort}`}
        loading="lazy"
        // `referrerPolicy`: die Adresse der Kundenseite geht Google nichts an.
        referrerPolicy="no-referrer"
        src={`https://www.google.com/maps?q=${encodeURIComponent(ort)}&z=${zoomStufe}&output=embed`}
        className="w-full rounded-(--radius) border border-border"
        style={{ height: `${hoehe}px` }}
      />
      <p className="pt-2 text-sm text-muted-foreground">{ort}</p>
    </section>
  );
}
