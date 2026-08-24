// Hrvatski prijevod pravnih informacija (impresum). Referentna verzija je
// ./de.ts — sadržajne izmjene idu NAJPRIJE tamo, tek onda ovdje.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Impresum",
  metaDescription:
    "Podaci o pružatelju usluge myNextDays ApS sukladno § 7 danskog Zakona o elektroničkoj trgovini (e-handelslov): tvrtka, adresa, uprava, CVR broj i kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Podaci o pružatelju platforme myNextDays — property management system i channel manager kojim upravlja ${ANBIETER.firma}.`,
    "Obvezni podaci sukladno § 7 danskog Zakona o elektroničkoj trgovini (e-handelslov), koji prenosi članak 5. Direktive 2000/31/EZ o elektroničkoj trgovini.",
  ],
  sections: [
    {
      heading: "Pružatelj usluge",
      zeilen: [
        {
          label: "Tvrtka",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Ovlaštena uprava",
          werte: [`${ANBIETER.direktion.join(" i ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-pošta",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Sudski registar i PDV",
      zeilen: [
        {
          label: "Sudski registar",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danska",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Identifikacijski broj za PDV",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktna točka prema Aktu o digitalnim uslugama",
      paragraphs: [
        `Središnja kontaktna točka za tijela vlasti prema članku 11. i za korisnike prema članku 12. Uredbe (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Jezici komunikacije su njemački, danski i engleski.",
      ],
    },
    {
      heading: "Rješavanje potrošačkih sporova",
      paragraphs: [
        "Nismo ni spremni ni obvezni sudjelovati u postupku rješavanja sporova pred potrošačkim arbitražnim tijelom.",
      ],
    },
    {
      heading: "Odgovornost za poveznice",
      paragraphs: [
        "Unatoč pažljivoj kontroli sadržaja, ne preuzimamo odgovornost za sadržaj vanjskih poveznica. Za sadržaj povezanih stranica isključivo su odgovorni njihovi operateri.",
      ],
    },
    {
      heading: "Autorska prava",
      paragraphs: [
        `Sadržaj, tekstovi, grafike i žigovi objavljeni na ovoj internetskoj stranici zaštićeni su autorskim i žigovnim pravom. Svaka uporaba izvan zakonom dopuštenih slučajeva zahtijeva prethodnu pisanu suglasnost tvrtke ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Ostali pravni dokumenti",
      paragraphs: [
        "Korištenje platforme uređeno je našim Općim uvjetima poslovanja. Način obrade osobnih podataka opisan je u Politici privatnosti; korišteni kolačići navedeni su u Politici kolačića.",
      ],
      links: [
        { label: "Opći uvjeti poslovanja", href: AGB_URL },
        { label: "Politika privatnosti", href: "/datenschutz" },
        { label: "Politika kolačića", href: "/cookie-richtlinie" },
        { label: "Ugovor o obradi podataka (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Mjerodavno pravo",
      paragraphs: [
        `${ANBIETER.firma} ima sjedište i isključivo je osnovana u Danskoj. Za ovu internetsku ponudu stoga vrijedi dansko pravo — i za hrvatsku jezičnu verziju (načelo zemlje podrijetla prema članku 3. Direktive 2000/31/EZ). Obveze informiranja proizlaze iz § 7 danskog Zakona o elektroničkoj trgovini (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
