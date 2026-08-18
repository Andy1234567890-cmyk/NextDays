import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pogoji odpovedi",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Vsak ponudnik za svojo nastanitev izbere pogoj odpovedi. Kateri velja, je navedeno v oglasu in v vašem potrdilu rezervacije. Ta stran opisuje pogoje, ki jih ponudnikom ponujamo v izbiro.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Pregled pogojev odpovedi",
      paragraphs: [
        "Merodajen je vedno pogoj, naveden v oglasu. Roki se nanašajo na začetek dneva prihoda po krajevnem času nastanitve.",
      ],
      list: [
        "Prožen — brezplačna odpoved do 24 ur pred prihodom. Nato se zaračuna prva noč, preostale noči se povrnejo.",
        "Zmeren — brezplačna odpoved do 5 dni pred prihodom. Nato se zaračuna 50 % cene prenočitve.",
        "Strog — brezplačna odpoved do 14 dni pred prihodom, če je bila rezervacija opravljena najmanj 14 dni pred prihodom. Nato se do 7 dni pred prihodom zaračuna 50 %, potem pa polna cena.",
        "Nepovratno — brez brezplačne odpovedi. Cena je praviloma nižja; na odsotnost vračila posebej opozorimo pred rezervacijo.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Kaj se povrne v vsakem primeru",
      paragraphs: [
        "Ne glede na izbrani pogoj ob vsaki odpovedi povrnemo:",
      ],
      list: [
        "turistično takso in druge prehodne dajatve, kolikor so bile obračunane prek Platforme in prenočitev ne bo izvedena;",
        "varščino, zaračunano prek Platforme, v celoti;",
        "dodatne storitve, ki niso bile opravljene.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Odpoved s strani ponudnika",
      paragraphs: [
        "Če odpove ponudnik, v celoti prejmete nazaj znesek, plačan prek Platforme — ne glede na izbrani pogoj odpovedi.",
        "Dodatno vas podpremo pri iskanju primerljive nastanitve; glej [Politiko prerezervacije in vračila](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Ni zakonske pravice do odstopa",
      paragraphs: [
        "Pri nastanitvenih storitvah, rezerviranih za določeno obdobje, praviloma ne obstaja zakonska pravica do odstopa po členu 16(l) Direktive 2011/83/EU. Tu opisani pogoji odpovedi so zato pogodbena zaveza, ne izvedba pravice do odstopa.",
        "Kogentne zakonske pravice, zlasti jamčevalne pravice ob napakah nastanitve, niso prizadete.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Sprememba namesto odpovedi",
      paragraphs: [
        "Če želite spremeniti obdobje ali število potnikov, spremembo oddajte prek svoje rezervacije. Ponudnik mora soglašati; do tedaj prvotna rezervacija ostane.",
        "Če sprememba vodi do višje cene, razlika zapade v plačilo. Če vodi do nižje cene, razliko povrnemo, kolikor to veljavni pogoj odpovedi za odpadli del dopušča.",
      ],
    },
    {
      id: "wie",
      heading: "6. Kako odpovete",
      paragraphs: [
        "Odpovejte prek svojega računa pod »Rezervacije«. Za rok je merodajen trenutek, ko odpoved prispe k nam.",
        "Prejmete potrdilo o odpovedi z zneskom vračila. Glede izplačila glej [Plačilne pogoje](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
