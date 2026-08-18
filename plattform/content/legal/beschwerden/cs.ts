import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Stížnosti a řešení sporů",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tato stránka popisuje, jak myBestDays kontaktovat, jak stížnosti vyřizujeme a jaké cesty máte, pokud s naším rozhodnutím nesouhlasíte.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Jak nás kontaktovat",
      paragraphs: [
        "Nejrychleji nás zastihnete přes centrum nápovědy a kontaktní cesty tam uvedené. K existující rezervaci použijte funkci zpráv ve svém účtu — pak máme rezervaci i historii již k dispozici.",
        `Písemně nás zastihnete na ${ANBIETER.email} nebo ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko; telefonicky na ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Co má stížnost obsahovat",
      paragraphs: ["Abychom mohli rychle pomoci, uveďte prosím:"],
      list: [
        "číslo rezervace a e-mailovou adresu použitou při rezervaci;",
        "stručný popis problému;",
        "jaké řešení si přejete;",
        "související doklady — fotografie, zprávy, účtenky, výpisy z účtu.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Jak stížnost vyřizujeme",
      paragraphs: [
        "Každá stížnost je zaevidována a dostane číslo jednací, pod nímž můžete sledovat její stav.",
        "Přijetí neprodleně potvrdíme a věcně odpovíme zpravidla do sedmi dnů. Je-li potřeba delší prošetření, sdělíme vám průběžný stav.",
        "Stížnosti, u nichž jsou ohroženy osoby nebo bezprostředně nastává příjezd, vyřizujeme přednostně.",
        "Své rozhodnutí odůvodníme a uvedeme, na čem je založeno.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Stížnost proti našemu opatření",
      paragraphs: [
        "Odstranili-li jsme obsah, omezili jeho viditelnost, zrušili rezervaci nebo zablokovali účet, můžete proti tomu do šesti měsíců bezplatně podat stížnost. Odpovídá to článku 20 nařízení (EU) 2022/2065.",
        "Stížnost posuzují lidé, nikoli výhradně automatizované postupy. Ukáže-li se jako důvodná, opatření zrušíme.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Mimosoudní řešení sporů",
      paragraphs: [
        "Platforma Evropské komise pro řešení sporů online byla zrušena nařízením (EU) 2024/3228 a ukončila činnost. Stížnosti přes ni již podávat nelze.",
        "Nejsme povinni ani ochotni účastnit se řízení o řešení sporů před subjektem pro mimosoudní řešení spotřebitelských sporů.",
        `Nezávisle na tom se jako spotřebitel můžete obrátit na příslušný dánský subjekt: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánsko ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bydlíte-li v jiném členském státě, pomůže vám Evropské spotřebitelské centrum ve vaší zemi.`,
        "Týká-li se spor opatření, které jsme přijali vůči vašemu obsahu nebo účtu, můžete se navíc obrátit na orgán pro mimosoudní řešení sporů certifikovaný podle článku 21 nařízení (EU) 2022/2065. Jeho rozhodnutí pro nás nejsou závazná a k účasti v takových řízeních nejsme povinni.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Soudní cesta",
      paragraphs: [
        "Cesta k soudům je vám kdykoli otevřena, i bez předchozího řízení o stížnosti. Které soudy jsou příslušné, uvádí oddíl A19 [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Stížnosti poskytovatelů",
      paragraphs: [
        "Poskytovatelé mohou týmž postupem podávat stížnosti na uplatňování těchto podmínek, na rozhodnutí o pořadí a na omezení své nabídky. Odpovídá to článku 11 nařízení (EU) 2019/1150.",
        "O počtu, předmětu a průměrné době vyřízení takových stížností podáváme každoročně zprávu; zpráva je dostupná v části [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
