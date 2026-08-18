import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Protidiskriminacijska politika",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays je odprt vsem. Kdor prek Platforme rezervira ali ponuja, nikogar ne sme obravnavati slabše zaradi osebnih značilnosti.",
    "Ta politika je sestavni del [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen) in velja za goste in za ponudnike.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Na myBestDays je nedopustno osebo postavljati v slabši položaj zaradi njenega porekla, barve kože, državljanstva, etnične pripadnosti, vere ali prepričanja, spola, spolne identitete, spolne usmerjenosti, invalidnosti, starosti ali zakonskega stanu.",
        "To velja za sprejem ali zavrnitev rezervacij, za cene in pogoje, za ravnanje med bivanjem in za komunikacijo prek Platforme.",
        "Dodatno velja člen 20 Uredbe (EU) 2018/302: ponudniki ne smejo omejevati dostopa do svoje ponudbe zaradi državljanstva, prebivališča ali kraja sedeža gosta znotraj Unije.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Kaj to pomeni za ponudnike",
      paragraphs: ["Kot ponudnik zlasti ne smete:"],
      list: [
        "zavrniti rezervacijskega povpraševanja zaradi ene od navedenih značilnosti;",
        "od gostov zahtevati drugačnih cen, varščin ali pogojev zato, ker izpolnjujejo eno od značilnosti;",
        "v oglasu ali v sporočilih izjaviti, da določene skupine oseb niso zaželene;",
        "zavrniti službenih ali vodniških psov, tudi če vaš hišni red izključuje živali;",
        "gosta obravnavati drugače zaradi njegovega prebivališča v drugi državi članici Unije.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Kaj ostaja dopustno",
      paragraphs: [
        "Določite lahko najvišjo zasedenost, najnižjo starost glavnega rezervatorja in stvarna hišna pravila (na primer prepoved kajenja ali čas počitka), dokler veljajo enako za vse goste.",
        "Če v nastanitvi stanujete tudi sami in si z gostom delite bivalni prostor, lahko to jasno navedete v oglasu; značilnosti iz razdelka 1 kljub temu ne upravičujejo zavrnitve.",
        "Rezervacijo lahko zavrnete, kadar obstajajo konkretni znaki kršitve hišnega reda ali goljufije. Razlog se mora nanašati na ravnanje, ne na osebo.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Dostopnost",
      paragraphs: [
        "Podatki o dostopnosti nastanitve morajo biti resnični. Nastanitev, ki ni dostopna, opisati kot dostopno, je hkrati kršitev [Pravil o primerni vsebini](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Kadar je prilagoditev mogoča brez nesorazmernega napora, pričakujemo, da jo ponudniki izvedejo.",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava diskriminacije",
      paragraphs: [
        "Če ste doživeli ali opazili diskriminacijo, nam to prijavite prek funkcije prijave ali prek kontaktnih poti v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
        "Vsako prijavo preučimo. Če se kršitev potrdi, sprejmemo ukrepe do trajne blokade računa. Če vam je bila zaradi tega rezervacija odpovedana, vam pomagamo najti primerljivo nastanitev.",
      ],
    },
  ],
};
