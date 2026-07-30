import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Kainos ir tarifai",
  description: "Tarifų planai, sezoninės kainos ir dinaminės kainos.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Kainodara",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Bazinė kaina ir valiuta",
          excerpt: "Kaip nustatyti bazinę kainą ir priskirti objektui teisingą valiutą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kiekvienas objektas myNextDays sistemoje yra lygiai viena rezervuojama vienetas — atskiras kambarys arba poilsio objektas. Šiam vienetui nurodote bazinę kainą ir centrinę valiutą, galiojančią visam objektui.",
            },
            { type: "h2", text: "Centrinis valiutos nustatymas" },
            {
              type: "p",
              text: "Objekto valiuta nustatoma vieną kartą kiekvienam objektui ir automatiškai galioja visiems šiam objektui sukurtiems tarifų planams. Atskiro atsarginio valiutos varianto nėra — jei valiutos nėra, kainų išsaugoti negalėsite.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje „Objektai“.",
                "Pereikite į skirtuką „Kainos“.",
                "Skiltyje „Objekto valiuta“ pasirinkite tinkamą valiutą.",
                "Įveskite bazinę kainą standartinei talpai.",
                "Išsaugokite pakeitimus.",
              ],
            },
            { type: "h2", text: "Kas nutinka pakeitus valiutą" },
            {
              type: "p",
              text: "Jei vėliau pakeisite objekto valiutą, tai paveiks visus esamus šio objekto tarifų planus, nes jie visada vedami objekto valiuta. Po to patikrinkite savo kainas, prieš iš naujo perduodami jas portalams.",
            },
            {
              type: "ul",
              items: [
                "Objektas turi lygiai vieną valiutą — ne kelias skirtingas kiekvienam tarifų planui.",
                "Bazinė kaina yra išeities taškas išvestiems tarifams.",
                "Sumos visada rodomos su nurodyta objekto valiuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Be nurodytos valiutos negalima išsaugoti jokios kainos ir perduoti jokio tarifo portalams. Jei kainos pakeitimas nepavyksta, pirmiausia patikrinkite tai.",
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie išvestines kainas rasite skyriuje [Išvestiniai tarifai](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Tarifų planų kūrimas",
          excerpt: "Tarifų planai sujungia kainą, atšaukimo sąlygas ir maitinimą vienam objektui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Tarifų planas apibrėžia, kokiomis sąlygomis galima rezervuoti objektą: kainą, atšaukimo taisykles, maitinimą ir minimalią buvimo trukmę. Objektas gali vienu metu siūlyti kelis tarifų planus, pavyzdžiui, lankstų ir neatšaukiamą planą.",
            },
            { type: "h2", text: "Naujo tarifų plano kūrimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką „Kainos“.",
                "Spustelėkite „Sukurti naują tarifų planą“.",
                "Suteikite aiškų pavadinimą, pvz., „Lankstus“ arba „Neatšaukiamas“.",
                "Nustatykite, ar planas yra bazinis tarifas, ar išvestinis tarifas.",
                "Nurodykite atšaukimo sąlygas ir maitinimą.",
                "Išsaugokite ir aktyvuokite tarifų planą.",
              ],
            },
            { type: "h2", text: "Bazinis tarifas ir kiti tarifų planai" },
            {
              type: "p",
              text: "Pirmiausia sukurkite savo bazinį tarifą (dažnai vadinamą „BAR“, geriausias galimas tarifas). Visi kiti tarifų planai gali būti tvarkomi savarankiškai arba išvedami iš šio bazinio tarifo.",
            },
            {
              type: "ul",
              items: [
                "Bazinis tarifas: rankiniu būdu tvarkoma kaina už naktį.",
                "Kiti tarifų planai: savarankiški arba kaip antkainis / nuolaida nuo bazinio tarifo.",
                "Kiekvienas tarifų planas gali būti perduotas portalams atskirai.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tarifų planų skaičių kiekvienam objektui laikykite valdomą — per daug variantų svečiams apsunkina palyginimą ir didina priežiūros darbą.",
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie antkainius ir nuolaidas rasite skyriuje [Išvestiniai tarifai](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Išvestiniai tarifai",
          excerpt: "Išvestiniai tarifų planai skaičiuojami automatiškai iš bazinio tarifo.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Išvestinis tarifas yra tarifų planas, kurio kaina nėra tvarkoma rankiniu būdu, o automatiškai skaičiuojama iš bazinio tarifo — kaip fiksuotas antkainis, nuolaida ar procentinis dydis. Tai sutaupo priežiūros darbo, nes kainos pakeitimas baziniame tarife automatiškai atnaujina visus išvestinius planus.",
            },
            { type: "h2", text: "Tipinis pavyzdys" },
            {
              type: "p",
              text: "Dažnas pavyzdys — planas su pusryčiais, išvedamas iš bazinio tarifo be maitinimo: pusryčių kaina apibrėžiama kaip antkainis už naktį ir asmenį prie bazinio tarifo. Pakeitus bazinį tarifą, pusryčių kaina automatiškai pasikoreguoja.",
            },
            { type: "h2", text: "Išvestinio tarifo nustatymas" },
            {
              type: "steps",
              items: [
                "Skirtuke „Kainos“ atidarykite norimą tarifų planą.",
                "Kaip kainos šaltinį pasirinkite „Išvesta iš …“ ir atitinkamą bazinį tarifą.",
                "Nustatykite, ar skirtumas taikomas kaip fiksuota suma, ar kaip procentinis dydis.",
                "Nustatykite, ar tai yra antkainis, ar nuolaida.",
                "Išsaugokite priskyrimą.",
              ],
            },
            {
              type: "ul",
              items: [
                "Antkainis: pvz., maitinimas, vėlesnis atšaukimo terminas.",
                "Nuolaida: pvz., neatšaukiamas planas su kainos privalumu.",
                "Bazinis tarifas išlieka vieninteliu rankiniu būdu tvarkomu šaltiniu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Išvestinio tarifo negalima tuo pat metu perrašyti rankiniu būdu. Jei norite nustatyti kitokią atskirą kainą, pirmiausia atšaukite išvedimo ryšį.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezoninės ir savaitgalio kainos",
          excerpt: "Tikslingai koreguoti kainas sezoniniams laikotarpiams ir savaitgaliams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Paklausa kinta per metus ir per savaitę. Sezoninėmis ir savaitgalio kainomis koreguojate bazinę kainą tam tikriems laikotarpiams ar savaitės dienoms, neinant į kalendorių dėl kiekvienos dienos atskirai.",
            },
            { type: "h2", text: "Sezoninio laikotarpio kūrimas" },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skirtuką „Kainos“ ir sritį „Sezoninės kainos“.",
                "Sukurkite naują laikotarpį su pradžios ir pabaigos datomis.",
                "Nurodykite kainą arba procentinį nuokrypį nuo bazinės kainos šiam laikotarpiui.",
                "Išsaugokite sezoninį laikotarpį.",
              ],
            },
            { type: "h2", text: "Savaitgalio kainos" },
            {
              type: "p",
              text: "Papildomai galite atskiroms savaitės dienoms, pavyzdžiui, penktadieniui ir šeštadieniui, priskirti savo antkainį. Šis antkainis taikomas papildomai prie tuo metu galiojančios sezoninės ar bazinės kainos.",
            },
            {
              type: "ul",
              items: [
                "Sezoninės kainos galioja ištisiniams laikotarpiams.",
                "Savaitgalio kainos galioja kiekvienai savaitės dienai, nepriklausomai nuo sezono.",
                "Abi taisykles galima derinti.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jei keli sezoniniai laikotarpiai persidengia, galioja paskutinė sukurta arba konkrečiausia taisyklė. Po išsaugojimo patikrinkite kalendorių.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Automatiniam, paklausa pagrįstam koregavimui papildomai tinka [Dinaminės kainos](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dinaminės kainos",
          excerpt: "Automatiškai koreguoti kainas pagal paklausą, rezervacijos laiką iš anksto ir užimtumą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Dinaminės kainos automatiškai koreguoja bazinę kainą pagal tokius veiksnius kaip rezervacijos laikas iš anksto, esamas užimtumas ir paklausa — panašiai, kaip tai daro didieji portalai savo kainų rekomendacijose. Taip reaguojate į rinkos pokyčius, nekoreguodami kiekvienos dienos rankiniu būdu.",
            },
            { type: "h2", text: "Dinaminių kainų aktyvavimas" },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skirtuką „Kainos“ ir sritį „Dinaminės kainos“.",
                "Aktyvuokite funkciją objekto baziniam tarifui.",
                "Nustatykite žemiausią ir aukščiausią kainos ribą.",
                "Nustatykite, kiek stipriai užimtumas gali paveikti kainą.",
                "Išsaugokite nustatymus.",
              ],
            },
            { type: "h2", text: "Ribos ir saugumas" },
            {
              type: "p",
              text: "Žemiausia ir aukščiausia kainos riba neleidžia automatiniam algoritmui nustatyti kainų, kurios būtų nepriimtinos jūsų įmonei. Išvestiniai tarifų planai automatiškai seka dinamiškai apskaičiuotą bazinį tarifą.",
            },
            {
              type: "ul",
              items: [
                "Žemiausia kainos riba apsaugo nuo per žemų kainų esant silpnai paklausai.",
                "Aukščiausia kainos riba apsaugo nuo per didelių kainų esant didelei paklausai.",
                "Išvestiniai tarifai automatiškai perima naują bazinį tarifą.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dinaminės kainos veikia tik bazinį tarifą. Rankiniu būdu fiksuotai nustatyti tarifų planai be išvedimo automatiškai nesikeičia.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Buvimo trukmės nuolaidos",
          excerpt: "Nustatyti nuolaidas ilgesniam buvimui ir ankstyvoms rezervacijoms.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Buvimo trukmės nuolaidos atlygina svečiams už ilgesnes rezervacijas arba ankstyvą rezervavimą. Jos taikomos kaip procentinis dydis visai buvimo kainai ir gali būti konfigūruojamos nepriklausomai kiekvienam objektui.",
            },
            { type: "h2", text: "Nuolaidų rūšys" },
            {
              type: "ul",
              items: [
                "Ilgalaikė nuolaida: nuo tam tikro naktų skaičiaus, pvz., nuo 7 ar 28 naktų.",
                "Ankstyvo rezervavimo nuolaida: rezervavus pakankamai iš anksto.",
                "Paskutinės minutės nuolaida: rezervuojant trumpai prieš atvykimo datą.",
              ],
            },
            { type: "h2", text: "Nuolaidos nustatymas" },
            {
              type: "steps",
              items: [
                "Objekte atidarykite skirtuką „Kainos“ ir sritį „Nuolaidos“.",
                "Pasirinkite norimą nuolaidos rūšį.",
                "Nustatykite ribą, pvz., minimalų naktų skaičių arba rezervavimo laiką iš anksto.",
                "Įveskite nuolaidos dydį procentais.",
                "Išsaugokite taisyklę.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Nuolaidos taikomos atitinkamo tarifų plano bendrai kainai ir svečiui rodomos jau kainų apžvalgoje.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Derinkite ilgalaikes nuolaidas su [Minimalia ir maksimalia buvimo trukme](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), kad tikslingai skatintumėte ilgesnes rezervacijas.",
            },
          ],
        },
      ],
    },
  ],
};
