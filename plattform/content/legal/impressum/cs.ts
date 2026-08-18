import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Právní informace",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    `Údaje o poskytovateli tržiště myBestDays. Provozovatelem je ${ANBIETER.firma}; myBestDays je ochranná známka této společnosti, nikoli samostatná právnická osoba.`,
    "Povinné údaje podle § 7 dánského zákona o elektronickém obchodu, který provádí článek 5 směrnice 2000/31/ES, a podle článků 11 a 12 nařízení (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Provozovatel platformy",
      paragraphs: [
        `${ANBIETER.firma} — společnost s ručením omezeným (anpartsselskab, ApS) podle dánského práva`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko`,
        `Statutární vedení: ${ANBIETER.direktion.join(" a ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "V záležitostech týkajících se existující rezervace použijte funkci zpráv ve svém účtu — pak máme rezervaci i historii již k dispozici; viz [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Rejstřík a DPH",
      paragraphs: [
        `CVR č. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánsko.`,
        ...(ANBIETER.ustId
          ? [`Daňové identifikační číslo pro DPH: ${ANBIETER.ustId}.`]
          : [
              "Daňové identifikační číslo pro DPH v současnosti neexistuje; § 7 zákona o elektronickém obchodu vyžaduje jeho uvedení pouze při existující registraci k DPH.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktní místa podle nařízení (EU) 2022/2065",
      paragraphs: [
        `Jednotné kontaktní místo pro orgány podle článku 11 a pro uživatele podle článku 12: ${ANBIETER.email}, poštou na výše uvedenou adresu.`,
        "Jazyky komunikace jsou němčina, dánština a angličtina.",
        "Postupy podle tohoto nařízení — hlášení protiprávního obsahu, odůvodnění opatření, vyřizování stížností — jsou popsány pod [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Příslušné orgány",
      paragraphs: [
        `Koordinátor digitálních služeb podle článku 49 nařízení (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Dánsko ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Dozorový úřad pro ochranu osobních údajů: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánsko, ${AUFSICHTSBEHOERDE.email}.`,
        "Zprostředkování ubytovacích služeb nevyžaduje v Dánsku zvláštní povolení; oborový dozorový orgán proto neexistuje.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Řešení spotřebitelských sporů",
      paragraphs: [
        "Platforma Evropské komise pro řešení sporů online byla zrušena nařízením (EU) 2024/3228 a ukončila činnost.",
        "Nejsme povinni ani ochotni účastnit se řízení o řešení sporů před subjektem pro mimosoudní řešení spotřebitelských sporů.",
        `Nezávisle na tom se jako spotřebitel můžete obrátit na příslušný dánský subjekt: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánsko ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bydlíte-li v jiném členském státě, pomůže vám Evropské spotřebitelské centrum ve vaší zemi.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Poznámky k obsahu a odkazům",
      paragraphs: [
        "Obsah inzerátů pochází od příslušných poskytovatelů. myBestDays si jej neosvojuje; viz oddíl A4 [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Za obsah odkazovaných stránek třetích osob odpovídá jejich provozovatel. Dozvíme-li se o porušení práva, odkaz neprodleně odstraníme.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autorské právo",
      paragraphs: [
        `Vlastní obsah, texty, grafika a ochranné známky zveřejněné na této platformě jsou chráněny autorským a známkovým právem. Užití nad rámec zákonem dovolených případů vyžaduje předchozí písemný souhlas společnosti ${ANBIETER.firma}; pro ochranné známky platí [Pravidla pro ochranné známky](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Rozhodné právo",
      paragraphs: [
        `${ANBIETER.firma} má sídlo v Dánsku a je usazena výhradně tam. Na tuto online nabídku se proto použije dánské právo — i na české znění (zásada země původu podle článku 3 směrnice 2000/31/ES). Kogentní spotřebitelské předpisy státu vašeho bydliště zůstávají nedotčeny.`,
      ],
    },
  ],
};
