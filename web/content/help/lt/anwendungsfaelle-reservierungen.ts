import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervacijos ir kalendorius",
  description: "Kontroliuoti rezervacijas ir kalendorių.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervacijos ir kalendorius",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Patikimai vengti dvigubų rezervacijų",
          excerpt: "Kaip užtikrinti, kad objektas niekada nebūtų rezervuotas du kartus.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Objektas parduodamas vienu metu per kelis kanalus — portalus, tokius kaip Booking, Airbnb ir kt., nuosavą platformą bei programėlę. Dviguba rezervacija atsiranda tada, kai prieinamumas viename kanale nesuspėja būti užblokuotas po to, kai rezervuota kitame kanale.",
            },
            {
              type: "steps",
              items: [
                "Užimtumo plane patikrinkite, ar kiekvienas objektas turi lygiai vieną eilutę su viena rezervuojama vienetu — jokio bendro kelių kambarių pajėgumo.",
                "Naujas rezervacijas kurkite išimtinai per užimtumo planą arba prijungtus kanalus, niekada rankiniu būdu neapibūdinant atskirų dienų.",
                "Po kiekvienos rezervacijos patikrinkite, ar rezervuotos naktys kalendoriuje iš karto rodomos kaip užimtos.",
                "Kilus techninėms problemoms ar atliekant priežiūrą, iš karto naudokite pardavimo stabdymą, o ne palikite dieną atvirą.",
                "Kilus neaiškumams, patikrinkite atitinkamos rezervacijos laiko juostą, kad suprastumėte laiko eigą.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Niekada nekeiskite naktų ar blokavimų rankiniu būdu už užimtumo plano ribų — tik taip užtikrinama, kad visi kanalai matytų tą pačią prieinamumo būseną ir neatsirastų spraga dvigubai rezervacijai.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Rezervacijos perkėlimas į kitą objektą",
          excerpt: "Kaip tvarkingai perkelti esamą rezervaciją į kitą objektą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Kartais svečią reikia perkelti iš vieno objekto į kitą, pavyzdžiui, dėl techninio gedimo ar svečio pageidavimu. Perkėlimo metu ankstesnės kalendoriaus naktys automatiškai atlaisvinamos ir iš naujo užimamos tiksliniame objekte.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamą rezervaciją rezervacijos laiko juostoje.",
                "Veiksmų meniu pasirinkite „Keisti objektą“ arba „Perkelti“.",
                "Pasirinkite tikslinį objektą ir patikrinkite jo prieinamumą pasirinktu laikotarpiu.",
                "Patvirtinkite perkėlimą.",
                "Po to užimtumo plane patikrinkite, ar senos naktys pradiniame objekte vėl rodomos kaip laisvos.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Senų naktų atlaisvinimą sistema atlieka automatiškai — jums nereikia pačiam rankiniu būdu atidaryti pradinio laikotarpio. Informuokite svečią apie objekto pakeitimą, ypač jei skiriasi patogumai ar prieiga.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Ilgalaikės rezervacijos sukūrimas",
          excerpt: "Kaip teisingai sukurti rezervaciją ilgesniam laikotarpiui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Ilgalaikiams svečiams — pavyzdžiui, kelioms savaitėms ar mėnesiams — rezervaciją kuriate kaip įprasta, tačiau papildomai atkreipkite dėmesį į minimalią buvimo trukmę, mokėjimo taisykles ir objekto kanalo matomumą visą laikotarpį.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite norimo objekto užimtumo planą ir pažymėkite visą laikotarpį.",
                "Sukurkite rezervaciją su svečio duomenimis bei planuojama atvykimo ir išvykimo data.",
                "Prireikus nustatykite mokėjimo taisyklę su avansu ir likutiniu mokėjimu, o ne visos sumos mokėjimą iš karto.",
                "Patikrinkite, ar jokia minimalios ar maksimalios buvimo trukmės taisyklė nesikerta su ilgu laikotarpiu.",
                "Išsaugokite rezervaciją ir patikrinkite, ar visas laikotarpis kalendoriuje teisingai rodomas kaip užimtas.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Labai ilgo buvimo atveju rekomenduojama likutinį mokėjimą suskaidyti į kelias dalis, o ne palikti vieną didelį mokėjimo terminą — taip mokėjimo rizika lieka valdoma. Daugiau apie tai skyriuje [Likutinio mokėjimo automatizavimas](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
