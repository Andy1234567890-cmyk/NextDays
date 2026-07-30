import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portalai ir kanalų valdiklis",
  description: "Centralizuotai valdyti Booking, Airbnb, Expedia ir kt.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portalų prijungimas",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Kas yra kanalų valdiklis?",
          excerpt:
            "Kanalų valdiklis automatiškai suderina kainas, prieinamumą ir rezervacijas tarp myNextDays ir portalų.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Vienas ryšys visiems portalams" },
            {
              type: "p",
              text: "Kanalų valdiklis yra tiltas tarp myNextDays ir didžiųjų rezervacijų portalų, tokių kaip Booking, Airbnb ir kt. Vietoj to, kad kiekviename portale atskirai tvarkytumėte kainas, prieinamumą ir užimtumą, viską įvedate vieną kartą myNextDays sistemoje — kanalų valdiklis tai automatiškai paskirsto visiems prijungtiems portalams.",
            },
            { type: "h2", text: "Kas sinchronizuojama automatiškai" },
            {
              type: "ul",
              items: [
                "Prieinamumas — kiekviena rezervacija iš karto užblokuoja naktį visuose portaluose",
                "Kainos ir minimali buvimo trukmė iš jūsų kainų kalendoriaus",
                "Gaunamos portalo rezervacijos automatiškai importuojamos į myNextDays",
                "Atšaukimai ir pardavimo stabdymas veikia visuose kanaluose",
              ],
            },
            { type: "h2", text: "Ko dėl to nebereikia daryti rankiniu būdu" },
            {
              type: "p",
              text: "Be kanalų valdiklio po kiekvienos rezervacijos turėtumėte rankiniu būdu blokuoti naktį kiekviename portale — tai dažna dvigubų rezervacijų priežastis. Kai kanalų valdiklis aktyvus, myNextDays šį suderinimą atlieka abiem kryptimis, kelis kartus per dieną ir realiu laiku, gavus naujų rezervacijų.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portalo ryšys nustatomas vieną kartą visai paskyrai. Kiekvienam atskiram objektui po to belieka aktyvuoti susiejimą (mapping) — daugiau apie tai skyriuje [Objekto priskyrimas portalui](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portalo ryšio nustatymas",
          excerpt:
            "Ryšį su portalais nustatote vieną kartą visai paskyrai — ne iš naujo kiekvienam objektui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Vieną kartą visai paskyrai" },
            {
              type: "p",
              text: "Prijungimas prie portalų yra visos paskyros nustatymas: savo myNextDays paskyrą su kanalų valdikliu susiejate lygiai vieną kartą. Visi vėliau sukurti objektai automatiškai naudoja šį vieną ryšį — jo nereikia iš naujo kurti kiekvienam objektui.",
            },
            { type: "h2", text: "Kaip nustatyti ryšį" },
            {
              type: "steps",
              items: [
                "Atidarykite /konto ir pasirinkite skyrių „Portalai ir kanalų valdiklis“",
                "Spustelėkite „Nustatyti ryšį“ ir patvirtinkite savo įmonės duomenis (adresą, kontaktus, teisinę formą)",
                "Patikrinkite automatiškai perimtus pagrindinius duomenis — jie perduodami visiems portalams",
                "Užbaikite nustatymą; būsena pasikeičia į „Prijungta“",
              ],
            },
            { type: "h2", text: "Kitas žingsnis: objektų priskyrimas" },
            {
              type: "p",
              text: "Po vienkartinio nustatymo dar joks objektas nematomas — tam kiekvieną objektą atskirai priskiriate portalui (susiejimas / mapping) ir prijungiate norimus portalus, tokius kaip Booking.com ar Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Be išsamių pagrindinių duomenų (adreso, mokesčių informacijos, kontaktų) portalai atmes ryšį. Pirmiausia patikrinkite šiuos duomenis skiltyje /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Objekto priskyrimas portalui",
          excerpt:
            "Po visos paskyros ryšio nustatymo kiekvienam objektui belieka aktyvuoti susiejimą su atitinkamu portalu.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Susiejimas vietoj naujo ryšio" },
            {
              type: "p",
              text: "Kai portalo ryšys jau nustatytas visai paskyrai, kiekvieną objektą sujungiate tik per vadinamąjį susiejimą (mapping): nustatote, kuris myNextDays objektas atitinka kurį kambario ar pasiūlymo tipą portale. Tai kiekvienam objektui yra vienkartinis žingsnis.",
            },
            { type: "h2", text: "Kaip priskirti objektą" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte ir pereikite į skirtuką „Portalai“",
                "Pasirinkite norimą portalą, pavyzdžiui, Booking.com ar Airbnb",
                "Priskirkite objektą tinkamam kambario ar pasiūlymo tipui portale",
                "Aktyvuokite sinchronizavimą — kainos ir prieinamumas nuo šiol perduodami",
              ],
            },
            { type: "h2", text: "Vienas objektas, keli portalai" },
            {
              type: "p",
              text: "Vienas objektas gali būti vienu metu priskirtas keliems portalams. Kiekvienas priskyrimas yra nepriklausomas — pavyzdžiui, objektą galite padaryti matomą Booking.com ir Airbnb, o Expedia kol kas palikti išjungtą.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po susiejimo iš karto patikrinkite matomumą — žr. [Matomumas kiekviename portale](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com prijungimas",
          excerpt: "Kaip aktyvuoti Booking.com kaip pardavimo kanalą objektui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Sąlyga: visos paskyros ryšys" },
            {
              type: "p",
              text: "Prieš aktyvuodami Booking.com objektui, turi būti nustatytas visos paskyros portalo ryšys (žr. [Portalo ryšio nustatymas](/hilfe/portale-kanalmanager/portal-verbindung)). Po to Booking.com kiekvienam kitam objektui yra tik susiejimo klausimas.",
            },
            { type: "h2", text: "Booking.com aktyvavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Iš galimų portalų sąrašo pasirinkite „Booking.com“",
                "Priskirkite tinkamą kambario ar pasiūlymo tipą ir patvirtinkite tarifų planus",
                "Aktyvuokite matomumą — objektas bus paskelbtas viešai po Booking.com patikrinimo",
              ],
            },
            { type: "h2", text: "Ko iš jūsų tikisi Booking.com" },
            {
              type: "ul",
              items: [
                "Išsamus objekto aprašymas, nuotraukos ir patogumai",
                "Bent vienas tarifas su kaina ir atšaukimo sąlygomis",
                "Galiojantis mokėjimo būdas komisiniams mokesčiams",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com aktyvavimas gali užtrukti kelias valandas. Objekto skirtuke „Portalai“ rodoma būsena parodo, ar ryšys jau aktyvus.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb prijungimas",
          excerpt: "Kaip per kanalų valdiklį padaryti objektą rezervuojamą Airbnb.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Airbnb kaip papildomas portalas" },
            {
              type: "p",
              text: "Airbnb, kaip ir kiekvienas kitas portalas, prijungiamas per visos paskyros ryšį. Kai jis nustatytas, Airbnb aktyvuojate kiekvienam objektui per susiejimą — nepriklausomai nuo to, ar objektas jau matomas Booking.com ar kituose portaluose.",
            },
            { type: "h2", text: "Airbnb aktyvavimas objektui" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Iš galimų portalų sąrašo pasirinkite „Airbnb“",
                "Patvirtinkite objekto kategoriją ir priskirtą pasiūlymo tipą",
                "Patikrinkite nuotraukas, patogumus ir vidaus taisykles — Airbnb prieš aktyvavimą reikalauja išsamių duomenų",
                "Aktyvuokite matomumą Airbnb",
              ],
            },
            { type: "h2", text: "Po aktyvavimo" },
            {
              type: "p",
              text: "Kai tik Airbnb objektą patvirtins, kainos ir prieinamumas automatiškai eis per kanalų valdiklį. Airbnb gautos rezervacijos vėliau automatiškai pasirodo jūsų rezervacijų kalendoriuje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Be nurodytų atšaukimo sąlygų ir vidaus tvarkos taisyklių Airbnb atmes aktyvavimą. Pirmiausia papildykite šiuos duomenis objekte.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Kainų ir prieinamumo sinchronizavimas",
          excerpt:
            "Kainos ir prieinamumas automatiškai perduodami visiems prijungtiems portalams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Vienas kalendorius, visi portalai" },
            {
              type: "p",
              text: "Kainas ir prieinamumą tvarkote išimtinai atitinkamo objekto myNextDays kalendoriuje. Kanalų valdiklis kiekvieną pakeitimą automatiškai perduoda visiems portalams, kuriems objektas yra aktyviai susietas — jums nereikia nieko įvedinėti du kartus.",
            },
            { type: "h2", text: "Kas perduodama" },
            {
              type: "ul",
              items: [
                "Kasdienės kainos iš jūsų kainų kalendoriaus arba tarifų planų",
                "Laisvos naktys ir blokavimai",
                "Minimali buvimo trukmė bei atvykimo ir išvykimo apribojimai",
                "Pardavimo stabdymo dienos — jos automatiškai blokuojamos visuose portaluose",
              ],
            },
            { type: "h2", text: "Kaip greitai veikia sinchronizavimas" },
            {
              type: "p",
              text: "Kainų ir prieinamumo pakeitimai portalams perduodami per kelias minutes. Naujos rezervacijos iš karto blokuoja atitinkamas naktis, kad ta pati naktis negalėtų būti pakartotinai parduota jokiame kitame kanale.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Daugiau apie atskirų dienų blokavimą visuose kanaluose rasite skyriuje [Perpildymo (dvigubų rezervacijų) vengimas](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portalo rezervacijų gavimas",
          excerpt: "Rezervacijos iš Booking, Airbnb ir kt. automatiškai atsiranda jūsų kalendoriuje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Automatinis importas" },
            {
              type: "p",
              text: "Kai svečias rezervuoja per portalą, tokį kaip Booking.com ar Airbnb, kanalų valdiklis rezervaciją automatiškai importuoja į myNextDays. Jums nereikia nieko perkelti rankiniu būdu — rezervacija pasirodo kalendoriuje ir atitinkamo objekto rezervacijų sąraše.",
            },
            { type: "h2", text: "Kas vyksta gavus portalo rezervaciją" },
            {
              type: "steps",
              items: [
                "Portalas praneša kanalų valdikliui apie naują rezervaciją",
                "myNextDays sukuria rezervaciją su svečio duomenimis, laikotarpiu ir kaina",
                "Rezervuotos naktys iš karto užblokuojamos visuose kituose kanaluose",
                "Gaunate pranešimą ir rezervaciją randate kalendoriuje",
              ],
            },
            { type: "h2", text: "Atšaukimai ir pakeitimai" },
            {
              type: "p",
              text: "Jei svečias atšaukia rezervaciją per portalą arba pakeičia laikotarpį, tai taip pat automatiškai perduodama į myNextDays, o atitinkamos naktys vėl atlaisvinamos.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portalo rezervacijas rezervacijos duomenyse galima atpažinti pagal kilmės ženklelį, pavyzdžiui, Booking.com ar Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Perpildymo (dvigubų rezervacijų) vengimas",
          excerpt: "Pardavimo stabdymas ir automatiniai blokavimai užkerta kelią dvigubomis rezervacijomis keliuose portaluose.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kodėl atsiranda perpildymas" },
            {
              type: "p",
              text: "Be centrinio valdymo lengvai atsitinka, kad ta pati naktis vienu metu parduodama dviejuose portaluose — pavyzdžiui, kai kainos ir prieinamumas rankiniu būdu tvarkomi keliose sistemose. Kanalų valdiklis šią spragą uždaro, nes kiekviena rezervacija bet kuriame kanale iš karto užblokuoja visus kitus kanalus.",
            },
            { type: "h2", text: "Jūsų priemonės prieš perpildymą" },
            {
              type: "ul",
              items: [
                "Automatinis blokavimas: kiekviena nauja rezervacija — nesvarbu, kuriame kanale — visur užblokuoja naktis",
                "Pardavimo stabdymas: rankiniu būdu vienu metu blokuoja dieną visuose kanaluose, pavyzdžiui, naudojimui patiems ar priežiūrai",
                "Minimali buvimo trukmė ir atvykimo apribojimai užkerta kelią netinkamoms trumpalaikėms rezervacijoms",
              ],
            },
            { type: "h2", text: "Pardavimo stabdymo nustatymas" },
            {
              type: "steps",
              items: [
                "Atidarykite objekto užimtumo kalendorių",
                "Pažymėkite atitinkamą dieną ar laikotarpį",
                "Pasirinkite „Pardavimo stabdymas“ — po to diena bus užblokuota visuose portaluose, svetainėje ir platformoje",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pardavimo stabdymas be išimčių galioja visiems kanalams. Nėra galimybės blokuoti dieną tik vienam portalui, o kitiems palikti atvirą.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Matomumas kiekviename portale",
          excerpt: "Kiekvieną portalą galima įjungti ar išjungti nepriklausomai nuo svetainės ir platformos prekyvietės.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Trys nepriklausomi pardavimo kanalai" },
            {
              type: "p",
              text: "Objektas gali būti parduodamas vienu metu keliais keliais: per portalus (Booking, Airbnb ir kt.), per myNextDays platformos prekyvietę ir per jūsų nuosavą svetainę. Kiekvienas kelias turi savo matomumo jungiklį — jie visiškai nepriklauso vienas nuo kito.",
            },
            { type: "h2", text: "Matomumo valdymas kiekviename portale" },
            {
              type: "p",
              text: "Portalų viduje papildomai kiekvieną atskirą portalą galima jungti atskirai. Pavyzdžiui, objektas gali būti aktyvus Booking.com, bet išjungtas Airbnb — abu priskyrimai lieka nepakitę.",
            },
            { type: "h2", text: "Kaip pakeisti matomumą" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje /objekte, skirtukas „Portalai“",
                "Įjunkite arba išjunkite norimą kanalą (atskirą portalą, svetainę ar platformos prekyvietę) atskirai",
                "Išsaugokite — pakeitimas įsigalioja per kelias minutes",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekto būsena (aktyvus / neaktyvus) ir pardavimo stabdymas veikia aukštesniu lygiu visus kanalus. Matomumo jungikliai valdo tik tai, kuriuose papildomuose kanaluose pasirodo jau aktyvus objektas.",
            },
          ],
        },
      ],
    },
  ],
};
