import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanalų valdiklis",
  description: "Įvaldyti portalus ir kanalų valdiklį.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanalų valdiklis",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Pirmojo portalo prijungimas",
          excerpt: "Kaip pirmą kartą aktyvuoti portalą objektui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: sukūrėte objektą, bet dar neprijungėte jokio portalo",
            },
            {
              type: "p",
              text: "Jūsų objektas myNextDays sistemoje visiškai sutvarkytas, tačiau dar nematomas jokiame portale, tokiame kaip Booking.com ar Airbnb. Prieš portalui priimant objektą, jūsų paskyrai reikia vienkartinio visos paskyros portalo ryšio — po to kiekvienam kitam objektui pakanka tik susiejimo.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite /konto, skyrių „Portalai ir kanalų valdiklis“, ir nustatykite visos paskyros ryšį su savo įmonės duomenimis",
                "Po to atidarykite objektą skiltyje /objekte ir pereikite į skirtuką „Portalai“",
                "Pasirinkite norimą portalą ir priskirkite jį tinkamam kambario ar pasiūlymo tipui",
                "Patikrinkite nuotraukas, patogumus, kainas ir atšaukimo sąlygas — portalai reikalauja išsamių duomenų",
                "Aktyvuokite matomumą; portalui patikrinus būsena pasikeičia į „Prijungta“",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Visos paskyros ryšį nustatote tik vieną kartą. Daugiau apie tai skyriuose [Booking.com prijungimas](/hilfe/portale-kanalmanager/booking-verbinden) ir [Airbnb prijungimas](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com prijungimas",
          excerpt: "Kaip per kanalų valdiklį padaryti objektą rezervuojamą Booking.com.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: jūsų objektas turi tapti matomas ir Booking.com",
            },
            {
              type: "p",
              text: "Booking.com yra vienas iš portalų, prijungiamų per kanalų valdiklį. Sąlyga — visos paskyros portalo ryšys; jei jis jau nustatytas, Booking.com jums belieka tik susiejimas kiekvienam objektui.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Iš galimų portalų sąrašo pasirinkite „Booking.com“",
                "Priskirkite tinkamą kambario ar pasiūlymo tipą ir patvirtinkite bent vieną tarifą su kaina ir atšaukimo sąlygomis",
                "Nurodykite galiojantį mokėjimo būdą komisinio mokesčio apskaičiavimui",
                "Aktyvuokite matomumą Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com aktyvavimas gali užtrukti kelias valandas. Skirtuko „Portalai“ būsena parodo, kai tik ryšys tampa aktyvus.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb prijungimas",
          excerpt: "Kaip per kanalų valdiklį padaryti objektą rezervuojamą Airbnb.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: jūsų objektas turi tapti matomas ir Airbnb",
            },
            {
              type: "p",
              text: "Airbnb, kaip ir kiekvienas kitas portalas, prijungiamas per visos paskyros ryšį. Kai jis nustatytas, Airbnb aktyvuojate kiekvienam objektui per susiejimą — nepriklausomai nuo to, ar objektas jau matomas Booking.com ar kituose portaluose.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Iš galimų portalų sąrašo pasirinkite „Airbnb“",
                "Patvirtinkite objekto kategoriją ir priskirtą pasiūlymo tipą",
                "Papildykite nuotraukas, patogumus ir vidaus taisykles — Airbnb prieš aktyvavimą reikalauja išsamių duomenų",
                "Aktyvuokite matomumą Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Be nurodytų atšaukimo sąlygų ir vidaus tvarkos taisyklių Airbnb atmes aktyvavimą. Pirmiausia papildykite šiuos duomenis objekte.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Kainų sinchronizavimas visuose portaluose",
          excerpt: "Pakanka vieno kalendoriaus — kanalų valdiklis automatiškai paskirsto kainų pakeitimus visiems portalams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: keičiate kainą ir norite užtikrinti, kad ji būtų teisinga visur",
            },
            {
              type: "p",
              text: "Kainas tvarkote išimtinai objekto myNextDays kalendoriuje — niekada atskirai pačiuose portaluose. Kanalų valdiklis kiekvieną pakeitimą automatiškai perduoda visiems portalams, kuriems objektas yra aktyviai susietas.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objekto kainų kalendorių arba tarifų planus",
                "Pakoreguokite kasdienę kainą, minimalią buvimo trukmę ar atvykimo/išvykimo apribojimus",
                "Išsaugokite pakeitimą — jis pirmiausia įsigalioja vidiniame objekte",
                "Skirtuke „Portalai“ patikrinkite, ar visi norimi portalai tebėra aktyviai susieti",
                "Palaukite kelias minutes, kol pakeitimas bus perduotas portalams",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Niekada neįvedinėkite kainų tiesiogiai portale — tokie pakeitimai kito suderinimo metu bus perrašyti myNextDays kalendoriaus.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Portalo rezervacijos importavimas",
          excerpt: "Portalo rezervacijos automatiškai atsiranda kalendoriuje — čia patikrinsite, ar importas pavyko.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: svečias rezervavo per portalą, rezervacija turi atsirasti myNextDays sistemoje",
            },
            {
              type: "p",
              text: "Kai svečias rezervuoja per Booking.com, Airbnb ar kitą prijungtą portalą, kanalų valdiklis rezervaciją importuoja automatiškai — jums nieko nereikia perkelti rankiniu būdu. Ši eiga aprašo, kaip patikrinti ir patvirtinti importą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamo objekto kalendorių arba rezervacijų sąrašą",
                "Suraskite naują rezervaciją — ji turi portalo kilmės ženklelį, pavyzdžiui, Booking.com ar Airbnb",
                "Patikrinkite svečio duomenų, laikotarpio ir kainos išsamumą",
                "Patikrinkite, ar rezervuotos naktys visuose kituose kanaluose rodomos kaip užblokuotos",
                "Prireikus atidarykite rezervacijos detales, kad sutvarkytumėte papildomas paslaugas ar svečio žinutes",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jei svečias atšaukia rezervaciją per portalą arba pakeičia laikotarpį, tai taip pat automatiškai perimama, o naktys vėl atlaisvinamos.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Dvigubos rezervacijos sprendimas",
          excerpt: "Ką daryti, jei ta pati naktis išimties tvarka buvo parduota dviejuose kanaluose.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: dvi rezervacijos persidengia tam pačiam objektui ir toms pačioms naktims",
            },
            {
              type: "p",
              text: "Kanalų valdiklis paprastai iš karto užblokuoja rezervuotas naktis visuose kanaluose. Vis dėlto dviguba rezervacija gali atsirasti, pavyzdžiui, dėl vienalaikių rezervacijų dviejuose portaluose tuo pačiu momentu arba dėl rankiniu būdu sukurtos rezervacijos, kuri susikerta su portalo rezervacija.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objekto kalendorių ir nustatykite abi persidengiančias rezervacijas",
                "Patikrinkite abiejų rezervacijų rezervavimo laiką ir kilmės ženklelį",
                "Susisiekite su vėliau gauta rezervacija ir pasiūlykite alternatyvų objektą ar laikotarpį",
                "Atšaukite negaliojančią rezervaciją atitinkamame portale, o ne tik myNextDays sistemoje",
                "Po to atitinkamoms naktims nustatykite pardavimo stabdymą, kol atvejis bus visiškai išspręstas",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portalo rezervaciją visada atšaukite per patį portalą — atšaukimas tik myNextDays sistemoje vidujai atlaisvina naktį, tačiau nepatikimai informuoja portalą.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Laikinas portalo sustabdymas",
          excerpt: "Atskirai išjungti matomumą kiekviename portale, neprarandant susiejimo.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: objektas turi būti laikinai nerezervuojamas viename portale",
            },
            {
              type: "p",
              text: "Matomumą galima jungti atskirai kiekviename portale — nepriklausomai nuo svetainės ir platformos prekyvietės. Jei, pavyzdžiui, norite trumpam sustabdyti Airbnb, bet palikti veikiantį Booking.com, išjunkite tik šį vieną kanalą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Suraskite portalo, kurį norite sustabdyti, įrašą",
                "Išjunkite šio portalo matomumą",
                "Išsaugokite — pakeitimas įsigalioja per kelias minutes, objektas dingsta iš šio portalo paieškos rezultatų",
                "Vėl įjunkite matomumą, kai tik objektas turi vėl tapti rezervuojamas",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sustabdant susiejimas išsaugomas — priskyrimo portalui vėliau iš naujo kurti nereikės. Norėdami visiškai blokuoti visus kanalus, vietoj to naudokite pardavimo stabdymą.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Objekto susiejimo tikrinimas",
          excerpt: "Kaip patikrinti, ar jūsų objektas vis dar teisingai priskirtas tinkamam pasiūlymo tipui portale.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: kainos ar prieinamumas portale nebeatitinka myNextDays",
            },
            {
              type: "p",
              text: "Jei portalo rodymas skiriasi nuo jūsų myNextDays kalendoriaus, priežastis dažnai yra klaidingas ar nutrūkęs susiejimas — jūsų objekto ryšys su kambario ar pasiūlymo tipu portale.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Patikrinkite atitinkamo portalo būseną — ji turėtų rodyti „Prijungta“, o ne „Klaida“ ar „Laukiama“",
                "Patikrinkite, ar priskirtas kambario ar pasiūlymo tipas portale vis dar atitinka faktinį objektą",
                "Esant neatitikimui: atskirkite susiejimą ir priskirkite iš naujo, tada iš naujo aktyvuokite matomumą",
                "Po pataisymo palaukite kelias minutes ir dar kartą patikrinkite kainas bei prieinamumą portale",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objektas gali būti priskirtas keliems portalams vienu metu — kilus neatitikimams, tikslingai patikrinkite tą vieną atitinkamą portalą, o ne visus iš karto.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Skirtingi tarifai kiekviename portale",
          excerpt: "Kaip priskirti portalui atskirą tarifų planą, nepaveikiant kitų kanalų.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: viename portale norite siūlyti kitokią kainą nei kituose kanaluose",
            },
            {
              type: "p",
              text: "Tarifų planus galima priskirti atskirai kiekvienam portalui, pavyzdžiui, neatšaukiamą tarifų planą vienam portalui ir lankstų — kitam. Bazinės kainos tvarkomos centralizuotai objekte, o susiejimas nustato, kuris tarifų planas eina į kurį portalą.",
            },
            {
              type: "steps",
              items: [
                "Objekte sukurkite papildomą tarifų planą su norimomis sąlygomis (kaina, atšaukimo sąlygos, minimali buvimo trukmė)",
                "Atidarykite skirtuką „Portalai“ ir pasirinkite atitinkamą portalą",
                "Susiejime priskirkite naują tarifų planą šiam portalui",
                "Kitus portalus palikite nepakeistus prie ankstesnio tarifų plano",
                "Išsaugokite ir po kelių minučių patikrinkite kainos rodymą atitinkamame portale",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kiekvienas tarifų planas perduodamas nepriklausomai — vieno tarifų plano pakeitimas nepaveikia portalų, priskirtų kitam tarifų planui.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Dažnų portalo klaidų šalinimas",
          excerpt: "Tipinės priežastys, kai portalas atmeta objektą arba sinchronizavimas užstringa.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija: portalo būsena rodo klaidą arba objektas nepriimamas",
            },
            {
              type: "p",
              text: "Portalai ryšį dažniausiai atmeta dėl trūkstamų pagrindinių duomenų arba neišsamių objekto duomenų. Prieš susisiekdami su pagalba, patikrinkite dažniausias priežastis iš eilės.",
            },
            {
              type: "steps",
              items: [
                "Skiltyje /konto patikrinkite, ar adresas, mokesčių informacija ir kontaktiniai duomenys nurodyti išsamiai",
                "Objekte patikrinkite, ar aprašymas, nuotraukos, patogumai ir bent vienas tarifas yra išsamūs",
                "Patikrinkite, ar nurodytas galiojantis mokėjimo būdas komisiniams mokesčiams",
                "Atidarykite skirtuką „Portalai“ ir perskaitykite tikslų klaidos pranešimą šalia atitinkamo portalo",
                "Ištaisykite nurodytą trūkumą ir iš naujo aktyvuokite matomumą",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portalo klaida visada paveikia tik tą vieną portalą — kiti kanalai veikia toliau nepriklausomai, kol tenkinami jų pačių reikalavimai.",
            },
          ],
        },
      ],
    },
  ],
};
