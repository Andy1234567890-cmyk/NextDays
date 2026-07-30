import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Mokėjimai",
  description: "Teisingai tvarkyti mokėjimus.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Mokėjimai",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Avanso nustatymas",
          excerpt: "Kaip rezervacijos metu prašyti tik dalies sumos, o ne visos sumos.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Vietoj to, kad iš karto nurašytumėte visą rezervacijos sumą, galite nustatyti avansą kaip mokėjimo taisyklę. Svečias rezervuodamas per Stripe ar PayPal sumoka tik dalį sumos, likusią dalį — vėliau per likutinį mokėjimą.",
            },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skyrių „Mokėjimo taisyklės“.",
                "Sukurkite naują „Avanso“ tipo taisyklę.",
                "Nustatykite avanso sumą kaip procentinį dydį arba fiksuotą bendros sumos dalį.",
                "Nustatykite, kada avansas turi būti sumokėtas, paprastai iš karto rezervuojant.",
                "Išsaugokite taisyklę ir patikrinkite ją su bandomąja rezervacija.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Avansas tvarkomas per objektui priskirtą mokėjimo paslaugų teikėją. Atitinkamą likutinės sumos nustatymą atliekate skyriuje [Likutinio mokėjimo automatizavimas](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Likutinio mokėjimo automatizavimas",
          excerpt: "Kaip likusi neapmokėta suma automatiškai nurašoma prieš atvykimą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Sumokėjus avansą lieka neapmokėta likutinė suma. Vietoj to, kad ją sektumėte rankiniu būdu, nustatote mokėjimo taisyklę, kuri likutinį mokėjimą automatiškai nuraso fiksuotu metu prieš atvykimą per Stripe ar PayPal.",
            },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skyrių „Mokėjimo taisyklės“.",
                "Sukurkite naują „Likutinio mokėjimo“ tipo taisyklę, jei jau yra avanso taisyklė.",
                "Nustatykite, kiek dienų prieš atvykimą turi būti sumokėtas likutis.",
                "Aktyvuokite automatinį nurašymą, kad nurodytas mokėjimo paslaugų teikėjas sumą nurašytų savarankiškai.",
                "Po to patikrinkite likutinio mokėjimo būseną atitinkamos rezervacijos laiko juostoje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jei automatinis nurašymas nepavyksta, pavyzdžiui, dėl pasibaigusios kortelės galiojimo, rezervacija automatiškai neatšaukiama. Nepavykusius likutinius mokėjimus patikrinkite greitai ir susisiekite su svečiu tiesiogiai.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Grąžinimo atlikimas",
          excerpt: "Kaip visiškai ar dalinai grąžinti svečiui sumą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Atšaukimo ar skundo atveju svečiui galite visiškai ar dalinai grąžinti sumokėtą sumą. Grąžinimas vyksta per tą patį mokėjimo paslaugų teikėją, per kurį iš pradžių buvo mokama — Stripe ar PayPal.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamą rezervaciją rezervacijos laiko juostoje.",
                "Skyriuje „Mokėjimai“ pasirinkite pradinį mokėjimą, kurį reikia grąžinti.",
                "Pasirinkite tarp visiško arba dalinio grąžinimo.",
                "Dalinio grąžinimo atveju įveskite norimą sumą.",
                "Patvirtinkite grąžinimą ir patikrinkite atnaujintą mokėjimo būseną laiko juostoje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Grąžinimas automatiškai nekeičia rezervacijos būsenos ar užimtų kalendoriaus naktų. Atšaukimo atveju papildomai patikrinkite, ar atitinkamas naktis reikia vėl atlaisvinti užimtumo plane.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Užstato tvarkymas",
          excerpt: "Kaip nustatyti užstatą ir po buvimo jį atlaisvinti.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Užstatas apsaugo jus nuo žalos, atsiradusios buvimo metu. Jis nurodomas kaip atskira mokėjimo taisyklė ir per Stripe ar PayPal iš anksto autorizuojamas arba nurašomas, priklausomai nuo objekto nustatymų.",
            },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skyrių „Mokėjimo taisyklės“ ir sukurkite „Užstato“ tipo taisyklę.",
                "Nustatykite užstato sumą ir autorizavimo laiką, paprastai trumpai prieš atvykimą.",
                "Po išsiregistravimo patikrinkite objekto būklę.",
                "Jei būklė nepriekaištinga, per rezervaciją visiškai atlaisvinkite užstatą.",
                "Žalos atveju grąžinkite tik nereikalingą dalį ir dokumentuokite sulaikymo priežastį.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autorizuotas, bet nenurašytas užstatas, priklausomai nuo mokėjimo paslaugų teikėjo, po tam tikro laiko automatiškai nustoja galioti. Užstatą atlaisvinkite greitai po išsiregistravimo arba laiku nurašykite reikiamą sumą.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Sąskaitos taisymas",
          excerpt: "Kaip vėliau pataisyti jau išrašytą sąskaitą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Jei jau išrašytoje sąskaitoje yra klaida, pavyzdžiui, sąskaitos adrese ar eilutėje, ją taisote per rezervaciją, o ne tiesiog ištrindami pradinę sąskaitą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamą rezervaciją rezervacijos laiko juostoje ir pereikite į skyrių „Sąskaitos“.",
                "Pasirinkite klaidingą sąskaitą.",
                "Sukurkite pradinės sąskaitos koregavimo arba anuliavimo sąskaitą.",
                "Po to sukurkite naują, pataisytą sąskaitą su teisingais duomenimis.",
                "Pataisytą sąskaitą iš naujo išsiųskite svečiui ar sąskaitos adresu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jau išsiųsta sąskaita atsekamumo sumetimais neturėtų būti tiesiogiai perrašoma. Taisymas per anuliavimo sąskaitą išsaugo pradinį dokumentą ir padaro pakeitimą atsekamą.",
            },
          ],
        },
      ],
    },
  ],
};
