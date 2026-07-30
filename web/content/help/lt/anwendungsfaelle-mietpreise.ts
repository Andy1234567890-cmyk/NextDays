import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Nuomos kainos",
  description: "Optimaliai nustatyti nuomos kainas.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Nuomos kainos",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Kainų optimizavimas aukštajam sezonui",
          excerpt: "Kaip tikslingai pakelti kainas didelės paklausos laikotarpiams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Aukštojo sezono metu paklausa gerokai išauga, o jūsų bazinė kaina lieka tokia pati kaip ir likusiu metų laiku. Be sezoninio koregavimo stipriausiu metų laiku prarandate pajamas — koregavimas atliekamas per objekto tarifų planą, o ne rankiniu būdu perrašant atskiras dienas.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamo objekto tarifų planą ir sukurkite sezoninę taisyklę norimam laikotarpiui.",
                "Nustatykite antkainį kaip procentinį dydį arba fiksuotą sumą virš bazinės kainos — tarifų planas automatiškai perima objekto valiutą.",
                "Prieš aktyvuodami patikrinkite kalendoriuje, ar nauja kaina aukštojo sezono laikotarpiui rodoma teisingai.",
                "Patikrinkite minimalią buvimo trukmę aukštajam sezonui — dažnai prasminga nustatyti didesnę minimalią rezervacijos trukmę, kad užimtumą būtų galima planuoti.",
                "Aktyvavę pirmomis dienomis stebėkite rezervacijų padėtį ir prireikus pakoreguokite antkainį.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezoninė taisyklė vienodai veikia visuose kanaluose — portaluose, platformoje ir svetainėje. Daugiau apie taisyklių sudarymą rasite skyriuje [Tarifų planai](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Ilgesnio buvimo skatinimas nuolaida",
          excerpt: "Kaip atlyginti svečiams už ilgesnę buvimo trukmę ir sumažinti kaitos darbo krūvį.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Trumpas buvimas reiškia daugiau atvykimų ir išvykimų, daugiau valymų ir didesnę tuščio laikotarpio riziką tarp rezervacijų. Pakopinė buvimo trukmės nuolaida daro ilgesnes rezervacijas patrauklesnes svečiams ir žymiai sumažina šį darbo krūvį.",
            },
            {
              type: "steps",
              items: [
                "Atidarykite objekto tarifų planą ir sukurkite buvimo trukmės nuolaidą.",
                "Nustatykite bent vieną pakopą, pavyzdžiui, nuo 7 ar nuo 28 naktų, su atitinkamu nuolaidos dydžiu.",
                "Patikrinkite, ar pakopos nesikerta ir nuolaida taikoma tik nuo atitinkamos minimalios trukmės.",
                "Kalendoriuje išbandykite pavyzdinę rezervaciją, viršijančią nuolaidos ribą, kad patvirtintumėte teisingą taikymą.",
                "Aktyvuokite nuolaidą ir stebėkite poveikį vidutinei buvimo trukmei ir užimtumui.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Buvimo trukmės nuolaidas galima derinti su sezoninėmis taisyklėmis — tarifų planas abu koregavimus apskaičiuoja kartu. Daugiau apie tai skyriuje [Tarifų planai](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
