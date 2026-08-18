import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informazzjoni legali",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    `Id-dettalji tal-fornitur tas-suq myBestDays. L-operatur huwa ${ANBIETER.firma}; myBestDays hija trademark ta' din il-kumpanija u mhijiex persuna ġuridika separata.`,
    "Dettalji obbligatorji skont l-Artikolu 7 tal-Att Daniż dwar il-kummerċ elettroniku, li jittrasponi l-Artikolu 5 tad-Direttiva 2000/31/KE, u skont l-Artikoli 11 u 12 tar-Regolament (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operatur tal-Pjattaforma",
      paragraphs: [
        `${ANBIETER.firma} — kumpanija b'responsabbiltà limitata (anpartsselskab, ApS) taħt il-liġi Daniża`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, id-Danimarka`,
        `Rappreżentanza legali: ${ANBIETER.direktion.join(" u ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kuntatt",
      paragraphs: [
        `Email: ${ANBIETER.email}`,
        `Telefown: ${ANBIETER.telefon}`,
        "F'kwistjonijiet dwar ibbukkjar eżistenti uża l-funzjoni tal-messaġġi fil-kont tiegħek — hekk ikollna diġà l-ibbukkjar u l-istorja; ara [Ilmenti u riżoluzzjoni ta' tilwim](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Reġistru u VAT",
      paragraphs: [
        `CVR nru ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, id-Danimarka.`,
        ...(ANBIETER.ustId
          ? [`Numru ta' identifikazzjoni tal-VAT: ${ANBIETER.ustId}.`]
          : [
              "Numru ta' identifikazzjoni tal-VAT bħalissa ma jeżistix; l-Artikolu 7 tal-Att dwar il-kummerċ elettroniku jitlob l-indikazzjoni tiegħu biss f'każ ta' reġistrazzjoni tal-VAT eżistenti.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Punti ta' kuntatt skont ir-Regolament (UE) 2022/2065",
      paragraphs: [
        `Punt uniku ta' kuntatt għall-awtoritajiet skont l-Artikolu 11 u għall-utenti skont l-Artikolu 12: ${ANBIETER.email}, bil-posta fl-indirizz imsemmi hawn fuq.`,
        "Il-lingwi ta' komunikazzjoni huma l-Ġermaniż, id-Daniż u l-Ingliż.",
        "Il-proċeduri skont dan ir-regolament — rapportar ta' kontenut illegali, motivazzjoni tal-miżuri, trattament tal-ilmenti — huma deskritti fit-taqsima [Att dwar is-Servizzi Diġitali](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Awtoritajiet kompetenti",
      paragraphs: [
        `Koordinatur tas-Servizzi Diġitali skont l-Artikolu 49 tar-Regolament (UE) 2022/2065: ${DSA_KOORDINATOR.name}, id-Danimarka ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Awtorità superviżorja għall-protezzjoni tad-data: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, id-Danimarka, ${AUFSICHTSBEHOERDE.email}.`,
        "L-intermedjazzjoni ta' servizzi ta' akkomodazzjoni ma teħtieġx awtorizzazzjoni speċjali fid-Danimarka; għaldaqstant ma teżistix awtorità superviżorja settorjali.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Riżoluzzjoni ta' tilwim tal-konsumaturi",
      paragraphs: [
        "Il-pjattaforma tal-Kummissjoni Ewropea għar-riżoluzzjoni online tat-tilwim ġiet imħassra bir-Regolament (UE) 2024/3228 u waqfet topera.",
        "M'aħniex obbligati u lanqas lesti li nipparteċipaw fi proċedura ta' riżoluzzjoni ta' tilwim quddiem korp ta' riżoluzzjoni alternattiva ta' tilwim tal-konsumaturi.",
        `Indipendentement minn dan, bħala konsumatur tista' tirrikorri għall-korp Daniż kompetenti: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, id-Danimarka ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jekk tgħix fi Stat Membru ieħor, jgħinek iċ-Ċentru Ewropew tal-Konsumaturi ta' pajjiżek.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Noti dwar il-kontenut u l-links",
      paragraphs: [
        "Il-kontenut tar-reklami ġej mill-fornituri rispettivi. myBestDays ma tagħmlux tagħha; ara t-taqsima A4 tat-[Termini tal-użu](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Għall-kontenut ta' paġni ta' terzi b'link responsabbli l-operatur tagħhom. Ladarba nsiru nafu bi ksur tal-liġi, inneħħu l-link mingħajr dewmien.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Dritt tal-awtur",
      paragraphs: [
        `Il-kontenut proprju, it-testi, il-grafika u t-trademarks ippubblikati fuq din il-Pjattaforma huma protetti mid-dritt tal-awtur u mid-dritt tat-trademarks. L-użu lil hinn mill-każijiet permessi bil-liġi jeħtieġ il-kunsens miktub minn qabel ta' ${ANBIETER.firma}; għat-trademarks japplikaw ir-[Regoli dwar it-trademarks](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Liġi applikabbli",
      paragraphs: [
        `${ANBIETER.firma} għandha s-sede tagħha fid-Danimarka u hija stabbilita esklużivament hemm. Għal din l-offerta online tapplika għalhekk il-liġi Daniża — anke għall-verżjoni bil-Malti (prinċipju tal-pajjiż tal-oriġini skont l-Artikolu 3 tad-Direttiva 2000/31/KE). Id-dispożizzjonijiet imperattivi ta' protezzjoni tal-konsumatur tal-Istat ta' residenza tiegħek jibqgħu intatti.`,
      ],
    },
  ],
};
