// Suomenkielinen käännös oikeudellisista tiedoista. Viiteversio on
// ./de.ts — sisältömuutokset tehdään ENSIN sinne, vasta sitten tänne.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Oikeudelliset tiedot",
  metaDescription:
    "myNextDays ApS:n palveluntarjoajatiedot Tanskan sähköistä kaupankäyntiä koskevan lain (e-handelslov) 7 §:n mukaisesti: yritys, osoite, johto, CVR-numero ja yhteystiedot.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Tietoja myNextDays-alustan palveluntarjoajasta — kiinteistönhallintajärjestelmästä (property management system) ja kanavanhallinnasta (channel manager), jota ylläpitää ${ANBIETER.firma}.`,
    "Pakolliset tiedot Tanskan sähköistä kaupankäyntiä koskevan lain (e-handelslov) 7 §:n nojalla, joka panee täytäntöön sähköistä kaupankäyntiä koskevan direktiivin 2000/31/EY 5 artiklan.",
  ],
  sections: [
    {
      heading: "Palveluntarjoaja",
      zeilen: [
        {
          label: "Yritys",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Osoite",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Edustusoikeutettu johto",
          werte: [`${ANBIETER.direktion.join(" ja ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Yhteystiedot",
      zeilen: [
        {
          label: "Sähköposti",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Puhelin",
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
      heading: "Kaupparekisteri ja arvonlisävero",
      zeilen: [
        {
          label: "Kaupparekisteri",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Tanska",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Arvonlisäverotunniste",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Digipalvelusäädöksen mukainen yhteyspiste",
      paragraphs: [
        `Keskitetty yhteyspiste viranomaisille asetuksen (EU) 2022/2065 (Digital Services Act) 11 artiklan nojalla ja käyttäjille 12 artiklan nojalla: ${ANBIETER.email}.`,
        "Viestintäkielet ovat saksa, tanska ja englanti.",
      ],
    },
    {
      heading: "Kuluttajariitojen ratkaisu",
      paragraphs: [
        "Emme ole halukkaita emmekä velvollisia osallistumaan riidanratkaisumenettelyyn kuluttajariitalautakunnassa.",
      ],
    },
    {
      heading: "Vastuu linkeistä",
      paragraphs: [
        "Huolellisesta sisällön tarkastuksesta huolimatta emme vastaa ulkoisten linkkien sisällöstä. Linkitettyjen sivujen sisällöstä vastaavat yksinomaan niiden ylläpitäjät.",
      ],
    },
    {
      heading: "Tekijänoikeus",
      paragraphs: [
        `Tällä verkkosivustolla julkaistu sisältö, tekstit, grafiikat ja tavaramerkit on suojattu tekijänoikeus- ja tavaramerkkilainsäädännöllä. Kaikkeen lain sallimien tapausten ylittävään käyttöön tarvitaan ${ANBIETER.firma}:n etukäteinen kirjallinen suostumus.`,
      ],
    },
    {
      heading: "Muut oikeudelliset asiakirjat",
      paragraphs: [
        "Alustan käyttöä koskevat yleiset sopimusehtomme. Henkilötietojen käsittelytavat on kuvattu tietosuojaselosteessa; käytetyt evästeet luetellaan evästekäytännössä.",
      ],
      links: [
        { label: "Yleiset sopimusehdot", href: AGB_URL },
        { label: "Tietosuojaseloste", href: "/datenschutz" },
        { label: "Evästekäytäntö", href: "/cookie-richtlinie" },
        { label: "Tietojenkäsittelysopimus (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Sovellettava laki",
      paragraphs: [
        `${ANBIETER.firma}:n kotipaikka on Tanska, ja se on sijoittautunut yksinomaan sinne. Tähän verkkotarjontaan sovelletaan siksi Tanskan lakia — myös suomenkieliseen versioon (alkuperämaaperiaate direktiivin 2000/31/EY 3 artiklan mukaisesti). Tiedonantovelvollisuudet perustuvat Tanskan sähköistä kaupankäyntiä koskevan lain (e-handelslov) 7 §:ään.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
