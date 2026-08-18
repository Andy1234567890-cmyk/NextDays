import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady pre žiadosti orgánov a orgánov činných v trestnom konaní",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto zásady sú určené orgánom, súdom a orgánom činným v trestnom konaní, ktoré od myBestDays požadujú údaje alebo smerujú príkaz proti obsahu. Zverejňujeme ich tu, aby si aj používatelia mohli prečítať, za akých podmienok údaje vydávame.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Údaje používateľov vydávame len vtedy, ak existuje platný právny základ a žiadosť spĺňa formálne požiadavky. Neformálna žiadosť o údaje nestačí.",
        "Každú žiadosť posudzujeme z hľadiska príslušnosti, právneho základu, určitosti a primeranosti a vydávame len údaje, ktoré žiadosť označuje.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Náležitosti žiadosti",
      paragraphs: ["Žiadosť by mala obsahovať:"],
      list: [
        "žiadajúci orgán, spisovú značku a kontaktné údaje vybavujúcej osoby na úradnom hlavičkovom papieri;",
        "právny základ podľa vnútroštátneho práva alebo práva Únie;",
        "presné označenie dotknutej osoby alebo dotknutého účtu — e-mailovú adresu, číslo rezervácie alebo URL inzerátu;",
        "presne označené údaje a obdobie;",
        "prípadne súdny príkaz, pokiaľ ho rozhodné právo vyžaduje;",
        "upozornenie, ak by informovanie dotknutej osoby ohrozilo vyšetrovanie, s uvedením právneho základu.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Príkazy podľa nariadenia (EÚ) 2022/2065",
      paragraphs: [
        "Príkazy na konanie proti protiprávnemu obsahu (článok 9) a príkazy na poskytnutie informácií (článok 10) musia obsahovať tam uvedené údaje, najmä právny základ, presné elektronické umiestnenie, odôvodnenie, opravné prostriedky a jazyk.",
        "Prijatie potvrdíme a orgánu, ktorý príkaz vydal, oznámime, aké opatrenia sme prijali a kedy.",
        "O príkaze informujeme dotknutú osobu najneskôr v čase jeho vykonania, pokiaľ orgán s uvedením právneho základu nenariadi odklad.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Naliehavé prípady",
      paragraphs: [
        "Ak hrozí bezprostredné nebezpečenstvo pre život alebo telesnú integritu, vydáme údaje potrebné na jeho odvrátenie aj bez predchádzajúceho formálneho príkazu. Takúto žiadosť výslovne označte ako naliehavú a nebezpečenstvo opíšte.",
        "Ak existujú indície trestného činu ohrozujúceho život alebo bezpečnosť osoby, informujeme príslušné orgány z vlastného podnetu (článok 18 nariadenia (EÚ) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Ktoré údaje uchovávame",
      paragraphs: [
        "Ktoré kategórie údajov spracúvame a ako dlho ich uchovávame, uvádzajú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz). Nad tam uvedené lehoty žiadne údaje neuchovávame.",
        "Uchovávanie údajov nad rámec potreby sa nevykonáva. Výzvu na dočasné zabezpečenie údajov pre prebiehajúce konanie splníme v právne prípustnom rozsahu.",
        "Úplné platobné údaje nemáme k dispozícii; treba ich vyžiadať od poskytovateľa platobných služieb.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informovanie dotknutej osoby",
      paragraphs: [
        "Dotknutých používateľov o žiadosti týkajúcej sa ich údajov informujeme, ibaže to zakazuje právny predpis alebo odôvodnený príkaz orgánu alebo hrozí bezprostredné nebezpečenstvo pre život či telesnú integritu.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kam smerovať žiadosti",
      paragraphs: [
        "Žiadosti smerujte na jednotné kontaktné miesto pre orgány uvedené v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa). Vybavujeme ich v nemčine a angličtine.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparentnosť",
      paragraphs: [
        "Počet a druh príkazov orgánov uvádzame vo svojej výročnej správe o transparentnosti; pozri [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
