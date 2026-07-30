import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilioji programėlė",
  description: "myNextDays programėlė kelionėje.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Programėlė",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays programėlė",
          excerpt: "Viena paskyra, keturios patirtys: svečias, agentūra, savininkas ir darbuotojas.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays programėlė yra mobilioji jūsų visos įmonės platforma. Tai ne atskiras produktas, o lygiavertis internetinio skydelio frontendas — abu naudoja tą pačią paskyrą ir tuos pačius duomenis, tik sąsaja optimizuota naudojimui kelyje.",
            },
            { type: "h2", text: "Keturios patirtys vienoje programėlėje" },
            {
              type: "ul",
              items: [
                "Svečias: peržiūrėti rezervacijas, bendrauti su įmone, gauti įsiregistravimo informaciją.",
                "Agentūra: valdyti kelias įmones ir objektus apžvalgoje.",
                "Savininkas: tik skaitymo prieiga prie savo objektų, užimtumo ir ataskaitų.",
                "Darbuotojas: kalendorius, užduotys ir valymo planai kasdieniam darbui.",
              ],
            },
            { type: "h2", text: "Kurią patirtį matote" },
            {
              type: "p",
              text: "Prisijungus programėlė automatiškai rodo jūsų vaidmenį atitinkančią patirtį — tą patį vaidmenį, kuris galioja ir internetiniame skydelyje. Darbuotojas su ribotomis teisėmis programėlėje mato lygiai tuos pačius apribojimus kaip naršyklėje, nes teisė tikrinama serverio pusėje.",
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie vaidmenis ir tai, ką kiekvienas gali matyti, rasite skyriuje [Vaidmenys ir teisės](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Programėlei atskiros registracijos nereikia — tiesiog prisijunkite su esamais myNextDays prisijungimo duomenimis.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Programėlės diegimas ir prisijungimas",
          excerpt: "Kaip atsisiųsti myNextDays programėlę ir prisijungti.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays programėlė prieinama iOS ir Android sistemoms. Prisijungiama tais pačiais duomenimis kaip internetiniame skydelyje — atskiros paskyros ar pakartotinės registracijos nereikia.",
            },
            { type: "h2", text: "Diegimas" },
            {
              type: "steps",
              items: [
                "Atidarykite App Store (iOS) arba Google Play (Android).",
                "Ieškokite „myNextDays“.",
                "Įdiekite programėlę savo išmaniajame telefone ar planšetėje.",
                "Po diegimo atidarykite programėlę.",
              ],
            },
            { type: "h2", text: "Prisijungimas" },
            {
              type: "steps",
              items: [
                "Palieskite „Prisijungti“.",
                "Įveskite savo el. pašto adresą ir slaptažodį.",
                "Prireikus patvirtinkite dviejų veiksnių autentifikavimo užklausą.",
                "Automatiškai pateksite į jūsų vaidmenį atitinkančią patirtį.",
              ],
            },
            {
              type: "ul",
              items: [
                "Prisijungimo duomenys yra tokie patys kaip internetiniame skydelyje.",
                "Jei jūsų prieiga atimta, prisijungimas programėlėje taip pat iš karto blokuojamas.",
                "Kilus problemoms su slaptažodžiu, naudokite „Pamiršau slaptažodį“ tiesiogiai programėlėje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prisijunkite tik per oficialų programėlių parduotuvės įrašą „myNextDays“; programėlė niekada neprašo prisijungimo duomenų už prisijungimo ekrano ribų.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Valdymas kelyje",
          excerpt: "Tvarkyti rezervacijas, žinutes ir užduotis tiesiai iš išmaniojo telefono.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays programėlė ypač tinka einamai veiklai kelyje: matote aktualias rezervacijas, atsakote į svečių žinutes ir atliekate užduotis, nesėdint prie kompiuterio — pakeitimai realiu laiku pasirodo ir internetiniame skydelyje.",
            },
            { type: "h2", text: "Rezervacijos akiratyje" },
            {
              type: "p",
              text: "Skyriuje „Rezervacijos“ matote atvykimus ir išvykimus, užimtumą ir kiekvieno objekto būseną. Darbuotojai ir valytojai mato tik jiems aktualią informaciją, be kainų ar pardavimo duomenų.",
            },
            { type: "h2", text: "Žinutės ir užduotys" },
            {
              type: "steps",
              items: [
                "Atidarykite skyrių „Žinutės“, kad tiesiogiai atsakytumėte į svečių užklausas.",
                "Pereikite į „Užduotys“, kad pamatytumėte jums priskirtus darbus.",
                "Palieskite užduotį, kad atidarytumėte detales ir ją užbaigtumėte.",
                "Atliktus valymo terminus pažymėkite kaip baigtus tiesiogiai vietoje.",
              ],
            },
            {
              type: "ul",
              items: [
                "Naujos žinutės ir užduotys pasirodo iš karto, be rankinio atnaujinimo.",
                "Baigtos užduotys iš karto matomos ir internetiniame skydelyje.",
                "Savininkai mato savo objektų rezervacijas ir ataskaitas, tačiau tik skaitymo režimu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push pranešimai informuoja jus apie naujas žinutes ir priskirtas užduotis, kai tik juos leidžiate įrenginio nustatymuose.",
            },
          ],
        },
      ],
    },
  ],
};
