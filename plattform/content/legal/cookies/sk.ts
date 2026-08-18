import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady používania súborov cookie",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto zásady vysvetľujú, ktoré súbory cookie a podobné technológie myBestDays používa, na čo, ako dlho zostávajú uložené a ako ich môžete spravovať.",
    "Dopĺňajú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Čo sú súbory cookie",
      paragraphs: [
        "Súbory cookie sú malé textové súbory, ktoré webová stránka ukladá vo Vašom prehliadači. Podobnými technológiami sú lokálne úložisko prehliadača a sledovacie pixely v e-mailoch.",
        "Súbory cookie, ktoré sú nevyhnutné na prevádzku Platformy, smieme nastaviť bez Vášho súhlasu. Pri všetkých ostatných si vyžiadame Váš súhlas (článok 5 ods. 3 smernice 2002/58/ES).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nevyhnutné súbory cookie",
      paragraphs: [
        "Tieto súbory cookie sú potrebné na prevádzku a nemožno ich odhlásiť. Aktuálne používame:",
      ],
      list: [
        "„nd_access“ — udržiava Vaše prihlásenie. Čitateľný len pre server (HttpOnly), trvanie zodpovedá platnosti relácie.",
        "„nd_refresh“ — obnovuje Vaše prihlásenie, aby ste sa nemuseli neustále prihlasovať znova. Čitateľný len pre server, trvanie 30 dní.",
        "„nd_gast_locale“ — zapamätá si Vami zvolený jazyk. Trvanie jeden rok.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkčné, štatistické a marketingové súbory cookie",
      paragraphs: [
        "myBestDays aktuálne nepoužíva súbory cookie na štatistiku, meranie dosahu ani reklamu a nevkladá reklamné siete ani analytické služby.",
        "Ak by sa to zmenilo, vopred si vyžiadame Váš súhlas cez výberový dialóg, v ktorom je odmietnutie rovnako jednoduché ako súhlas, a tieto zásady doplníme o konkrétne súbory cookie.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Vložený obsah tretích strán",
      paragraphs: [
        "Na stránkach s podrobnosťami môžu byť vložené mapy. Takýto obsah načítame až vtedy, keď ho výslovne aktivujete; až potom môžu byť údaje prenesené príslušnému poskytovateľovi.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Ako spravovať súbory cookie",
      paragraphs: [
        "Svoj súhlas môžete kedykoľvek zmeniť alebo odvolať cez nastavenia súborov cookie v pätičke.",
        "Okrem toho môžete súbory cookie vo svojom prehliadači vymazať alebo zablokovať. Ak vymažete nevyhnutné súbory cookie, budete odhlásení a Platforma bude fungovať obmedzene.",
      ],
    },
  ],
};
