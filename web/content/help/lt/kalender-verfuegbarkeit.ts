import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendorius ir prieinamumas",
  description: "Užimtumo planas, pardavimo stabdymas ir minimali buvimo trukmė.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendorius",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Užimtumo plano skaitymas",
          excerpt: "Kaip teisingai skaityti rezervacijas, prieinamumą ir kainas užimtumo plane.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Užimtumo planas vienu žvilgsniu parodo, kurios naktys rezervuotos, laisvos ar užblokuotos. Poilsio objektų atveju matote po vieną eilutę kiekvienam objektui, viešbučių atveju — įdėtinį vaizdą su eilute kiekvienai kambarių kategorijai ir tarifų planui.",
            },
            { type: "h2", text: "Vaizdo struktūra" },
            {
              type: "steps",
              items: [
                "Atidarykite kalendorių per meniu punktą „Užimtumo planas“.",
                "Viršuje pasirinkite laikotarpį, kurį norite peržiūrėti.",
                "Prireikus filtruokite pagal atskirus objektus ar kambarių kategorijas.",
                "Spustelėkite dieną, norėdami atidaryti kainos ir prieinamumo detales.",
                "Spustelėkite užimtą laikotarpį, norėdami atidaryti susijusią rezervaciją.",
              ],
            },
            { type: "h2", text: "Spalvos ir simboliai" },
            {
              type: "ul",
              items: [
                "Užimta: laikotarpis rezervuotas pagal rezervaciją.",
                "Laisva: dieną galima rezervuoti visuose aktyviuose kanaluose.",
                "Užblokuota: diena nerezervuojama dėl pardavimo stabdymo arba rankinio blokavimo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kiekviena eilutė užimtumo plane atspindi lygiai vieną rezervuojamą vienetą — kambarį arba poilsio objektą. Bendros eilutės keliems kambariams vienu metu nėra.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Daugiau apie tikslingą atskirų dienų atidarymą ir uždarymą rasite skyriuje [Prieinamumo nustatymas](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Prieinamumo nustatymas",
          excerpt: "Tikslingai atidaryti ir uždaryti atskiras dienas ar laikotarpius.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Prieinamumas nustato, ar objektą galima rezervuoti tam tikrą dieną. Atskiras dienas ar visus laikotarpius galite atidaryti ar uždaryti tiesiogiai užimtumo plane.",
            },
            { type: "h2", text: "Laikotarpio redagavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite norimo objekto užimtumo planą.",
                "Pažymėkite norimą laikotarpį spustelėdami ir tempdami.",
                "Veiksmų meniu pasirinkite „Keisti prieinamumą“.",
                "Patvirtinkite, ar laikotarpis turi būti atidarytas, ar uždarytas.",
                "Išsaugokite pakeitimą.",
              ],
            },
            { type: "h2", text: "Poveikis kanalams" },
            {
              type: "p",
              text: "Prieinamumo pakeitimas paveikia visus pardavimo kanalus, kuriuose objektas matomas: portalus, tokius kaip Booking, Airbnb ir kt., nuosavą platformą bei programėlę. Duomenų perdavimas portalams vyksta automatiškai fone.",
            },
            {
              type: "ul",
              items: [
                "Atidarymas: diena tampa rezervuojama visuose aktyviuose kanaluose.",
                "Uždarymas: diena tampa nerezervuojama, bet lieka matoma kalendoriuje.",
                "Jau esamoms rezervacijoms prieinamumo pakeitimas įtakos neturi.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Neuždarykite laikotarpio ketindami jį visiškai ir nuolat blokuoti nuo pardavimo — tam skirta funkcija yra pardavimo stabdymas (Stop-Sell), žr. [Pardavimo stabdymas](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Pardavimo stabdymas (Stop-Sell)",
          excerpt: "Pardavimo stabdymas iš karto blokuoja dieną visuose pardavimo kanaluose vienu metu.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Pardavimo stabdymas yra greičiausias būdas visiškai išimti vieną dieną iš pardavimo. Skirtingai nuo paprasto prieinamumo pakeitimo, pardavimo stabdymas veikia griežtai ir iš karto visuose kanaluose vienu metu — portaluose, nuosavoje platformoje ir programėlėje.",
            },
            { type: "h2", text: "Pardavimo stabdymo nustatymas" },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamo objekto užimtumo planą.",
                "Pasirinkite norimą dieną ar laikotarpį.",
                "Veiksmų meniu spustelėkite „Aktyvuoti pardavimo stabdymą“.",
                "Patvirtinkite blokavimą.",
              ],
            },
            { type: "h2", text: "Kada pardavimo stabdymas yra prasmingas" },
            {
              type: "ul",
              items: [
                "Trumpalaikiai techninės priežiūros darbai ar techninės problemos objekte.",
                "Ypatingas atvejis, kai iš karto ir be išimčių nenorite jokios naujos rezervacijos.",
                "Greitas, visą platformą apimantis skubus blokavimas, netvarkant kiekvieno kanalo atskirai.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pardavimo stabdymas neturi kanalui būdingos išimties: jei diena užblokuota, nė vienas svečias negali rezervuoti per jokį kanalą, taip pat ne per registratūrą ar tiesioginę užklausą.",
            },
            {
              type: "note",
              variant: "info",
              text: "Nuolatiniam naudojimuisi patiems ar planuojamai priežiūrai vietoj to tinka [Rankinis blokavimas](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimali ir maksimali buvimo trukmė",
          excerpt: "Kiek mažiausiai arba daugiausiai gali rezervuoti svečiai.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Minimalia ir maksimalia buvimo trukme nustatote, kiek naktų svečias tam tikrą atvykimo dieną gali rezervuoti mažiausiai arba daugiausiai. Tai padeda išvengti trumpų tarpinių rezervacijų arba tikslingai pozicionuoti objektą ilgesniam buvimui.",
            },
            { type: "h2", text: "Taisyklės nustatymas" },
            {
              type: "steps",
              items: [
                "Objekte atidarykite užimtumo planą arba skirtuką „Kainos“.",
                "Pasirinkite atitinkamą laikotarpį.",
                "Skiltyje „Minimali buvimo trukmė“ įveskite minimalų naktų skaičių.",
                "Pasirinktinai skiltyje „Maksimali buvimo trukmė“ įveskite maksimalų naktų skaičių.",
                "Išsaugokite taisyklę.",
              ],
            },
            { type: "h2", text: "Tipiniai naudojimo atvejai" },
            {
              type: "ul",
              items: [
                "Aukštasis sezonas: didesnė minimali buvimo trukmė, siekiant sutelkti kaitos dienas.",
                "Žemasis sezonas: mažesnė minimali buvimo trukmė, siekiant leisti daugiau rezervacijų.",
                "Maksimali buvimo trukmė: prasminga, kai objektas po to turi būti laisvas priežiūrai ar kitam naudojimui.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Taisyklė galioja atvykimo dienai: svečias dieną, kuriai nustatyta minimali trijų naktų buvimo trukmė, negali atvykti tik dviem naktims, net jei atskiros dienos yra laisvos.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Derinkite ilgesnę minimalią buvimo trukmę su [Buvimo trukmės nuolaidomis](/hilfe/preise-raten/aufenthaltsrabatte), kad padidintumėte svečių paskatą.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Rankinis blokavimas",
          excerpt: "Tikslingai rezervuoti laikotarpius naudojimui patiems ar priežiūrai.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Rankinis blokavimas rezervuoja kalendoriuje laikotarpį be tikros svečio rezervacijos — pavyzdžiui, naudojimui patiems, planuojamiems priežiūros darbams ar renovacijoms. Laikotarpis užimtumo plane rodomas kaip rezervacija, tačiau aiškiai atpažįstamas kaip blokavimas.",
            },
            { type: "h2", text: "Blokavimo sukūrimas" },
            {
              type: "steps",
              items: [
                "Atidarykite atitinkamo objekto užimtumo planą.",
                "Pažymėkite norimą laikotarpį.",
                "Veiksmų meniu pasirinkite „Blokuoti rankiniu būdu“.",
                "Nurodykite priežastį, pvz., „Naudojimas patiems“ arba „Priežiūra“.",
                "Išsaugokite blokavimą.",
              ],
            },
            { type: "h2", text: "Skirtumas nuo pardavimo stabdymo" },
            {
              type: "p",
              text: "Rankinis blokavimas konkrečiai rezervuoja laikotarpį tam tikram, dokumentuotam tikslui ir vėliau gali būti vėl atlaisvintas. Skubiam, visą platformą apimančiam blokavimui be dokumentuoto laikotarpio vietoj to skirtas pardavimo stabdymas.",
            },
            {
              type: "ul",
              items: [
                "Rankinis blokavimas: suplanuotas, su priežastimi, naudojimui patiems ar priežiūrai.",
                "Atlaisvinimas galimas bet kada, kai laikotarpio nebereikia.",
                "Blokuotos naktys nelaikomos svečio rezervacija ir nerodomos apyvartos apžvalgoje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ištrinkite rankinį blokavimą, kai tik jo priežastis išnyksta — kitaip objektas nereikalingai liks užblokuotas visuose kanaluose.",
            },
            {
              type: "note",
              variant: "info",
              text: "Skubiam blokavimui be suplanuoto laikotarpio naudokite [Pardavimo stabdymą](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
