import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiskriminačné zásady",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays je otvorený všetkým. Kto cez Platformu rezervuje alebo ponúka, nesmie nikoho znevýhodňovať pre osobné znaky.",
    "Tieto zásady sú súčasťou [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen) a platia pre hostí aj pre poskytovateľov.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Na myBestDays je neprípustné znevýhodňovať osobu pre jej pôvod, farbu pleti, štátnu príslušnosť, etnickú príslušnosť, náboženstvo alebo presvedčenie, pohlavie, rodovú identitu, sexuálnu orientáciu, zdravotné postihnutie, vek alebo rodinný stav.",
        "Platí to pre prijatie alebo odmietnutie rezervácií, pre ceny a podmienky, pre zaobchádzanie počas pobytu a pre komunikáciu cez Platformu.",
        "Dodatočne platí článok 20 nariadenia (EÚ) 2018/302: poskytovatelia nesmú obmedzovať prístup k svojej ponuke z dôvodu štátnej príslušnosti, bydliska alebo miesta usadenia hosťa v rámci Únie.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Čo to znamená pre poskytovateľov",
      paragraphs: ["Ako poskytovateľ najmä nesmiete:"],
      list: [
        "odmietnuť žiadosť o rezerváciu pre niektorý z uvedených znakov;",
        "požadovať od hostí odlišné ceny, zábezpeky alebo podmienky preto, že spĺňajú niektorý zo znakov;",
        "v inzeráte alebo v správach vyhlásiť, že určité skupiny osôb sú nežiaduce;",
        "odmietnuť asistenčné alebo vodiace psy, aj keď Váš domový poriadok zvieratá vylučuje;",
        "zaobchádzať s hosťom odlišne pre jeho bydlisko v inom členskom štáte Únie.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Čo zostáva prípustné",
      paragraphs: [
        "Môžete stanoviť maximálnu obsadenosť, minimálny vek hlavného rezervujúceho a vecné pravidlá domu (napríklad zákaz fajčenia alebo nočný pokoj), pokiaľ platia rovnako pre všetkých hostí.",
        "Ak v ubytovaní bývate aj Vy a delíte sa s hosťom o obytný priestor, môžete to v inzeráte jasne uviesť; znaky z oddielu 1 však odmietnutie neospravedlňujú.",
        "Rezerváciu môžete odmietnuť, ak existujú konkrétne indície porušenia domového poriadku alebo podvodu. Dôvod sa musí vzťahovať na správanie, nie na osobu.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Prístupnosť",
      paragraphs: [
        "Údaje o prístupnosti ubytovania musia zodpovedať skutočnosti. Opísať ako bezbariérové ubytovanie, ktoré také nie je, je zároveň porušením [Pravidiel pre vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Ak je úprava možná bez neprimeraného úsilia, očakávame, že ju poskytovatelia vykonajú.",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásenie diskriminácie",
      paragraphs: [
        "Ak ste zažili alebo pozorovali diskrimináciu, nahláste nám to cez funkciu nahlásenia alebo cez kontaktné cesty uvedené v časti [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
        "Každé hlásenie preskúmame. Ak sa porušenie potvrdí, prijmeme opatrenia až po trvalé zablokovanie účtu. Ak Vám bola z tohto dôvodu rezervácia zrušená, pomôžeme Vám nájsť porovnateľné ubytovanie.",
      ],
    },
  ],
};
