import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Pirmieji žingsniai",
  description: "Nustatykite paskyrą ir pradėkite per kelias minutes.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Nustatymas",
      articles: [
        {
          slug: "willkommen",
          title: "Sveiki atvykę į myNextDays",
          excerpt: "PMS, kanalų valdiklio, prekyvietės ir programėlės apžvalga.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays yra jūsų centrinė platforma poilsio objektams ir viešbučiams. Vietoj kelių atskirų sprendimų prieinamumą, kainas, rezervacijas ir bendravimą su svečiais valdote vienoje vietoje — nesvarbu, ar valdote vieną poilsio namą, ar kelis viešbučio kambarius.",
            },
            { type: "h2", text: "Keturi pagrindiniai elementai" },
            {
              type: "ul",
              items: [
                "PMS (turto valdymo sistema): objektai, kalendorius, kainos, rezervacijos, užduotys ir mokėjimai.",
                "Kanalų valdiklis: ryšys su portalais, tokiais kaip Booking, Airbnb ir kt. — vienas įvedimas, daug portalų sinchronizuota.",
                "Platformos prekyvietė: nuosava myNextDays prekyvietė — lygiavertis rezervacijų kanalas šalia portalų.",
                "Programėlė: mobilioji programa svečiams, savininkams ir darbuotojams su tais pačiais duomenimis kaip internete.",
              ],
            },
            { type: "h2", text: "Kaip elementai veikia kartu" },
            {
              type: "p",
              text: "Objektą, kainas ir prieinamumą tvarkote vieną kartą centralizuotai PMS sistemoje. Iš ten myNextDays duomenis automatiškai paskirsto visiems aktyviems kanalams. Rezervacija — nesvarbu, per kurį kanalą ji gaunama — iš karto užblokuoja atitinkamas naktis visur, todėl dvigubos rezervacijos yra neįmanomos.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pradėkite nuo skyriaus Paskyros ir įmonės nustatymas, tada sukurkite pirmąjį objektą — tokia tvarka vėliau sutaupys jums pataisymų.",
            },
            { type: "h2", text: "Kiti žingsniai" },
            {
              type: "steps",
              items: [
                "Meniu atidarykite Paskyra ir papildykite savo įmonės duomenis.",
                "Skiltyje Objektai sukurkite savo pirmąjį objektą.",
                "Patikrinkite, ar patogumai, nuotraukos ir kainos yra išsamūs.",
                "Spustelėkite Publikuoti, kad objektas taptų matomas visuose kanaluose.",
              ],
            },
            {
              type: "p",
              text: "Daugiau apie atskirus žingsnius rasite skyriuose [Paskyros ir įmonės nustatymas](/hilfe/erste-schritte/konto-einrichten) ir [Pirmojo objekto sukūrimas](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Paskyros ir įmonės nustatymas",
          excerpt: "Teisingai nurodykite pagrindinius duomenis, sąskaitos adresą ir valiutą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Prieš kurdami objektus, paskyroje nustatykite savo įmonę. Šie duomenys reikalingi sąskaitoms, portalams ir atsiskaitymui su myNextDays, todėl jie turėtų būti išsamūs ir teisingi.",
            },
            { type: "h2", text: "Pagrindinių duomenų nurodymas" },
            {
              type: "steps",
              items: [
                "Meniu atidarykite Paskyra.",
                "Skiltyje Pagrindiniai duomenys įveskite įmonės pavadinimą arba individualios įmonės pavadinimą, adresą ir kontaktinius duomenis.",
                "Nurodykite sąskaitos adresą — jis bus rodomas visose išrašytose sąskaitose.",
                "Pasirinkite savo pagrindinę valiutą. Ji galioja visoms kainoms, kol jos tikslingai nepakeisite atskiram objektui.",
              ],
            },
            { type: "h2", text: "Kodėl valiuta yra svarbi" },
            {
              type: "p",
              text: "Valiuta niekada nespėjama ir nepapildoma automatiškai: jei jos nėra, jokia kaina negali būti teisingai rodoma ar apskaičiuota. Todėl myNextDays reikalauja sąmoningo pasirinkimo nustatymo metu, o ne numatytosios reikšmės.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jei vėliau pakeisite objekto valiutą, kartu bus perskaičiuoti visi su juo susiję kainų planai. Po to dar kartą patikrinkite kainas.",
            },
            { type: "h2", text: "Sąskaitos adresas ir atsiskaitymas" },
            {
              type: "p",
              text: "Paskyros skiltyje Atsiskaitymas matote savo einamąsias sąskaitas ir nurodytą sąskaitos adresą. Šiuos duomenis atnaujinkite, ypač pasikeitus teisinei formai ar adresui, kad sąskaitos būtų išrašomos teisingai.",
            },
            {
              type: "ul",
              items: [
                "Įmonės pavadinimas arba individualios įmonės pavadinimas",
                "Sąskaitos adresas su šalimi",
                "Mokesčių mokėtojo ar PVM mokėtojo kodas, jei toks yra",
                "Pagrindinė valiuta naujiems objektams",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Pirmojo objekto sukūrimas",
          excerpt: "Kaip žingsnis po žingsnio sukurti pirmąjį rezervuojamą objektą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Objektas myNextDays sistemoje visada yra lygiai viena rezervuojama vienetas: arba atskiras viešbučio kambarys, arba visas poilsio objektas. Jei valdote viešbutį su keliais kambariais, kiekvienam kambariui sukurkite atskirą objektą.",
            },
            { type: "h2", text: "Objekto kūrimas" },
            {
              type: "steps",
              items: [
                "Meniu atidarykite Objektai.",
                "Spustelėkite Pridėti objektą.",
                "Pasirinkite objekto tipą: kategoriją, nekilnojamojo turto tipą ir pasiūlymo rūšį.",
                "Papildykite adresą, talpą ir bazinę kainą jūsų nurodyta valiuta.",
                "Išsaugokite objektą kaip juodraštį, kad vėliau jį užbaigtumėte.",
              ],
            },
            { type: "h2", text: "Ko dar trūksta po to" },
            {
              type: "p",
              text: "Naujai sukurtas objektas iš pradžių yra juodraštis ir nematomas jokiame kanale. Prieš publikuodami papildykite patogumus, nuotraukas, aprašymą ir kalendoriaus prieinamumą — patikimai parduoti galima tik pilnai užpildytą objektą.",
            },
            {
              type: "ul",
              items: [
                "Pasirinkti patogumų požymius iš kategorijų sąrašo",
                "Įkelti bent vieną titulinę nuotrauką ir aprašymą",
                "Teisingai įvesti talpą (suaugusieji, vaikai, lovos)",
                "Patikrinti bazinę kainą ir kalendoriaus prieinamumą",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jei valdote kelių tipų kambarius, šį procesą pakartokite kiekvienam kambariui atskirai — nėra aukštesnio pastato lygmens su kambariais po juo.",
            },
            {
              type: "p",
              text: "Kai visi privalomi laukai užpildyti, galite objektą publikuoti, žr. [Objekto publikavimas](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objekto publikavimas",
          excerpt: "Vienas paspaudimas kartu aktyvuoja platformos prekyvietę, portalus ir svetainę.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Publikavimas padaro objektą matomą ir rezervuojamą. Paprastai pakanka vieno paspaudimo, kad vienu metu būtų aktyvuoti visi trys pardavimo kanalai — tačiau matomumą kiekvienam kanalui bet kada galite koreguoti atskirai.",
            },
            { type: "h2", text: "Kaip publikuoti" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje Objektai.",
                "Skirtuke Apžvalga patikrinkite, ar visi privalomi laukai pažymėti žaliai.",
                "Spustelėkite Publikuoti.",
                "Patvirtinkite dialogo langą — bus aktyvuota platformos prekyvietė, portalai ir svetainė.",
              ],
            },
            { type: "h2", text: "Atskiras kanalų valdymas" },
            {
              type: "p",
              text: "Po publikavimo skirtuke Matomumas rasite tris atskirus jungiklius: svetainę, platformos prekyvietę ir portalus. Jei norite, kad objektas būtų siūlomas, pavyzdžiui, tik jūsų svetainėje, bet ne per portalus, tiesiog išjunkite atitinkamą jungiklį.",
            },
            {
              type: "ul",
              items: [
                "Svetainė: matomumas jūsų nuosavoje myNextDays svetainėje",
                "Platformos prekyvietė: matomumas visuotinėje myNextDays prekyvietėje",
                "Portalai: matomumas Booking, Airbnb ir kituose portaluose",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Šie trys jungikliai nepriklauso nuo objekto būsenos (aktyvus / neaktyvus). Aktyvus objektas vis tiek gali būti nematomas atskiruose kanaluose.",
            },
            { type: "h2", text: "Laikinas objekto blokavimas" },
            {
              type: "p",
              text: "Jei norite blokuoti tik vieną dieną, o ne visą objektą, kalendoriuje naudokite Pardavimo stabdymą (Stop-Sell) — tai vienu metu blokuoja dieną visuose kanaluose, nepriklausomai nuo matomumo jungiklių.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Trijų pardavimo kanalų supratimas",
          excerpt: "Portalų, platformos prekyvietės ir programėlės apžvalga.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays kiekvieną objektą vienu metu parduoda per kelis lygiaverčius kanalus. Supratimas, kaip jie veikia kartu, padeda tikslingai valdyti matomumą ir kainas.",
            },
            { type: "h2", text: "Portalai" },
            {
              type: "p",
              text: "Per kanalų valdiklį susiejate savo objektą su didžiaisiais rezervacijų portalais, tokiais kaip Booking, Airbnb ir kt. Prieinamumas ir kainos sinchronizuojami automatiškai, todėl jums nereikia rankiniu būdu tvarkyti kelių portalų kalendorių.",
            },
            { type: "h2", text: "Platformos prekyvietė" },
            {
              type: "p",
              text: "myNextDays prekyvietė yra atskiras, visuotinis rezervacijų kanalas — panašus į Booking ar Airbnb, tačiau priklausantis tai pačiai platformai. Tai nėra „tiesioginių rezervacijų“ pakaitalas, o lygiavertis kanalas su savo atskira matomumo ašimi.",
            },
            { type: "h2", text: "Programėlė" },
            {
              type: "p",
              text: "Mobilioji programėlė svečiams, savininkams ir darbuotojams suteikia prieigą prie tų pačių duomenų kaip internete — pavyzdžiui, rezervacijos duomenis, žinutes ar užduotis, priklausomai nuo atitinkamo vaidmens.",
            },
            { type: "h2", text: "Trys atskiros matomumo ašys" },
            {
              type: "ul",
              items: [
                "Svetainė — jūsų nuosava myNextDays svetainė",
                "Platformos prekyvietė — visuotinė myNextDays prekyvietė",
                "Portalai — Booking, Airbnb ir kt. per kanalų valdiklį",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Visos trys ašys jungiamos ir išjungiamos nepriklausomai viena nuo kitos. O Pardavimo stabdymas ir objekto būsena, priešingai, veikia visus tris kanalus vienu metu.",
            },
          ],
        },
      ],
    },
  ],
};
