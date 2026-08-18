import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Vyhlásenie o prístupnosti",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays má byť použiteľný pre každého. Toto vyhlásenie opisuje stav prístupnosti Platformy, známe obmedzenia a spôsob, ako nám nahlásiť bariéry.",
    "Vzťahuje sa na požiadavky smernice (EÚ) 2019/882 o požiadavkách na prístupnosť výrobkov a služieb, ktorá sa od 28. júna 2025 vzťahuje na služby elektronického obchodu.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stav prístupnosti",
      paragraphs: [
        "Riadime sa harmonizovanou normou EN 301 549 a pravidlami Web Content Accessibility Guidelines (WCAG) 2.1, z ktorých vychádza, na úrovni zhody AA.",
        "Zavedené je okrem iného: priebežná ovládateľnosť klávesnicou, viditeľné zameranie, sémantická štruktúra nadpisov, popisy pri všetkých formulárových poliach, textové alternatívy ovládacích prvkov, dostatočný farebný kontrast, škálovateľnosť textu bez straty obsahu a zobrazenie prispôsobujúce sa veľkosti obrazovky.",
        "Právne texty sú dostupné vo všetkých 24 úradných jazykoch Únie a majú správne jazykové označenie, aby ich čítačky obrazovky správne prečítali.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Známe obmedzenia",
      paragraphs: ["Prístupné v súčasnosti nie sú najmä:"],
      list: [
        "Fotografie a opisy v inzerátoch pochádzajú od poskytovateľov; textové alternatívy k fotografiám môžu chýbať alebo byť nedostatočné. Vyzývame poskytovateľov, aby ich doplnili.",
        "Vložené mapové podklady tretích strán možno klávesnicou ovládať len obmedzene. Všetky údaje o polohe sú k dispozícii aj ako text.",
        "Dokumenty nahrané poskytovateľmi (napríklad domový poriadok vo formáte PDF) nie sú priebežne označené prístupným spôsobom.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Prístupnosť ubytovaní",
      paragraphs: [
        "Toto vyhlásenie sa týka Platformy, nie ubytovaní. Údaje o stavebnej prístupnosti ubytovania pochádzajú od poskytovateľa.",
        "Ak ste odkázaní na určité vlastnosti — bezbariérový prístup, šírka dverí, sprcha na úrovni podlahy, výťah —, vyjasnite si ich pred rezerváciou s poskytovateľom cez funkciu správ. Nesprávne údaje o prístupnosti sú porušením našich pravidiel a možno ich nahlásiť.",
      ],
    },
    {
      id: "melden",
      heading: "4. Nahlásenie bariéry",
      paragraphs: [
        `Ak narazíte na bariéru, nahláste nám ju na ${ANBIETER.email} alebo cez kontaktné cesty uvedené v časti [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Opíšte prosím, ktorej stránky sa to týka, čo ste chceli urobiť a aké pomôcky používate. Prijatie potvrdíme a oznámime Vám, ako a dokedy bariéru odstránime.",
        "Ak potrebujete informáciu v prístupnej podobe, poskytneme Vám ju na požiadanie.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Vymáhacie konanie",
      paragraphs: [
        "Ak nie ste s našou odpoveďou spokojní, môžete sa obrátiť na orgán príslušný pre dohľad nad trhom podľa smernice (EÚ) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (predtým Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dánsko",
        "Telefón: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
