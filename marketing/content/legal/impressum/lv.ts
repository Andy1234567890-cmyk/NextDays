// Latviešu valodas tulkojums juridiskajai informācijai. Atsauces versija
// ir ./de.ts — satura izmaiņas vispirms jāveic tur, tikai pēc tam šeit.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Juridiskā informācija",
  metaDescription:
    "Pakalpojumu sniedzēja myNextDays ApS dati saskaņā ar Dānijas Elektroniskās tirdzniecības likuma (e-handelslov) 7. § : uzņēmums, adrese, vadība, CVR numurs un kontaktinformācija.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Informācija par platformas myNextDays pakalpojumu sniedzēju — property management system un channel manager, ko uztur ${ANBIETER.firma}.`,
    "Obligāta informācija saskaņā ar Dānijas Elektroniskās tirdzniecības likuma (e-handelslov) 7. §, ar kuru transponēts Direktīvas 2000/31/EK par elektronisko tirdzniecību 5. pants.",
  ],
  sections: [
    {
      heading: "Pakalpojumu sniedzējs",
      zeilen: [
        {
          label: "Uzņēmums",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adrese",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Pārstāvībai pilnvarotā vadība",
          werte: [`${ANBIETER.direktion.join(" un ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakti",
      zeilen: [
        {
          label: "E-pasts",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Tālrunis",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Tīmekļvietne",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Komercreģistrs un PVN",
      zeilen: [
        {
          label: "Komercreģistrs",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dānija",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "PVN maksātāja reģistrācijas numurs",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktpunkts saskaņā ar Digitālo pakalpojumu aktu",
      paragraphs: [
        `Centrāls kontaktpunkts iestādēm saskaņā ar 11. pantu un lietotājiem saskaņā ar 12. pantu Regulā (ES) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Saziņas valodas ir vācu, dāņu un angļu.",
      ],
    },
    {
      heading: "Patērētāju strīdu izšķiršana",
      paragraphs: [
        "Mēs neesam ne gatavi, ne pienākušies piedalīties strīdu izšķiršanas procedūrā patērētāju strīdu izšķiršanas iestādē.",
      ],
    },
    {
      heading: "Atbildība par saitēm",
      paragraphs: [
        "Neraugoties uz rūpīgu satura pārbaudi, mēs neuzņemamies atbildību par ārējo saišu saturu. Par saistīto lapu saturu atbild vienīgi to attiecīgie uzturētāji.",
      ],
    },
    {
      heading: "Autortiesības",
      paragraphs: [
        `Šajā tīmekļa vietnē publicētais saturs, teksti, grafika un preču zīmes ir aizsargāti ar autortiesībām un preču zīmju tiesībām. Jebkurai izmantošanai, kas pārsniedz likumā atļautos gadījumus, nepieciešama iepriekšēja rakstiska ${ANBIETER.firma} piekrišana.`,
      ],
    },
    {
      heading: "Citi juridiskie dokumenti",
      paragraphs: [
        "Platformas izmantošanu regulē mūsu Vispārīgie darījumu noteikumi. Personas datu apstrādes veids ir aprakstīts Privātuma politikā; izmantotās sīkdatnes ir uzskaitītas Sīkdatņu politikā.",
      ],
      links: [
        { label: "Vispārīgie darījumu noteikumi", href: AGB_URL },
        { label: "Privātuma politika", href: "/datenschutz" },
        { label: "Sīkdatņu politika", href: "/cookie-richtlinie" },
        { label: "Datu apstrādes līgums (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Piemērojamās tiesības",
      paragraphs: [
        `${ANBIETER.firma} juridiskā adrese un vienīgā dibināšanas vieta ir Dānija. Tāpēc šim tiešsaistes piedāvājumam piemēro Dānijas tiesības — arī latviešu valodas versijai (izcelsmes valsts princips saskaņā ar Direktīvas 2000/31/EK 3. pantu). Informēšanas pienākumi izriet no Dānijas Elektroniskās tirdzniecības likuma (e-handelslov) 7. §.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
