import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady pri závažných narušeniach",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Niekedy cestu alebo pobyt znemožní udalosť, za ktorú nemôže ani hosť, ani poskytovateľ. Tieto zásady opisujú, ktoré udalosti to sú a čo potom platí.",
    "Majú prednosť pred storno podmienkou zvolenou v inzeráte.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Ktoré udalosti sú zahrnuté",
      paragraphs: [
        "Zahrnuté sú udalosti, ktoré nastanú po rezervácii, boli pre obe strany nepredvídateľné a robia cestu alebo pobyt nemožným či právne neprípustným:",
      ],
      list: [
        "úradné zákazy cestovania alebo pobytu, zákazy vychádzania a uzavretia hraníc týkajúce sa cieľového miesta alebo miesta pôvodu;",
        "prírodné katastrofy a prírodné javy postihujúce cieľové miesto — zemetrasenie, povodeň, búrka, veľký požiar, sopečná erupcia;",
        "vojna, ozbrojené konflikty, teroristické útoky a nepokoje v cieľovom mieste;",
        "úradne zistená epidémia alebo pandémia s opatreniami zakazujúcimi pobyt;",
        "výpadok dodávky elektriny, vody alebo tepla v cieľovom mieste na dlhšie obdobie;",
        "úplná nemožnosť dostať sa do cieľového miesta v dôsledku niektorej z uvedených udalostí.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Ktoré udalosti nie sú zahrnuté",
      paragraphs: ["Zahrnuté nie sú najmä:"],
      list: [
        "choroba alebo zranenie hosťa či jeho príbuzných — na to slúži cestovné poistenie;",
        "pracovná zaneprázdnenosť, termíny skúšok alebo zrušenie dovolenky;",
        "zrušenie podujatia, kvôli ktorému bola cesta rezervovaná, pokiaľ ubytovanie zostáva použiteľné;",
        "počasie, ktoré nepredstavuje prírodnú katastrofu — dážď, chlad, horúčava, chýbajúci sneh;",
        "výpadok jednotlivých dopravných prostriedkov, pokiaľ zostáva možný primeraný príchod;",
        "zrušenie letu alebo štrajk v dopravnom podniku — na to existujú nároky voči dopravnému podniku.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Čo platí, keď nastane zahrnutá udalosť",
      paragraphs: [
        "Ak sa udalosť týka obdobia Vašej rezervácie, môžete bezplatne zrušiť. Sumu zaplatenú cez Platformu dostanete v plnom rozsahu späť.",
        "Ak už pobyt začal, vrátime podiel za noci, ktoré už nie je možné využiť.",
        "Poskytovateľovi z takéhoto zrušenia nevznikajú nevýhody pri hodnotení jeho spoľahlivosti.",
        "Alternatívne sa môžete s poskytovateľom dohodnúť na presunutí; pomôžeme s preknihovaním.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Ako sa na ne odvolať",
      paragraphs: [
        "Ozvite sa cez kontaktné cesty uvedené v časti [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden) a uveďte číslo rezervácie a udalosť.",
        "Overujeme na základe verejne dostupných zdrojov — úradných nariadení, oficiálnych varovaní, správ uznávaných spravodajských zdrojov — a rozhodujeme rýchlo.",
        "Ak situáciu ešte nemožno definitívne posúdiť, počkáme na vývoj do krátkeho času pred dňom príchodu a rozhodneme potom. Vaša rezervácia dovtedy zostáva nezmenená.",
      ],
    },
  ],
};
