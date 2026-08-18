import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Právne informácie",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    `Údaje o poskytovateľovi trhoviska myBestDays. Prevádzkovateľom je ${ANBIETER.firma}; myBestDays je ochranná známka tejto spoločnosti, nie samostatná právnická osoba.`,
    "Povinné údaje podľa § 7 dánskeho zákona o elektronickom obchode, ktorý transponuje článok 5 smernice 2000/31/ES, a podľa článkov 11 a 12 nariadenia (EÚ) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Prevádzkovateľ Platformy",
      paragraphs: [
        `${ANBIETER.firma} — spoločnosť s ručením obmedzeným (anpartsselskab, ApS) podľa dánskeho práva`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko`,
        `Štatutárne zastúpenie: ${ANBIETER.direktion.join(" a ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefón: ${ANBIETER.telefon}`,
        "Vo veciach existujúcej rezervácie použite funkciu správ vo svojom účte — potom máme rezerváciu aj históriu už k dispozícii; pozri [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register a DPH",
      paragraphs: [
        `CVR č. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánsko.`,
        ...(ANBIETER.ustId
          ? [`Identifikačné číslo pre DPH: ${ANBIETER.ustId}.`]
          : [
              "Identifikačné číslo pre DPH v súčasnosti neexistuje; § 7 zákona o elektronickom obchode vyžaduje jeho uvedenie len pri existujúcej registrácii pre DPH.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktné miesta podľa nariadenia (EÚ) 2022/2065",
      paragraphs: [
        `Jednotné kontaktné miesto pre orgány podľa článku 11 a pre používateľov podľa článku 12: ${ANBIETER.email}, poštou na uvedenú adresu.`,
        "Jazykmi komunikácie sú nemčina, dánčina a angličtina.",
        "Postupy podľa tohto nariadenia — nahlasovanie protiprávneho obsahu, odôvodnenie opatrení, vybavovanie sťažností — sú opísané v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Príslušné orgány",
      paragraphs: [
        `Koordinátor digitálnych služieb podľa článku 49 nariadenia (EÚ) 2022/2065: ${DSA_KOORDINATOR.name}, Dánsko ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Dozorný orgán pre ochranu údajov: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánsko, ${AUFSICHTSBEHOERDE.email}.`,
        "Sprostredkovanie ubytovacích služieb si v Dánsku nevyžaduje osobitné povolenie; odvetvový dozorný orgán preto neexistuje.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Riešenie spotrebiteľských sporov",
      paragraphs: [
        "Platforma Európskej komisie na riešenie sporov online bola zrušená nariadením (EÚ) 2024/3228 a ukončila činnosť.",
        "Nie sme povinní ani ochotní zúčastniť sa na konaní o riešení sporov pred subjektom alternatívneho riešenia spotrebiteľských sporov.",
        `Nezávisle od toho sa ako spotrebiteľ môžete obrátiť na príslušný dánsky subjekt: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánsko ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ak bývate v inom členskom štáte, pomôže Vám Európske spotrebiteľské centrum vo Vašej krajine.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Poznámky k obsahu a odkazom",
      paragraphs: [
        "Obsah inzerátov pochádza od príslušných poskytovateľov. myBestDays si ho neosvojuje; pozri oddiel A4 [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Za obsah odkazovaných stránok tretích strán zodpovedá ich prevádzkovateľ. Len čo sa dozvieme o porušení práva, odkaz bezodkladne odstránime.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autorské právo",
      paragraphs: [
        `Vlastný obsah, texty, grafika a ochranné známky zverejnené na tejto Platforme sú chránené autorským a známkovým právom. Použitie nad rámec zákonom dovolených prípadov si vyžaduje predchádzajúci písomný súhlas spoločnosti ${ANBIETER.firma}; pre ochranné známky platia [Pravidlá pre ochranné známky](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Rozhodné právo",
      paragraphs: [
        `${ANBIETER.firma} má sídlo v Dánsku a je usadená výlučne tam. Na túto online ponuku sa preto uplatní dánske právo — aj na slovenské znenie (zásada krajiny pôvodu podľa článku 3 smernice 2000/31/ES). Kogentné spotrebiteľské predpisy štátu Vášho bydliska zostávajú nedotknuté.`,
      ],
    },
  ],
};
