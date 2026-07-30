import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Užduotys ir valymas",
  description: "Organizuoti valymo planus ir komandos užduotis.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Įmonė",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Užduočių kūrimas",
          excerpt: "Kaip sukurti naują užduotį objektui ar laikotarpiui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Užduotys sujungia viską, ką reikia atlikti aplink objektą — nuo valymo po išsiregistravimo iki priežiūros darbų ar svečių užklausų. Kiekviena užduotis priskirta lygiai vienam objektui ir gali būti priskirta komandos nariui.",
            },
            { type: "h2", text: "Naujos užduoties kūrimas" },
            {
              type: "steps",
              items: [
                "Pagrindiniame meniu atidarykite skyrių „Užduotys“.",
                "Spustelėkite „Nauja užduotis“.",
                "Pasirinkite atitinkamą objektą.",
                "Suteikite pavadinimą ir pasirinktinai aprašymą.",
                "Nustatykite atlikimo datą ir laiką.",
                "Išsaugokite užduotį.",
              ],
            },
            { type: "h2", text: "Užduočių tipai" },
            {
              type: "p",
              text: "Be laisvai kuriamų užduočių, yra ir sistemos automatiškai sukuriamos užduotys, pavyzdžiui, automatiškai suplanuotas valymas po išsiregistravimo. Jos jau susietos su objektu ir tinkamu laiko langu, belieka jas priskirti komandos nariui.",
            },
            {
              type: "ul",
              items: [
                "Rankinė užduotis: laisvai sukurta, pvz., priežiūra ar specialus pageidavimas.",
                "Automatinė valymo užduotis: išvedama iš išsiregistravimo datos.",
                "Pasikartojanti užduotis: reguliariems patikrinimams ar apžiūroms.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie automatinį laiko planavimą rasite skyriuje [Valymo planai](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Suteikite tikslius pavadinimus — komandos nariai mobiliajame vaizde dažnai vienu žvilgsniu mato tik pavadinimą ir objektą.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Valymo planai",
          excerpt: "Automatiškai suplanuoti valymus po išsiregistravimo.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Valymo planas užtikrina, kad po kiekvieno išsiregistravimo automatiškai sukuriama atitinkamo objekto valymo užduotis — jums nereikia sekti kiekvienos rezervacijos atskirai. Tai sumažina pamirštus perdavimus ir užtikrina patikimą eigą tarp dviejų apsilankymų.",
            },
            { type: "h2", text: "Automatinio planavimo aktyvavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą ir pereikite į skirtuką „Valymas“.",
                "Aktyvuokite „Automatiškai planuoti valymą po išsiregistravimo“.",
                "Nustatykite, kiek laiko po išsiregistravimo skiriama valymui.",
                "Pasirinktinai nustatykite numatytąją komandą ar valytoją.",
                "Išsaugokite nustatymą.",
              ],
            },
            { type: "h2", text: "Sąveika su kalendoriumi" },
            {
              type: "p",
              text: "Kai tik rezervacija atšaukiama ar perkeliama, susijusi valymo užduotis automatiškai prisitaiko prie naujos išsiregistravimo datos. Taip valymo planas visada lieka sinchronizuotas su faktine užimtumo būsena.",
            },
            {
              type: "ul",
              items: [
                "Valymas sukuriamas automatiškai kiekvieno išsiregistravimo metu, kai planas aktyvus.",
                "Perkėlus rezervaciją, kartu perkeliama ir valymo užduotis.",
                "Svečiui atšaukus buvimą, valymo užduotis pašalinama.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Be aktyvuoto valymo plano automatinių užduočių nesukuriama — tokiu atveju valymus kurkite rankiniu būdu skyriuje [Užduočių kūrimas](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Užduočių priskyrimas",
          excerpt: "Tikslingai priskirti užduotis valytojams ar komandos nariams.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kad užduotis būtų atlikta, priskiriate ją konkrečiam komandos nariui — pavyzdžiui, valytojui ar darbuotojui, atsakingam už priežiūrą. Numatytuoju atveju užduotį savo apžvalgoje mato tik priskirtas asmuo.",
            },
            { type: "h2", text: "Rankinis užduoties priskyrimas" },
            {
              type: "steps",
              items: [
                "Atidarykite užduotį sąraše „Užduotys“.",
                "Spustelėkite „Priskirti“.",
                "Iš sąrašo pasirinkite atsakingą komandos narį.",
                "Patvirtinkite priskyrimą.",
              ],
            },
            { type: "h2", text: "Priskyrimas pagal objektą" },
            {
              type: "p",
              text: "Jei valytojui jau nuolat priskirtas objektas, šio objekto užduotis galite leisti automatiškai priskirti tam pačiam asmeniui. Tai taupo paspaudimus atliekant pasikartojančius valymus ir sumažina papildomus klausimus.",
            },
            {
              type: "ul",
              items: [
                "Rankinis priskyrimas: asmenį kiekvienai užduočiai pasirenkate patys.",
                "Fiksuotas objekto priskyrimas: naujos šio objekto užduotys automatiškai skiriamos nurodytam asmeniui.",
                "Užduotis visada turi lygiai vieną atsakingą asmenį.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Valytojai ir darbuotojai mato išimtinai jiems pačiam priskirtas užduotis, jokių objekto finansinių ar pardavimo duomenų.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Užduočių būsenos sekimas",
          excerpt: "Realiu laiku sekti užduočių atlikimo eigą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kiekviena užduotis pereina aiškią būseną — nuo atviros per vykdomą iki baigtos. Taip bet kada matote, ar valymas ar priežiūra bus baigti laiku prieš kitą įsiregistravimą.",
            },
            { type: "h2", text: "Būsenų apžvalga" },
            {
              type: "ul",
              items: [
                "Atvira: užduotis sukurta, bet dar nepradėta.",
                "Vykdoma: priskirtas asmuo pradėjo užduotį.",
                "Baigta: užduotis atlikta ir patvirtinta.",
              ],
            },
            { type: "h2", text: "Būsenos atnaujinimas" },
            {
              type: "steps",
              items: [
                "Atidarykite užduotį iš sąrašo „Užduotys“.",
                "Pasirinkite tinkamą būseną, pvz., „Vykdoma“ arba „Baigta“.",
                "Prireikus pridėkite trumpą pastabą, pavyzdžiui, apie pastebėjimus objekte.",
                "Išsaugokite pakeitimą.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Būsenos pakeitimai iš karto pasirodo bendrame užduočių sąraše — rankiniu būdu iš naujo įkelti nereikia.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jei valymas prieš pat kitą įsiregistravimą vis dar atviras, pirmiausia patikrinkite priskyrimą, prieš susisiekdami su svečiu.",
            },
          ],
        },
      ],
    },
  ],
};
