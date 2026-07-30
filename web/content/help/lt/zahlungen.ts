import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Mokėjimai ir sąskaitos",
  description: "Mokėjimo paslaugų teikėjai, mokėjimo taisyklės ir sąskaitos.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Mokėjimai",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Mokėjimo paslaugų teikėjo prijungimas",
          excerpt:
            "Kaip prijungti Stripe ar PayPal prie myNextDays, kad mokėjimai būtų tvarkomi automatiškai.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Galimi teikėjai" },
            {
              type: "p",
              text: "myNextDays mokėjimus tvarko per prijungtus mokėjimo paslaugų teikėjus. Šiuo metu palaikomi Stripe ir PayPal — galite prijungti vieną arba abu teikėjus vienu metu ir naudoti priklausomai nuo objekto ar svečio pageidavimo.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite Paskyrą ir pereikite į skyrių „Mokėjimai“.",
                "Pasirinkite norimą teikėją — Stripe arba PayPal.",
                "Sekite prijungimo dialogo nurodymus ir prisijunkite prie teikėjo arba sukurkite naują paskyrą.",
                "Patvirtinkite ryšį — būsena pasikeičia į „prijungta“.",
              ],
            },
            { type: "h2", text: "Kas vyksta po to" },
            {
              type: "p",
              text: "Kai tik teikėjas prijungtas, galite siųsti mokėjimo nuorodas, imti avansinius mokėjimus ir tiesiogiai iš rezervacijos inicijuoti grąžinimus. Visos sumos tvarkomos atitinkamam objektui priskirta valiuta.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Be prijungto teikėjo mokėjimus galite žymėti kaip gautus tik rankiniu būdu — automatinis nurašymas tokiu atveju neįmanomas.",
            },
            { type: "h2", text: "Keli objektai, vienas teikėjas" },
            {
              type: "p",
              text: "Vieną kartą sukurtas ryšys galioja visai paskyrai ir visiems jūsų objektams. Kaip tiksliai vyksta nurašymas, nustatote per [Mokėjimo taisykles](/hilfe/zahlungen/zahlungsregeln). Išmokos jums vėliau vyksta per atitinkamą teikėją, žr. [Išmokos](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe tinka mokėjimams kortele ir daugeliui vietinių mokėjimo būdų",
                "PayPal svečiams siūlo pažįstamą alternatyvą",
                "Abu teikėjus galima atjungti ir iš naujo prijungti nepriklausomai vieną nuo kito",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Mokėjimo taisyklės",
          excerpt: "Nustatykite, kada rezervacijai turi būti sumokėtas avansas ir likutinė suma.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Avansas ir likutinis mokėjimas" },
            {
              type: "p",
              text: "Mokėjimo taisyklės nustato, kaip finansiškai tvarkoma rezervacija — pavyzdžiui, avansas rezervuojant ir likutinis mokėjimas prieš atvykimą, arba visa suma iš karto. Taisyklės galioja kiekvienam objektui ir gali būti bet kada koreguojamos.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skyrių „Mokėjimo taisyklės“.",
                "Pasirinkite, ar imamas avansas, ir nustatykite jo dalį.",
                "Nustatykite, kada turi būti sumokėtas likutis, pavyzdžiui, tam tikras dienų skaičius prieš atvykimą.",
                "Išsaugokite nustatymus.",
              ],
            },
            { type: "h2", text: "Automatinis nurašymas" },
            {
              type: "p",
              text: "Jei prijungtas mokėjimo paslaugų teikėjas, myNextDays automatiškai nuraso avansą ir likutinį mokėjimą nustatytu laiku bei iš anksto informuoja svečią žinute.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mokėjimo taisyklės veikia tik rezervacijoms su prijungtu mokėjimo paslaugų teikėju. Be teikėjo mokėjimus rezervacijoje žymite rankiniu būdu.",
            },
            { type: "h2", text: "Skirtumai priklausomai nuo kanalo" },
            {
              type: "p",
              text: "Portaluose gali galioti kitokia jų pačių mokėjimų tvarka — tokiu atveju patikrinkite atitinkamas portalo sąlygas. Rezervacijoms per nuosavą platformą ar svetainę visada galioja čia nurodytos jūsų taisyklės. Daugiau apie teikėjo prijungimą rasite skyriuje [Mokėjimo paslaugų teikėjo prijungimas](/hilfe/zahlungen/zahlungsanbieter-verbinden), o apie sąskaitų išrašymą — [Sąskaitų kūrimas](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Avansą galima nustatyti kaip fiksuotą sumą arba procentinį dydį",
                "Likutinio mokėjimo terminą galima laisvai pasirinkti",
                "Pakeitimai galioja tik naujoms rezervacijoms, ne atgaline data",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Sąskaitų kūrimas",
          excerpt: "Kaip sukurti rezervacijai sąskaitą su teisingu sąskaitos adresu.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Sąskaitos sukūrimas" },
            {
              type: "p",
              text: "Kiekvienai rezervacijai galima sukurti sąskaitą — pačiam svečiui arba kitai įmonei, jei rezervacija atliekama verslo tikslais.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite rezervaciją skiltyje Rezervacijos.",
                "Pasirinkite „Sukurti sąskaitą“.",
                "Patikrinkite arba papildykite sąskaitos adresą.",
                "Patikrinkite nurodytas eilutes — nakvynę, papildomas paslaugas, mokesčius.",
                "Sukurkite sąskaitą ir išsiųskite ją svečiui.",
              ],
            },
            { type: "h2", text: "Sąskaitos adreso tvarkymas" },
            {
              type: "p",
              text: "Sąskaitos adresą galite nurodyti tiesiogiai rezervacijoje arba leisti svečiui jį pateikti vėliau per rezervacijos patvirtinimą. Be išsamaus adreso tam tikrose šalyse teisiškai galiojanti sąskaita negali būti išrašyta.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Verslo klientams ypač patikrinkite įmonės pavadinimą ir adresą — vėlesniems taisymams reikės koreguojančios sąskaitos.",
            },
            { type: "h2", text: "Sumos ir valiuta" },
            {
              type: "p",
              text: "Visos eilutės nurodomos objektui priskirta valiuta. Jau atlikti mokėjimai sąskaitoje pažymimi kaip gautas mokėjimas. Kaip atsiranda avansas ir likutinis mokėjimas, skaitykite skyriuje [Mokėjimo taisyklės](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Sąskaitas galima atsisiųsti PDF formatu",
                "Pasikeitus duomenims koreguojančias sąskaitas galima išrašyti bet kada",
                "Papildomos paslaugos rodomos kaip atskira eilutė",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Grąžinimai",
          excerpt:
            "Kaip visiškai ar dalinai grąžinti mokėjimą, kai rezervacija atšaukiama arba keičiama.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kada reikalingas grąžinimas" },
            {
              type: "p",
              text: "Grąžinimas paprastai reikalingas atšaukimo atveju, tačiau gali prireikti ir vėliau koreguojant kainą ar atšaukiant papildomą paslaugą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamą rezervaciją skiltyje Rezervacijos.",
                "Rezervacijos mokėjimų skyriuje pasirinkite „Grąžinimas“.",
                "Įveskite grąžintiną sumą — visą arba dalinę.",
                "Patvirtinkite grąžinimą.",
              ],
            },
            { type: "h2", text: "Eiga per mokėjimo paslaugų teikėją" },
            {
              type: "p",
              text: "Grąžinimas atliekamas per mokėjimo metu naudotą teikėją — Stripe arba PayPal — ir grąžinamas tiesiai į pradinę svečio mokėjimo priemonę. Šis veiksmas automatiškai pažymimas rezervacijos laiko juostoje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Be prijungto mokėjimo paslaugų teikėjo grąžinimo automatiškai inicijuoti negalima — tokiu atveju grąžinimą aptarkite tiesiogiai su svečiu.",
            },
            { type: "h2", text: "Poveikis komisiniams mokesčiams" },
            {
              type: "p",
              text: "Jau apskaičiuoti prekyvietės ar portalo komisiniai mokesčiai grąžinimo atveju proporcingai pakoreguojami. Daugiau apie tai skyriuje [Komisinių mokesčių supratimas](/hilfe/zahlungen/provisionen-verstehen). Daugiau apie patį atšaukimą rasite skyriuje [Atšaukimas ir grąžinimas](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Dalinius grąžinimus galima atlikti atskiroms eilutėms",
                "Apdorojimo būsena rezervacijoje matoma bet kada",
                "Grąžinimai vyksta išimtinai per pradžioje naudotą teikėją",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Išmokos",
          excerpt:
            "Kaip iš prijungtų mokėjimo paslaugų teikėjų gaunate savo rezervacijų pajamas.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kaip veikia išmokos" },
            {
              type: "p",
              text: "Gaunami mokėjimai iš pradžių kaupiasi pas prijungtą mokėjimo paslaugų teikėją. Iš ten išmoka pervedama į jūsų nurodytą banko sąskaitą pagal atitinkamo teikėjo įprastą ritmą.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite Paskyrą ir pereikite į skyrių „Mokėjimai“.",
                "Skiltyje „Išmokos“ patikrinkite atitinkamo teikėjo būseną.",
                "Prireikus atidarykite teikėjo detalią peržiūrą, kad pamatytumėte visą išmokų istoriją.",
              ],
            },
            { type: "h2", text: "Kas išskaičiuojama prieš išmoką" },
            {
              type: "p",
              text: "Prieš išmoką atsižvelgiama į taikomus prekyvietės ir portalo komisinius mokesčius bei teikėjo mokesčius. Todėl išmokėta suma nebūtinai atitinka pradinę rezervacijos sumą.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tikslią išskaičiavimų struktūrą paaiškina [Komisinių mokesčių supratimas](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Keli objektai ir savininkai" },
            {
              type: "p",
              text: "Jei valdote objektus skirtingiems savininkams, išmokos priskiriamos pagal nurodytas savininkų atskaitomybes. Kilus neatitikimams, pirmiausia patikrinkite susijusių rezervacijų būseną skiltyje Rezervacijos.",
            },
            {
              type: "ul",
              items: [
                "Išmokų ritmą ir metodą nustato atitinkamas teikėjas",
                "Sulaikytos sumos, pavyzdžiui, vykstant grąžinimams, yra pažymimos",
                "Visa istorija prieinama peržiūrai tiesiogiai pas teikėją",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Komisinių mokesčių supratimas",
          excerpt:
            "Apžvalga, kaip susidaro prekyvietės ir portalo komisiniai mokesčiai ir kur jie apskaičiuojami.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Dvi komisinių mokesčių rūšys" },
            {
              type: "p",
              text: "Atliekant rezervacijas per myNextDays gali būti taikomi du skirtingi komisiniai mokesčiai: prekyvietės komisinis mokestis rezervacijoms per nuosavą platformą ir portalų komisiniai mokesčiai rezervacijoms, gaunamoms per prijungtus portalus, tokius kaip Booking ar Airbnb. Abu yra nepriklausomi vienas nuo kito ir gali skirtis priklausomai nuo rezervacijos pardavimo kelio.",
            },
            {
              type: "ul",
              items: [
                "Prekyvietės komisinis mokestis: taikomas rezervacijoms per myNextDays platformą",
                "Portalo komisinis mokestis: apskaičiuojamas atitinkamo portalo pagal jo pačio sąlygas",
                "Tiesioginės rezervacijos per jūsų nuosavą svetainę nagrinėjamos nepriklausomai nuo to",
              ],
            },
            { type: "h2", text: "Kur matomi komisiniai mokesčiai" },
            {
              type: "steps",
              items: [
                "Atidarykite Paskyrą ir pereikite į skyrių „Atsiskaitymas“.",
                "Pasirinkite norimą mėnesį.",
                "Patikrinkite kiekvienos rezervacijos suvestinę su atitinkamu komisiniu mokesčiu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Per kurį kanalą gauta rezervacija, matote tiesiogiai pačioje rezervacijoje — tai paaiškina, koks komisinis mokestis buvo taikomas.",
            },
            { type: "h2", text: "Ryšys su išmokomis" },
            {
              type: "p",
              text: "Komisiniai mokesčiai išskaičiuojami iš rezervacijos sumos prieš išmoką. Daugiau apie išmokų procesą rasite skyriuje [Išmokos](/hilfe/zahlungen/auszahlungen). Grąžinimo atveju atitinkamas komisinis mokestis proporcingai koreguojamas — visą rezervacijos eigą rodo [Rezervacijos laiko juosta](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
