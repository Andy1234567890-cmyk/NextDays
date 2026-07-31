import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (prekyvietė)",
  description: "Parduoti myBestDays prekyvietėje.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Prekyvietė",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myBestDays prekyvietė",
          excerpt: "Visuotinė myBestDays prekyvietė yra atskiras rezervacijų kanalas šalia portalų ir svetainės.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myBestDays prekyvietė (/plattform) yra paties myBestDays visuotinis rezervacijų kanalas — panašus į Booking ar Airbnb, tačiau priklausantis tai pačiai platformai. Ten svečiai naršo visų prijungtų įmonių objektus ir rezervuoja tiesiogiai.",
            },
            { type: "h2", text: "Ne „tiesioginis kanalas“, o lygiavertis kanalas" },
            {
              type: "p",
              text: "Prekyvietė nepakeičia tiesioginės rezervacijos per jūsų nuosavą svetainę. Tai savarankiškas, trečiasis pardavimo kelias su sava matomumo ašimi, savu svečių ratu ir savu komisiniu mokesčiu — lygiai kaip portalas, tik jį valdo pats myBestDays.",
            },
            { type: "h2", text: "Kaip objektai atsiranda prekyvietėje" },
            {
              type: "ul",
              items: [
                "Objektas turi būti aktyvus (objekto būsena leidžia pardavimą).",
                "Turi būti įjungtas prekyvietės matomumas — atskirai nuo portalų ir svetainės.",
                "Norimam laikotarpiui kalendoriuje turi būti prieinamumas.",
              ],
            },
            { type: "h2", text: "Rezervacijos iš prekyvietės" },
            {
              type: "p",
              text: "Prekyvietės rezervacija iš karto blokuoja atitinkamas naktis visuose kituose kanaluose — lygiai taip pat kaip portalo ar svetainės rezervacija. Ji pasirodo jūsų kalendoriuje ir rezervacijose kaip bet kuri kita rezervacija, pažymėta kanalu „Platforma“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pardavimo stabdymas ir neaktyvi objekto būsena veikia visuose kanaluose ir blokuoja taip pat prekyvietę — nepriklausomai nuo prekyvietės matomumo jungiklio.",
            },
            {
              type: "p",
              text: "Kaip aktyvuoti objektą prekyvietėje, skaitykite skyriuje [Objekto įtraukimas į prekyvietę](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Objekto įtraukimas į prekyvietę",
          excerpt: "Prekyvietės matomumas yra atskiras jungiklis, nesusijęs su portalais ir svetaine.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Matomumą prekyvietėje valdote per atskirą objekto jungiklį — nepriklausomai nuo to, ar tas pats objektas matomas ir portaluose, ar jūsų svetainėje.",
            },
            { type: "h2", text: "Kaip įtraukti objektą" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje Objektai.",
                "Pereikite į skirtuką Matomumas.",
                "Aktyvuokite jungiklį Platformos prekyvietė.",
                "Patikrinkite, ar objekto būsena aktyvi ir yra kalendoriaus prieinamumas.",
              ],
            },
            { type: "h2", text: "Sąlyga: išsamus profilis" },
            {
              type: "p",
              text: "Prekyvietė rodo tik objektus su išsamiais duomenimis — turi būti nurodyta titulinė nuotrauka, aprašymas, patogumai ir bazinė kaina. Jei trūksta privalomų duomenų, objektas liks nematomas net ir aktyvavus jungiklį.",
            },
            {
              type: "ul",
              items: [
                "Bent viena titulinė nuotrauka ir aprašymas",
                "Patogumų požymiai iš kategorijų sąrašo",
                "Talpa ir bazinė kaina nurodyta objekto valiuta",
                "Kalendoriaus prieinamumas norimam laikotarpiui",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Spustelėjus Publikuoti, myNextDays paprastai kartu aktyvuoja prekyvietę, portalus ir svetainę — prekyvietės jungiklį po to bet kada galite atskirai vėl išjungti.",
            },
            { type: "h2", text: "Matomumo pašalinimas" },
            {
              type: "p",
              text: "Išjungus jungiklį Platformos prekyvietė, objektas dingsta iš prekyvietės paieškos. Jau patvirtintoms rezervacijoms tai įtakos neturi ir jos vyksta kaip įprasta, žr. [Prekyvietės komisinis mokestis](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Prekyvietės komisinis mokestis",
          excerpt: "Už kiekvieną per prekyvietę tarpininkaujamą rezervaciją taikomas tarife nurodytas komisinis mokestis.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kaip ir bet kuriame rezervacijų portale, už per myBestDays prekyvietę įvykusias rezervacijas taikomas komisinis mokestis. Jis apskaičiuojamas kiekvienai rezervacijai ir nepriklauso nuo galimų portalų komisinių mokesčių.",
            },
            { type: "h2", text: "Kaip apskaičiuojamas komisinis mokestis" },
            {
              type: "p",
              text: "Dydis priklauso nuo jūsų įmonės tarife nurodyto komisinio mokesčio. Aktualų tarifą bet kada rasite paskyroje, skyriuje Atsiskaitymas — ten nerodoma bendra reikšmė, o rodomas jūsų tarifui tikrai galiojantis dydis.",
            },
            { type: "h2", text: "Kur peržiūrėti komisinį mokestį" },
            {
              type: "steps",
              items: [
                "Meniu atidarykite Paskyra.",
                "Pereikite į skyrių Atsiskaitymas.",
                "Atidarykite prekyvietės rezervaciją, norėdami išsamiai pamatyti apyvartą ir komisinį mokestį.",
                "Patikrinkite komisinių mokesčių apžvalgą einamajam atsiskaitymo laikotarpiui.",
              ],
            },
            { type: "h2", text: "Skirtumas nuo portalų komisinių mokesčių" },
            {
              type: "ul",
              items: [
                "Prekyvietės komisinis mokestis galioja išimtinai rezervacijoms per myBestDays prekyvietę.",
                "Portalo rezervacijoms (Booking, Airbnb ir kt.) galioja atitinkamo portalo sąlygos.",
                "Svetainės rezervacijoms galioja jūsų tarife nurodytos sąlygos be prekyvietės komisinio mokesčio.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Komisinis mokestis automatiškai nustatomas iš jūsų tarifo. Jei tarifo nėra arba jis neaiškus, rodomas aiškus klaidos pranešimas, o ne spėjama reikšmė.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Svečio profilis ir vertinimai",
          excerpt: "Prekyvietės svečiai turi profilį su rezervacijų istorija ir gali palikti vertinimus.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Svečiai, kurie rezervuoja per myBestDays prekyvietę, susikuria savo svečio profilį. Jame kaupiasi jų rezervacijos, žinutės su įmonėmis ir palikti vertinimai — panašiai kaip portalo svečio paskyroje.",
            },
            { type: "h2", text: "Ką matote kaip įmonė" },
            {
              type: "p",
              text: "Prekyvietės rezervacijos duomenyse rasite svečio profilį su ankstesniais apsilankymais jūsų įmonėje ir, jei svečias tai leido, viešai matomais vertinimais apie kitas apgyvendinimo vietas.",
            },
            { type: "h2", text: "Vertinimai po buvimo" },
            {
              type: "steps",
              items: [
                "Po išsiregistravimo svečias gauna kvietimą palikti vertinimą.",
                "Po trumpo patikrinimo vertinimas pasirodo objekto puslapyje prekyvietėje.",
                "Jūs, kaip įmonė, galite viešai atsakyti į kiekvieną vertinimą.",
                "Neobjektyvius ar netinkamus vertinimus galite pateikti patikrinti per funkciją Pranešti.",
              ],
            },
            {
              type: "ul",
              items: [
                "Vertinimai susieti su faktine rezervacija — be buvimo vertinimo nėra.",
                "Svečias vertina švarą, bendravimą, vietą ir kainos bei kokybės santykį.",
                "Jūsų atsakymas matomas visiems prekyvietės lankytojams.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Geri vertinimai tiesiogiai veikia jūsų objekto poziciją prekyvietės paieškoje — į kritiką reaguokite greitai ir dalykiškai.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokuoti asmenys",
          excerpt: "Įmonė gali blokuoti svečią, todėl žinutės ir rezervacijos tampa neįmanomos.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Jei su svečiu kyla problemų, galite jį, kaip įmonė, blokuoti. Blokuotas asmuo nebegali jums siųsti žinučių ir nebegali sukurti naujos rezervacijos jūsų įmonėje.",
            },
            { type: "h2", text: "Asmens blokavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite žinučių istoriją arba rezervaciją su atitinkamu svečiu.",
                "Spustelėkite Blokuoti svečią.",
                "Patvirtinkite dialogo langą — blokavimas galioja iš karto.",
                "Blokuotas asmuo po to pasirodo Paskyroje, skiltyje Blokuoti asmenys.",
              ],
            },
            { type: "h2", text: "Ką lemia blokavimas" },
            {
              type: "ul",
              items: [
                "Svečias nebegali siųsti jūsų įmonei naujų žinučių.",
                "Svečias nebegali sukurti naujos rezervacijos jūsų įmonėje.",
                "Vykdomai rezervacijai su jau patvirtintu atvykimu per artimiausias dvi savaites blokavimas netaikomas, kad buvimas galėtų būti tvarkingai užbaigtas.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokavimas galioja išimtinai jūsų įmonei. Kitos prekyvietės įmonės blokavimo nemato ir jis joms įtakos neturi.",
            },
            { type: "h2", text: "Blokavimo panaikinimas" },
            {
              type: "p",
              text: "Atidarykite Paskyrą ir joje skiltį Blokuoti asmenys. Pasirinkite įrašą ir spustelėkite Panaikinti blokavimą — po to svečias vėl galės siųsti žinutes ir rezervuoti.",
            },
          ],
        },
      ],
    },
  ],
};
