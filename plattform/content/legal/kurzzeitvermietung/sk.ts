import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Krátkodobý prenájom a registračné povinnosti",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "V mnohých mestách a regiónoch podlieha krátkodobý prenájom bývania povoleniu, registrácii alebo ohláseniu. Táto stránka vysvetľuje, čo to znamená pre poskytovateľov a pre hostí.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Právny rámec",
      paragraphs: [
        "Nariadenie (EÚ) 2024/1028 o zbere a výmene údajov týkajúcich sa služieb krátkodobého prenájmu ubytovania vytvára jednotný rámec: kde členský štát alebo územný celok zaviedol registračný postup, každá jednotka dostane registračné číslo.",
        "Platformy musia toto číslo zobrazovať, výberovo overovať jeho platnosť a v pravidelných intervaloch odovzdávať príslušným orgánom údaje o činnosti.",
        "Popri tom naďalej platia vnútroštátne a miestne predpisy — napríklad o zmene účelu bývania, o maximálnom počte dní prenájmu, o protipožiarnej ochrane a o prihlasovaní hostí.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Čo musia urobiť poskytovatelia",
      paragraphs: [
        "Pred zverejnením skontrolujte, či sa na Vaše ubytovanie vzťahuje registračná, povoľovacia alebo ohlasovacia povinnosť, a splňte ju.",
        "Zadajte registračné číslo pri objekte, ak existuje. Zobrazíme ho v inzeráte.",
        "Dodržiavajte maximálny počet dní prenájmu a ostatné miestne limity. Ich sledovanie je Vašou úlohou, nie našou.",
        "Inzerát bez potrebného registračného čísla nesmieme trvalo zobrazovať. Ak chýba alebo sa ukáže ako neplatný, dodatočne ho vyžiadame; ak údaj nepríde, inzerát deaktivujeme.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Čo to znamená pre hostí",
      paragraphs: [
        "Ak sa na ubytovanie vzťahuje registračná povinnosť, uvidíte registračné číslo v inzeráte. Je to indícia, že prenájom bol ohlásený príslušnému orgánu.",
        "V cieľovom mieste môže byť potrebné prihlásenie (prihlasovací lístok, údaje z dokladu totožnosti, vyhlásenie o kúpeľnom poplatku). Poskytovateľ si potrebné údaje vyžiada; poskytnite ich včas.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Odovzdávanie údajov orgánom",
      paragraphs: [
        "Pokiaľ to nariadenie (EÚ) 2024/1028 alebo vnútroštátne právo predpokladá, odovzdávame príslušným orgánom údaje o prenájmovej činnosti — najmä registračné číslo, adresu jednotky, počet obsadených nocí a počet hostí.",
        "Toto odovzdanie sa uskutočňuje na splnenie právnej povinnosti podľa článku 6 ods. 1 písm. c) nariadenia (EÚ) 2016/679. Podrobnosti uvádzajú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz).",
        "Oddelene od toho existuje daňová ohlasovacia povinnosť podľa DAC7; pozri [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásenie porušení",
      paragraphs: [
        "Ak máte indície, že sa ubytovanie ponúka bez potrebného povolenia alebo registrácie, nahláste nám to cez funkciu nahlásenia pri inzeráte. Každému hláseniu sa venujeme.",
      ],
    },
  ],
};
