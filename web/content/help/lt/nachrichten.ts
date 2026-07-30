import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Žinutės ir svečiai",
  description: "Gautieji laiškai, šablonai ir bendravimas su svečiais.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Bendravimas",
      articles: [
        {
          slug: "posteingang",
          title: "Platformos gautieji laiškai",
          excerpt: "Visos jūsų objektų svečių žinutės susirenka centralizuotai platformos gautuosiuose laiškuose.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Vieni gautieji laiškai visiems objektams" },
            {
              type: "p",
              text: "Platformos gautieji laiškai sujungia visas jūsų svečių žinutes vienoje vietoje — nepriklausomai nuo to, per kurį objektą ar laikotarpį vyksta pokalbis. Juos atidarote skiltyje /nachrichten ir ten kiekvieną pokalbį matote kaip atskirą giją.",
            },
            { type: "h2", text: "Gautųjų laiškų struktūra" },
            {
              type: "ul",
              items: [
                "Kairysis stulpelis: visų pokalbių sąrašas, naujausi viršuje",
                "Vidurinis stulpelis: aktyvi žinučių istorija su svečiu",
                "Dešinysis stulpelis: rezervacijos kontekstas — laikotarpis, objektas, svečio duomenys",
              ],
            },
            { type: "h2", text: "Atsakymas į žinutę" },
            {
              type: "steps",
              items: [
                "Atidarykite /nachrichten ir pasirinkite norimą pokalbį",
                "Įrašykite atsakymą teksto lauke arba naudokite greitąjį atsakymą",
                "Išsiųskite žinutę — svečias ją gaus tuo pačiu būdu, kuriuo rašė",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Platformos gautieji laiškai rodo išimtinai tiesioginį bendravimą tarp jūsų ir jūsų svečių myNextDays sistemoje — žinutes iš portalų toliau tvarkote juose.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Greitieji atsakymai",
          excerpt: "Dažnų klausimų šablonai taupo laiką bendraujant su svečiais.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kas yra greitieji atsakymai" },
            {
              type: "p",
              text: "Greitieji atsakymai yra iš anksto suformuluoti teksto blokai pasikartojantiems klausimams — pavyzdžiui, apie atvykimą, „Wi-Fi“ slaptažodį ar automobilių stovėjimo situaciją. Vietoj to, kad kiekvieną atsakymą rašytumėte iš naujo, tinkamą šabloną vienu paspaudimu įterpiate į [Platformos gautuosius laiškus](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Greitojo atsakymo sukūrimas" },
            {
              type: "steps",
              items: [
                "Atidarykite /nachrichten ir spustelėkite „Tvarkyti greituosius atsakymus“",
                "Spustelėkite „Naujas šablonas“ ir suteikite pavadinimą, pavyzdžiui, „Įsiregistravimo informacija“",
                "Įrašykite atsakymo tekstą; tokie kintamieji kaip svečio vardas ar atvykimo data siunčiant įrašomi automatiškai",
                "Išsaugokite šabloną — nuo šiol jis prieinamas kiekviename pokalbyje",
              ],
            },
            { type: "h2", text: "Greitųjų atsakymų naudojimas kasdien" },
            {
              type: "p",
              text: "Žinučių lange šablonų sąrašą atidarote per žaibo simbolį, pasirenkate tinkamą atsakymą ir prireikus jį individualiai pakoreguojate prieš siųsdami.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sukurkite šablonus penkiems–dešimčiai dažniausių klausimų — praktikoje tai padengia didžiąją dalį gaunamų žinučių.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatinės žinutės",
          excerpt: "Patvirtinimus, įsiregistravimo informaciją ir priminimus galima automatiškai siųsti svečiams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Pasikartojančių žinučių automatizavimas" },
            {
              type: "p",
              text: "Vietoj to, kad rezervacijos patvirtinimus, įsiregistravimo nurodymus ar padėkos žinutes siųstumėte rankiniu būdu, vieną kartą nurodote juos kaip taisyklę — myNextDays jas tada automatiškai išsiunčia tinkamu metu prieš, per arba po buvimo.",
            },
            { type: "h2", text: "Tipiniai automatinių žinučių sukėlėjai" },
            {
              type: "ul",
              items: [
                "Iš karto po rezervacijos — patvirtinimas su svarbiausiais duomenimis",
                "Kelias dienas prieš atvykimą — įsiregistravimo informacija ir prieigos kodas",
                "Išvykimo dieną — padėka ir prašymas palikti vertinimą",
              ],
            },
            { type: "h2", text: "Automatinės žinutės nustatymas" },
            {
              type: "steps",
              items: [
                "Atidarykite /nachrichten, skyrių „Automatinės žinutės“",
                "Pasirinkite sukėlėją, pavyzdžiui, „X dienos prieš atvykimą“",
                "Įveskite tekstą — tokie kintamieji kaip svečio vardas, objektas ar atvykimo data užpildomi automatiškai",
                "Aktyvuokite taisyklę; ji galioja visiems objektams, jei neapribota kitaip",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatinės žinutės pasirodo visiškai normaliai [Platformos gautuosiuose laiškuose](/hilfe/nachrichten/posteingang) ir jas ten bet kada galima vėliau peržiūrėti.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Žinučių blokavimas",
          excerpt: "Asmenį galite tiesiogiai iš žinučių istorijos blokuoti tolesniam kontaktavimui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kada blokavimas yra prasmingas" },
            {
              type: "p",
              text: "Gavus įžeidžiančių žinučių, patiriant priekabiavimą ar pakartotinai netinkamą elgesį, asmenį galite blokuoti tiesiogiai iš žinučių gijos. Blokuotas asmuo po to nebegali jums rašyti naujų žinučių ir nebegali sukurti naujos rezervacijos pas jus.",
            },
            { type: "h2", text: "Asmens blokavimas iš gijos" },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamą pokalbį [Platformos gautuosiuose laiškuose](/hilfe/nachrichten/posteingang)",
                "Gijos viršuje spustelėkite meniu ir pasirinkite „Blokuoti asmenį“",
                "Patvirtinkite veiksmą — blokavimas galioja iš karto",
              ],
            },
            { type: "h2", text: "Ką reiškia blokavimas — ir ko ne" },
            {
              type: "ul",
              items: [
                "Naujos blokuoto asmens žinutės nebepristatomos",
                "Naujos asmens rezervacijos užklausos atmetamos",
                "Jei šiuo metu vykdoma šio asmens rezervacija, bendravimas išimties tvarka lieka galimas per visą buvimo laiką",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokavimą bet kada galima panaikinti Paskyros apžvalgoje „Blokuoti asmenys“. Prieš blokuodami patikrinkite, ar jau nėra vykdomos rezervacijos.",
            },
          ],
        },
      ],
    },
  ],
};
