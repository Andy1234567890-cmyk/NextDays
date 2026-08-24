// Traduzzjoni bil-Malti tal-avviż legali. Il-verżjoni ta' referenza hija
// ./de.ts — kwalunkwe bidla fil-kontenut trid issir L-EWWEL hemm, imbagħad hawn.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Avviż Legali",
  metaDescription:
    "Informazzjoni dwar il-fornitur myNextDays ApS skont l-Artikolu 7 tal-liġi Daniża dwar il-kummerċ elettroniku (e-handelslov): kumpanija, indirizz, tmexxija, numru CVR u kuntatt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Informazzjoni dwar il-fornitur tal-pjattaforma myNextDays — property management system u channel manager operat minn ${ANBIETER.firma}.`,
    "Informazzjoni obbligatorja skont l-Artikolu 7 tal-liġi Daniża dwar il-kummerċ elettroniku (e-handelslov), li tittrasponi l-Artikolu 5 tad-Direttiva 2000/31/KE dwar il-kummerċ elettroniku.",
  ],
  sections: [
    {
      heading: "Fornitur",
      zeilen: [
        {
          label: "Kumpanija",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Indirizz",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Tmexxija awtorizzata tirrappreżenta",
          werte: [`${ANBIETER.direktion.join(" u ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kuntatt",
      zeilen: [
        {
          label: "Email",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Websajt",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Reġistru kummerċjali u VAT",
      zeilen: [
        {
          label: "Reġistru kummerċjali",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, id-Danimarka",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Numru ta' identifikazzjoni tal-VAT",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Punt ta' kuntatt skont l-Att dwar is-Servizzi Diġitali",
      paragraphs: [
        `Punt ta' kuntatt ċentrali għall-awtoritajiet skont l-Artikolu 11 u għall-utenti skont l-Artikolu 12 tar-Regolament (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Il-lingwi ta' komunikazzjoni huma l-Ġermaniż, id-Daniż u l-Ingliż.",
      ],
    },
    {
      heading: "Riżoluzzjoni ta' tilwim mal-konsumatur",
      paragraphs: [
        "Aħna la lesti u lanqas obbligati li nieħdu sehem fi proċedura ta' riżoluzzjoni ta' tilwim quddiem korp ta' arbitraġġ tal-konsumatur.",
      ],
    },
    {
      heading: "Responsabbiltà għal-links",
      paragraphs: [
        "Minkejja kontroll bir-reqqa tal-kontenut, aħna ma nassumu ebda responsabbiltà għall-kontenut ta' links esterni. Għall-kontenut tal-paġni li għalihom jipperikolaw il-links huma responsabbli esklużivament l-operaturi rispettivi tagħhom.",
      ],
    },
    {
      heading: "Drittijiet tal-awtur",
      paragraphs: [
        `Il-kontenut, it-testi, il-grafika u t-trademarks ippubblikati fuq dan is-sit web huma protetti bid-drittijiet tal-awtur u bid-dritt tat-trademarks. Kwalunkwe użu li jmur lil hinn mill-każijiet permessi mil-liġi jeħtieġ il-kunsens bil-miktub minn qabel ta' ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Dokumenti legali oħra",
      paragraphs: [
        "L-użu tal-pjattaforma huwa rregolat mit-Termini u l-Kondizzjonijiet Ġenerali tagħna. Kif nipproċessaw id-data personali hija deskritta fil-Politika ta' Privatezza; il-cookies użati huma elenkati fil-Politika dwar il-Cookies.",
      ],
      links: [
        { label: "Termini u Kondizzjonijiet Ġenerali", href: AGB_URL },
        { label: "Politika ta' Privatezza", href: "/datenschutz" },
        { label: "Politika dwar il-Cookies", href: "/cookie-richtlinie" },
        { label: "Ftehim ta' Pproċessar ta' Data (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Liġi applikabbli",
      paragraphs: [
        `${ANBIETER.firma} għandha s-sede tagħha u hija stabbilita esklużivament fid-Danimarka. Għal din l-offerta online tapplika għalhekk il-liġi Daniża — anki għall-verżjoni bil-lingwa Maltija (il-prinċipju tal-pajjiż tal-oriġini skont l-Artikolu 3 tad-Direttiva 2000/31/KE). L-obbligi ta' informazzjoni jirriżultaw mill-Artikolu 7 tal-liġi Daniża dwar il-kummerċ elettroniku (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
