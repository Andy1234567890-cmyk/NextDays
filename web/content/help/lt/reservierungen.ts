import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervacijos ir užsakymai",
  description: "Valdyti, keisti ir atšaukti rezervacijas.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervacijos",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Rankinis rezervacijos įvedimas",
          excerpt:
            "Kaip telefonu ar el. paštu gautą rezervaciją įvesti tiesiai į myNextDays.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kada įvedate rankiniu būdu" },
            {
              type: "p",
              text: "Ne kiekviena rezervacija gaunama per portalą ar jūsų nuosavą platformą — užklausas telefonu, el. paštu ar vietoje turite sukurti patys, kad objektas myNextDays sistemoje būtų teisingai užblokuotas ir neatsirastų dvigubo užimtumo.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite Rezervacijas ir spustelėkite „Nauja rezervacija“.",
                "Pasirinkite objektą — kiekvienas objektas myNextDays sistemoje yra atskira rezervuojama vienetas, t. y. konkretus kambarys arba poilsio objektas.",
                "Nustatykite atvykimo ir išvykimo datas bei svečių skaičių.",
                "Įveskite svečio duomenis (vardas, kontaktai, prireikus — adresas sąskaitai).",
                "Patikrinkite pasiūlytą kainą ir prireikus ją pakoreguokite.",
                "Išsaugokite rezervaciją — naktys iš karto užblokuojamos kalendoriuje.",
              ],
            },
            { type: "h2", text: "Mokėjimas ir patvirtinimas" },
            {
              type: "p",
              text: "Po išsaugojimo galioja tos pačios mokėjimo taisyklės kaip ir internetinėms rezervacijoms. Jei prijungtas mokėjimo paslaugų teikėjas, galite iš karto siųsti svečiui mokėjimo nuorodą arba pažymėti mokėjimą kaip gautą rankiniu būdu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Specialius pageidavimus (ankstyvas atvykimas, papildomos lovos) iš karto įrašykite į pastabas — komanda juos matys rezervacijos laiko juostoje.",
            },
            { type: "h2", text: "Po sukūrimo" },
            {
              type: "p",
              text: "Nauja rezervacija iš karto pasirodo [Rezervacijos laiko juostoje](/hilfe/reservierungen/buchungs-zeitleiste) kartu su visais tolesniais žingsniais, tokiais kaip žinutės, užduotys ir mokėjimai, vienoje vietoje.",
            },
            {
              type: "ul",
              items: [
                "Kalendorius ir portalai sinchronizuojami automatiškai, kai tik išsaugote.",
                "Prireikus svečias gauna automatinę patvirtinimo žinutę.",
                "Datų pakeitimus atliekate per „Perkelti rezervaciją“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Rezervacijos laiko juosta",
          excerpt:
            "Rezervacijos laiko juosta sujungia visą rezervacijos eigą vienoje vietoje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Ką rodo laiko juosta" },
            {
              type: "p",
              text: "Kiekviena rezervacija turi savo laiko juostą, kuri chronologiškai atvaizduoja visą eigą — nuo rezervacijos užklausos ar importo iš portalo iki išvykimo. Taip vienu žvilgsniu matote, kas jau įvyko ir kas laukia toliau.",
            },
            {
              type: "ul",
              items: [
                "Žinutės su svečiu",
                "Užduotys, pavyzdžiui, valymas ar pasiruošimas",
                "Mokėjimai ir sąskaitos",
                "Užsakytos papildomos paslaugos",
                "Perkėlimai ir atšaukimai",
              ],
            },
            { type: "h2", text: "Laiko juostos naudojimas kasdien" },
            {
              type: "steps",
              items: [
                "Atidarykite Rezervacijas ir pasirinkite norimą rezervaciją.",
                "Pereikite į skirtuką „Laiko juosta“.",
                "Slinkite chronologiškai per visus įvykius.",
                "Naudokite greituosius veiksmus, kad iš karto išsiųstumėte žinutę arba sukurtumėte užduotį.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jei rezervacija perkeliama arba atšaukiama, šis žingsnis taip pat pasirodo laiko juostoje — įskaitant kalendoriuje atlaisvintas naktis.",
            },
            { type: "h2", text: "Kodėl tai svarbu" },
            {
              type: "p",
              text: "Kadangi komanda, savininkas ir pagalba mato tą pačią laiko juostą, tarp žinučių, užduočių ir mokėjimų neatsiranda informacijos spragų. Daugiau apie grąžinimus rasite skyriuje [Grąžinimai](/hilfe/zahlungen/rueckerstattungen), o apie papildomas paslaugas — [Papildomos paslaugos](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Rezervacijos perkėlimas",
          excerpt:
            "Kaip perkelti esamą rezervaciją į naują laikotarpį, nesukeliant sumaišties kalendoriuje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Ką patikrinti prieš perkeliant" },
            {
              type: "p",
              text: "Prieš perkeldami rezervaciją, patikrinkite rezervuoto objekto prieinamumą naujame laikotarpyje. myNextDays iš pradžių rezervuotas naktis atlaisvina tik patvirtinus naują laikotarpį — taip neatsiranda spraga, kurioje objektas klaidingai laikomas laisvu ar dvigubai užimtu.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite rezervaciją skiltyje Rezervacijos.",
                "Pasirinkite „Perkelti“ ir įveskite naują laikotarpį.",
                "Patikrinkite rodomą naujų datų prieinamumą.",
                "Patvirtinkite perkėlimą.",
                "Patikrinkite, ar dėl naujo naktų skaičiaus keičiasi kaina, ir prireikus ją pakoreguokite.",
              ],
            },
            { type: "h2", text: "Kas vyksta automatiškai" },
            {
              type: "p",
              text: "Patvirtinus, senos naktys kalendoriuje teisingai atlaisvinamos, o naujos — užblokuojamos, prijungti portalai atnaujinami. Šis veiksmas registruojamas rezervacijos laiko juostoje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jei rezervacija gauta per portalą, perkėlimui gali galioti jo pačio taisyklės — prieš atlikdami didesnius pakeitimus patikrinkite portalo taisykles.",
            },
            { type: "h2", text: "Mokėjimo skirtumai" },
            {
              type: "p",
              text: "Jei dėl perkėlimo pasikeičia kaina, atitinkamai pakoreguokite mokėjimo taisykles — žr. [Mokėjimo taisyklės](/hilfe/zahlungen/zahlungsregeln). Daugiau apie visą rezervacijos eigą rasite skyriuje [Rezervacijos laiko juosta](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Atšaukimas ir grąžinimas",
          excerpt:
            "Kaip teisingai atšaukti rezervaciją ir prireikus inicijuoti grąžinimą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Rezervacijos atšaukimas" },
            {
              type: "p",
              text: "Atšaukimas iš karto vėl atlaisvina objektą rezervuotam laikotarpiui — tiek jūsų kalendoriuje, tiek visuose prijungtuose portaluose. Prieš atšaukdami patikrinkite, kokios atšaukimo sąlygos galioja šiai rezervacijai.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite rezervaciją skiltyje Rezervacijos.",
                "Pasirinkite „Atšaukti“ ir nurodykite priežastį.",
                "Patikrinkite pasiūlytą grąžinimo sumą.",
                "Patvirtinkite atšaukimą.",
              ],
            },
            { type: "h2", text: "Grąžinimo inicijavimas" },
            {
              type: "p",
              text: "Jei mokėjimas buvo atliktas per prijungtą mokėjimo paslaugų teikėją, grąžinimą galite inicijuoti tiesiogiai iš rezervacijos. Suma nurodoma šiam objektui priskirta valiuta. Daugiau apie eigą rasite skyriuje [Grąžinimai](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Galimas visiškas arba dalinis grąžinimas",
                "Veiksmas pasirodo rezervacijos laiko juostoje",
                "Portalo rezervacijoms papildomai galioja atitinkamo portalo taisyklės",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Atšaukimo atšaukti negalima. Prieš patvirtindami kruopščiai patikrinkite laikotarpį ir svečią.",
            },
            { type: "h2", text: "Po atšaukimo" },
            {
              type: "p",
              text: "Objektą nuo šiol vėl galima rezervuoti, o su rezervacija susijusios atviros užduotys — pavyzdžiui, pasiruošimas — automatiškai pažymimos kaip nebereikalingos. Visas procesas lieka atsekamas [Rezervacijos laiko juostoje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Įsiregistravimas ir išsiregistravimas",
          excerpt: "Kaip myNextDays sistemoje fiksuoti svečio atvykimą ir išvykimą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Įsiregistravimo fiksavimas" },
            {
              type: "p",
              text: "Įsiregistravimas žymi buvimo pradžią ir yra ypač naudingas savarankiško įsiregistravimo ar rakto perdavimo komandai atveju, siekiant kiekvienos rezervacijos būseną laikyti aktualią.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite rezervaciją skiltyje Rezervacijos.",
                "Atvykimo dieną pasirinkite „Įsiregistravimas“.",
                "Prireikus pridėkite pastabą, pavyzdžiui, apie laiką ar ypatumus.",
              ],
            },
            { type: "h2", text: "Išsiregistravimas ir perdavimas" },
            {
              type: "p",
              text: "Išsiregistruodami pažymite buvimą kaip baigtą. Tai daugeliu atvejų automatiškai sukelia objekto valymo užduotį, kad jis būtų paruoštas kitai rezervacijai.",
            },
            {
              type: "ul",
              items: [
                "Įsiregistravimas ir išsiregistravimas yra rezervacijos laiko juostos dalis",
                "Laikus galima nustatyti kiekvienam objektui objekto nustatymuose",
                "Naudojantis mobiliąja prieiga komanda gali fiksuoti įsiregistravimą ir išsiregistravimą tiesiogiai vietoje",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Praleistas išsiregistravimas automatiškai neblokuoja tolesnių užduočių — reguliariai tikrinkite pavėluotas būsenas skiltyje Rezervacijos.",
            },
            { type: "h2", text: "Ryšys su užduotimis" },
            {
              type: "p",
              text: "Įsiregistravimas ir išsiregistravimas glaudžiai susiję su užduotimis ir laiko juosta. Daugiau apie visą eigą skaitykite skyriuje [Rezervacijos laiko juosta](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Papildomos paslaugos",
          excerpt:
            "Kaip pasiūlyti svečiams tokias rezervuojamas papildomas paslaugas kaip pusryčiai ar pervežimas ir jas fiksuoti rezervacijoje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            { type: "h2", text: "Kas yra papildomos paslaugos" },
            {
              type: "p",
              text: "Papildomos paslaugos yra pasirenkamos rezervacijos paslaugos — pavyzdžiui, pusryčiai, ankstyvas atvykimas, pervežimas ar vėlyvas išsiregistravimas. Jos nurodomos kiekvienam objektui ir gali būti pridėtos prie rezervacijos paties svečio arba jūsų komandos.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir skiltyje „Papildomos paslaugos“ sukurkite norimas paslaugas su kaina.",
                "Atidarykite esamą rezervaciją skiltyje Rezervacijos.",
                "Pasirinkite „Pridėti papildomą paslaugą“ ir pasirinkite norimą paslaugą.",
                "Patvirtinkite paslaugos kiekį ir laiką.",
              ],
            },
            { type: "h2", text: "Atsiskaitymas" },
            {
              type: "p",
              text: "Papildomos paslaugos apskaičiuojamos atitinkamo objekto valiuta ir sąskaitoje rodomos kaip atskira eilutė. Jau apmokėtas papildomas paslaugas atšaukimo atveju galima grąžinti proporcingai.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Populiarias papildomas paslaugas vieną kartą nurodykite centralizuotai objekte — taip jas galėsite pridėti prie kiekvienos naujos rezervacijos vos keliais paspaudimais.",
            },
            { type: "h2", text: "Matomumas svečiui" },
            {
              type: "p",
              text: "Jei aktyvi platforma ar nuosava svetainė, svečiai dažnai gali tinkamas papildomas paslaugas pasirinkti jau rezervacijos metu. Kiekvienas papildymas vėliau pasirodo [Rezervacijos laiko juostoje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Papildomas paslaugas galima individualiai pavadinti ir įkainoti kiekvienam objektui",
                "Vėlesnis pridėjimas galimas bet kada per rezervaciją",
                "Atšauktos papildomos paslaugos grąžinamos proporcingai",
              ],
            },
          ],
        },
      ],
    },
  ],
};
