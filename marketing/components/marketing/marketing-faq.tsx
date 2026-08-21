"use client";

// FAQ der Startseite — die Fragen, die vor einem Systemwechsel wirklich
// gestellt werden.
//
// Die Machart (Balken, Chevron, 0fr→1fr-Animation, FAQPage-Schema) steht in
// `faq-liste.tsx` und wird mit der Kontaktseite geteilt; hier stehen nur noch
// die Fragen dieser Seite.
//
// Inhalt: was in der Plattform tatsächlich gebaut ist (56 Portale über Channex,
// Einheiten je Typ, Marktplatz myBestDays, Rollen, Zahlungen, EU-Hosting).
import { useTranslations } from "next-intl";

import { FaqListe } from "@/components/marketing/faq-liste";
import { SectionHeading } from "@/components/marketing/section-kit";

// Reihenfolge = Reihenfolge auf der Seite: erst „was ist das", dann Vertrieb,
// dann Betrieb, dann Geld, zuletzt Einstieg.
const FRAGEN = [
  "was",
  "portale",
  "sync",
  "betriebsarten",
  "direkt",
  "marktplatz",
  "zahlungen",
  "laender",
  "rollen",
  "app",
  "sicherheit",
  "preis",
] as const;

/**
 * `satzExtern`: der Provisionssatz für Direktbuchungen, fertig formatiert vom
 * Server (`holeProvisionssaetze`). Diese Komponente ist `"use client"` und
 * kommt selbst nicht an den Endpunkt — sie bekommt den Wert deshalb als Prop
 * von `app/page.tsx`, genau wie `preis-provisionen.tsx` seine `liste` bekommt.
 */
export function MarketingFaq({ satzExtern }: { satzExtern: string | null }) {
  const t = useTranslations("faq");

  const paare = FRAGEN.map((key) => ({
    key,
    frage: t(`${key}.frage`),
    // Nur die Antwort zu „direkt" nennt unseren Satz; alle anderen ignorieren
    // den Wert (ein ICU-Text ohne `{satz}` nimmt den Parameter unbeschadet an).
    //
    // FEHLT DER SATZ (Backend/Stripe nicht erreichbar), tritt bewusst NICHT
    // `return null` in Kraft wie bei `preis-provisionen.tsx`. Dort ist der
    // Satz die Überschrift — eine Provisions-Sektion ohne Satz sagt nichts
    // mehr. Hier ist er ein Detail in einem Absatz, der die eigentliche Frage
    // („habe ich eine eigene Buchungsseite?") auch ohne Prozentzahl
    // beantwortet. Eine verschwundene FAQ-Antwort wäre der größere Schaden:
    // sie fehlte dann auch im FAQPage-Schema, das `faq-liste.tsx` aus
    // denselben Texten baut, und eine Frage ohne Antwort liest sich als Lücke
    // im Produkt.
    //
    // Statt eines leeren Strings (der „kosten  statt der 15–18 %" ergäbe)
    // tritt das übersetzte Ersatzwort `direkt.satzUnbekannt` ein — in allen 24
    // Sprachen eine wertfreie Wendung („deutlich weniger"). Das ist KEIN
    // erfundener Zahlenwert (Wurzel 4): es wird keine Zahl behauptet, nur der
    // Vergleich, der aus den daneben stehenden 15–18 % der Portale ohnehin
    // folgt. Bewusst kein ICU-`select` auf den Satz: sein Match müsste den
    // fertig formatierten Zahlen-String treffen, der je Sprache anders
    // aussieht — ein Ersatzwort je Sprache ist die Fassung, die ein Übersetzer
    // auch ohne ICU-Kenntnis richtig pflegt.
    antwort: t(`${key}.antwort`, {
      satz: satzExtern ?? t("direkt.satzUnbekannt"),
    }),
  }));

  return (
    <section id="faq" className="scroll-mt-24 bg-surface-warm">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />
        <div className="mt-14">
          <FaqListe paare={paare} />
        </div>
      </div>
    </section>
  );
}
