import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravila o primerni vsebini",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta pravila veljajo za vso vsebino, ki jo uporabniki objavijo na myBestDays: oglase, fotografije, ocene, sporočila, podatke profila in odgovore na ocene.",
    "So sestavni del [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Kršitev lahko vodi do odstranitve vsebine in do ukrepov zoper račun.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Kaj ni dovoljeno",
      paragraphs: ["Na myBestDays je nedopustna zlasti naslednja vsebina:"],
      list: [
        "protipravna vsebina vsake vrste, zlasti pozivi h kaznivim dejanjem, teroristična vsebina in prikazi spolne zlorabe otrok;",
        "vsebina, ki spodbuja k sovraštvu ali nasilju zoper osebe ali skupine zaradi porekla, barve kože, vere, prepričanja, spola, spolne identitete, spolne usmerjenosti, invalidnosti ali starosti;",
        "žalitve, grožnje, nadlegovanje in ciljno izpostavljanje posameznih oseb;",
        "osebni podatki tretjih oseb brez njihove privolitve, zlasti imena, naslovi, telefonske številke, podatki iz osebnih dokumentov ali plačilni podatki;",
        "zavajajoči podatki o nastanitvi, njeni legi, opremi, velikosti ali razpoložljivosti;",
        "tuje fotografije, besedila ali znamke brez potrebnih pravic;",
        "oglaševanje, neželena sporočila in vsebina, ki vodi na druge rezervacijske poti izven Platforme;",
        "zlonamerna programska oprema, poskusi lažnega predstavljanja in povezave na tako vsebino;",
        "oglasi za kaj drugega kot nastanitveno storitev.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografije",
      paragraphs: [
        "Fotografije morajo prikazovati dejansko ponujeno nastanitev in biti posnete v stanju, ki ustreza današnjemu.",
        "Fotografije ne smejo prikazovati prepoznavnih oseb brez njihove privolitve. Obdelava je dopustna, kolikor ne popači vtisa o nastanitvi — osvetlitev da, retuširana sosednja zgradba ne.",
        "Videonadzor v nastanitvi je treba razkriti v oglasu. V notranjih prostorih, kjer gostje upravičeno pričakujejo zasebnost — spalnice, kopalnice —, kamere niso dopustne, tudi izklopljene ne.",
      ],
    },
    {
      id: "melden",
      heading: "3. Prijava vsebine",
      paragraphs: [
        "Če vsebino štejete za protipravno ali za kršitev teh pravil, jo lahko prijavite prek funkcije prijave pri vsakem oglasu, vsaki oceni in vsakem sporočilu.",
        "Postopek prijave po členu 16 Uredbe (EU) 2022/2065 in obravnava prijav sta opisana v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Kako uveljavljamo pravila",
      paragraphs: [
        "Vsako prijavljeno vsebino preučimo in izberemo najmilejši primeren ukrep: opozorilo, odstranitev prizadetega dela, odstranitev celotne vsebine, omejitev vidnosti, blokado funkcije ali blokado računa.",
        "Ponovljene ali hude kršitve tehtajo več. Pri očitno protipravni vsebini ali nevarnosti za osebe ukrepamo takoj.",
        "Vsak ukrep obrazložimo prizadeti osebi in napotimo na pritožbeno pot. Pritožbo obravnavajo ljudje.",
      ],
    },
  ],
};
